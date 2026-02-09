mod api;

use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, Runtime, Emitter};

// Хелпер для пути к данным (используется и тут, и в api.rs через AppHandle)
fn get_data_path<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("failed to get app data dir")
        .join("data.json")
}

#[tauri::command]
fn save_data<R: Runtime>(app: AppHandle<R>, content: String) -> Result<(), String> {
    let path = get_data_path(&app);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(path, content).map_err(|e| e.to_string())?;
    // Оповещаем фронт, если данные изменились "изнутри"
    let _ = app.emit("external-data-update", ());
    Ok(())
}

#[tauri::command]
fn load_data<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    let path = get_data_path(&app);
    if !path.exists() {
        return Ok("{}".to_string());
    }
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn reset_data<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let path = get_data_path(&app);
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    let _ = app.emit("external-data-update", ());
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();

            // 1. Запуск мощного API
            tauri::async_runtime::spawn(async move {
                api::start_server(handle).await;
            });

            // 2. Обработка CLI аргументов
            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 {
                let potential_file = PathBuf::from(&args[1]);
                if potential_file.exists() {
                    if let Ok(content) = fs::read_to_string(&potential_file) {
                        let path = get_data_path(app.handle());
                        if let Some(parent) = path.parent() {
                            let _ = fs::create_dir_all(parent);
                        }
                        let _ = fs::write(path, content);
                        // Оповещаем фронт, что данные загружены из файла при старте
                        let _ = app.handle().emit("external-data-update", ());
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![save_data, load_data, reset_data])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
