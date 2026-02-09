use axum::{
    extract::{Path, State, Query},
    http::StatusCode,
    routing::{get, post, delete},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::sync::Arc;
use tauri::{AppHandle, Manager, Runtime, Emitter};
use uuid::Uuid;

// --- СТРУКТУРЫ ДАННЫХ (Дублируют TypeScript) ---

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubActivity {
    id: String,
    title: String,
    #[serde(rename = "startTime")]
    start_time: i64,
    #[serde(rename = "endTime")]
    end_time: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkSession {
    id: String,
    #[serde(rename = "startTime")]
    start_time: i64,
    #[serde(rename = "endTime")]
    end_time: Option<i64>,
    date: String,
    #[serde(rename = "subActivities")]
    sub_activities: Vec<SubActivity>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    #[serde(rename = "weeklyHoursTarget")]
    weekly_hours_target: u32,
    #[serde(rename = "userName")]
    user_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppData {
    sessions: Vec<WorkSession>,
    settings: AppSettings,
}

#[derive(Deserialize)]
pub struct StartRequest {
    title: String,
    #[serde(rename = "startTime")]
    start_time: i64,
}

// --- СЕРВЕР ---

struct AppState<R: Runtime> {
    app: AppHandle<R>,
}

pub async fn start_server<R: Runtime>(app: AppHandle<R>) {
    let state = Arc::new(AppState { app: app.clone() });

    let app_router = Router::new()
        // Геттеры
        .route("/data", get(get_all_data::<R>))
        .route("/data/day/:date", get(get_day_data::<R>))
        .route("/data/week/:year/:week", get(get_week_data::<R>))
        // Добавление / Изменение
        .route("/data/start", post(start_new_session::<R>))
        .route("/data/append", post(append_session::<R>))
        .route("/data/overwrite", post(overwrite_all::<R>))
        // Удаление
        .route("/data/all", delete(clear_all::<R>))
        .route("/data/day/:date", delete(clear_day::<R>))
        .route("/data/range", delete(clear_range::<R>))
        .with_state(state);

    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], 45321));
    println!("API Server running on http://{}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app_router).await.unwrap();
}

// --- ХЕНДЛЕРЫ ---

// Вспомогательная функция для загрузки всей базы
fn internal_load<R: Runtime>(app: &AppHandle<R>) -> AppData {
    let path = app.path().app_data_dir().unwrap().join("data.json");
    let content = fs::read_to_string(path).unwrap_or_default();
    serde_json::from_str(&content).unwrap_or(AppData {
        sessions: vec![],
        settings: AppSettings { weekly_hours_target: 40, user_name: "User".into() },
    })
}

// Вспомогательная функция для сохранения и пуша ивента на фронт
fn internal_save<R: Runtime>(app: &AppHandle<R>, data: &AppData) -> Result<(), String> {
    let path = app.path().app_data_dir().unwrap().join("data.json");
    if let Some(p) = path.parent() { let _ = fs::create_dir_all(p); }
    let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    let _ = app.emit("external-data-update", ());
    Ok(())
}

async fn get_all_data<R: Runtime>(State(state): State<Arc<AppState<R>>>) -> Json<AppData> {
    Json(internal_load(&state.app))
}

async fn get_day_data<R: Runtime>(
    State(state): State<Arc<AppState<R>>>,
    Path(date): Path<String>,
) -> Json<Vec<WorkSession>> {
    let data = internal_load(&state.app);
    let filtered = data.sessions.into_iter().filter(|s| s.date == date).collect();
    Json(filtered)
}

async fn get_week_data<R: Runtime>(
    State(state): State<Arc<AppState<R>>>,
    Path((year, week)): Path<(i32, u32)>,
) -> Json<Vec<WorkSession>> {
    let data = internal_load(&state.app);
    let filtered = data.sessions.into_iter().filter(|s| {
        // Простая проверка по номеру недели (требует совпадения логики с фронтом)
        if let Ok(d) = chrono::NaiveDate::parse_from_str(&s.date, "%Y-%m-%d") {
            use chrono::Datelike;
            let iso = d.iso_week();
            return iso.year() == year && iso.week() == week;
        }
        false
    }).collect();
    Json(filtered)
}

#[derive(Deserialize)]
struct RangeParams {
    start: String,
    end: String,
}

async fn clear_range<R: Runtime>(
    State(state): State<Arc<AppState<R>>>,
    Query(range): Query<RangeParams>,
) -> StatusCode {
    let mut data = internal_load(&state.app);
    data.sessions.retain(|s| s.date < range.start || s.date > range.end);
    match internal_save(&state.app, &data) {
        Ok(_) => StatusCode::OK,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

async fn start_new_session<R: Runtime>(
    State(state): State<Arc<AppState<R>>>,
    Json(payload): Json<StartRequest>,
) -> StatusCode {
    let mut data = internal_load(&state.app);
    let now_ms = chrono::Utc::now().timestamp_millis();

    // 1. БЕЗОПАСНОСТЬ: Закрываем все текущие активные сессии, если они есть
    for s in data.sessions.iter_mut() {
        if s.end_time.is_none() {
            s.end_time = Some(now_ms);
            for sub in s.sub_activities.iter_mut() {
                if sub.end_time.is_none() {
                    sub.end_time = Some(now_ms);
                }
            }
        }
    }

    // 2. Определяем дату из переданного startTime
    let date_str = match chrono::NaiveDateTime::from_timestamp_millis(payload.start_time) {
        Some(dt) => dt.date().to_string(),
        None => return StatusCode::BAD_REQUEST,
    };

    // 3. Создаем новую сессию "из прошлого"
    let new_session = WorkSession {
        id: Uuid::new_v4().to_string(),
        start_time: payload.start_time,
        end_time: None, // Она активна!
        date: date_str,
        sub_activities: vec![SubActivity {
            id: Uuid::new_v4().to_string(),
            title: payload.title,
            start_time: payload.start_time,
            end_time: None, // Таск тоже активен!
        }],
    };

    data.sessions.push(new_session);

    match internal_save(&state.app, &data) {
        Ok(_) => StatusCode::CREATED,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

async fn append_session<R: Runtime>(
    State(state): State<Arc<AppState<R>>>,
    Json(new_session): Json<WorkSession>,
) -> StatusCode {
    let mut data = internal_load(&state.app);
    // Удаляем старую версию сессии, если ID совпадает (Update/Insert)
    data.sessions.retain(|s| s.id != new_session.id);
    data.sessions.push(new_session);

    match internal_save(&state.app, &data) {
        Ok(_) => StatusCode::CREATED,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

async fn overwrite_all<R: Runtime>(
    State(state): State<Arc<AppState<R>>>,
    Json(new_data): Json<AppData>,
) -> StatusCode {
    match internal_save(&state.app, &new_data) {
        Ok(_) => StatusCode::OK,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

async fn clear_all<R: Runtime>(State(state): State<Arc<AppState<R>>>) -> StatusCode {
    let mut data = internal_load(&state.app);
    data.sessions = vec![];
    match internal_save(&state.app, &data) {
        Ok(_) => StatusCode::OK,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

async fn clear_day<R: Runtime>(
    State(state): State<Arc<AppState<R>>>,
    Path(date): Path<String>,
) -> StatusCode {
    let mut data = internal_load(&state.app);
    data.sessions.retain(|s| s.date != date);
    match internal_save(&state.app, &data) {
        Ok(_) => StatusCode::OK,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}
