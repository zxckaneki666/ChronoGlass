# 🚀 ChronoGlass API: The Complete Technical Specification

This document provides the absolute, non-omitted documentation for the ChronoGlass REST API.

*   **Host:** `127.0.0.1`
*   **Port:** `45321`
*   **Current Context:** February 2026

---

## 🔍 1. GET /data
**Description:** Returns the entire application state, including all history and all settings.

*   **URL:** `GET http://127.0.0.1:45321/data`
*   **Response (200 OK):**
```json
{
  "sessions": [
    {
      "id": "feb-session-001",
      "startTime": 1739088000000,
      "endTime": 1739095200000,
      "date": "2026-02-09",
      "subActivities": [
        {
          "id": "task-alpha-1",
          "title": "Backend Refactoring",
          "startTime": 1739088000000,
          "endTime": 1739091600000
        },
        {
          "id": "task-alpha-2",
          "title": "UI Bugfix",
          "startTime": 1739091600000,
          "endTime": 1739095200000
        }
      ]
    },
    {
      "id": "feb-session-002",
      "startTime": 1739174400000,
      "endTime": null,
      "date": "2026-02-10",
      "subActivities": [
        {
          "id": "task-beta-1",
          "title": "Currently Active Research",
          "startTime": 1739174400000,
          "endTime": null
        }
      ]
    }
  ],
  "settings": {
    "weeklyHoursTarget": 40,
    "userName": "Arthur"
  }
}
```

---

## 📅 2. GET /data/day/:date
**Description:** Returns an array of sessions for a specific day.

*   **URL:** `GET http://127.0.0.1:45321/data/day/2026-02-09`
*   **Response (200 OK):**
```json
[
  {
    "id": "feb-session-001",
    "startTime": 1739088000000,
    "endTime": 1739095200000,
    "date": "2026-02-09",
    "subActivities": [
      {
        "id": "task-alpha-1",
        "title": "Backend Refactoring",
        "startTime": 1739088000000,
        "endTime": 1739091600000
      },
      {
        "id": "task-alpha-2",
        "title": "UI Bugfix",
        "startTime": 1739091600000,
        "endTime": 1739095200000
      }
    ]
  }
]
```

---

## 🗓️ 3. GET /data/week/:year/:week
**Description:** Returns sessions for a specific ISO week. (Feb 9, 2026, is the start of ISO Week 7).

*   **URL:** `GET http://127.0.0.1:45321/data/week/2026/7`
*   **Response (200 OK):**
```json
[
  {
    "id": "feb-session-001",
    "startTime": 1739088000000,
    "endTime": 1739095200000,
    "date": "2026-02-09",
    "subActivities": [
      {
        "id": "task-alpha-1",
        "title": "Backend Refactoring",
        "startTime": 1739088000000,
        "endTime": 1739091600000
      }
    ]
  }
]
```

---

## 📥 4. POST /data/append
**Description:** Adds a new session or updates an existing one if the `id` matches.

*   **URL:** `POST http://127.0.0.1:45321/data/append`
*   **Request Body (Full Example):**
```json
{
  "id": "new-session-xyz",
  "startTime": 1739116800000,
  "endTime": 1739124000000,
  "date": "2026-02-09",
  "subActivities": [
    {
      "id": "subtask-999",
      "title": "Manual API Injection",
      "startTime": 1739116800000,
      "endTime": 1739120400000
    },
    {
      "id": "subtask-1000",
      "title": "Final Testing",
      "startTime": 1739120400000,
      "endTime": 1739124000000
    }
  ]
}
```
*   **Response:** `201 Created` (The session is added/updated in the UI immediately).

---

## 💾 5. POST /data/overwrite
**Description:** Destructive write. Replaces the entire local database file.

*   **URL:** `POST http://127.0.0.1:45321/data/overwrite`
*   **Request Body (Full Example):**
```json
{
  "sessions": [
    {
      "id": "reset-session-001",
      "startTime": 1738368000000,
      "endTime": 1738371600000,
      "date": "2026-02-01",
      "subActivities": [
        {
          "id": "task-reset-1",
          "title": "Database Restoration",
          "startTime": 1738368000000,
          "endTime": 1738371600000
        }
      ]
    }
  ],
  "settings": {
    "weeklyHoursTarget": 35,
    "userName": "Arthur Admin"
  }
}
```
*   **Response:** `200 OK` (The entire application UI reloads to show this new state).

---

## 🗑️ 6. DELETE /data/all
**Description:** Deletes all history.

*   **URL:** `DELETE http://127.0.0.1:45321/data/all`
*   **Logic:** The `sessions` array is set to `[]`. Settings are preserved.
*   **Internal Result in data.json:**
```json
{
  "sessions": [],
  "settings": {
    "weeklyHoursTarget": 40,
    "userName": "Arthur"
  }
}
```
*   **Response:** `200 OK`

---

## 🗑️ 7. DELETE /data/day/:date
**Description:** Deletes all sessions for a specific day.

*   **URL:** `DELETE http://127.0.0.1:45321/data/day/2026-02-09`
*   **Response:** `200 OK`

---

## 🗑️ 8. DELETE /data/range?start=...&end=...
**Description:** Bulk delete within a specific period.

*   **URL:** `DELETE http://127.0.0.1:45321/data/range?start=2026-02-01&end=2026-02-28`
*   **Logic:** Removes every session where the date falls within February 2026.
*   **Response:** `200 OK`

---

## 🧠 Logic & Constraints Checklist

1.  **Time Units:** All timestamps (`startTime`, `endTime`) are integers representing milliseconds since the Unix epoch.
2.  **Date Format:** The `date` field in `WorkSession` must always be exactly `YYYY-MM-DD`.
3.  **Active Sessions:** To represent a session currently in progress, set `endTime: null` inside the `WorkSession` and the last `SubActivity`.
4.  **Instant UI Updates:** Every successful `POST` or `DELETE` triggers a `tauri::Emitter` signal. If you have the ChronoGlass window open, it will re-render the moment the API returns `200/201`.
5.  **Strict Validation:** Sending a `POST` request with a missing field or a string where a number is expected will result in an immediate `400 Bad Request` or `422 Unprocessable Entity`. No data will be written.
6.  **Concurrency:** The server is built on `axum` and `tokio`. It can handle multiple concurrent requests safely while ensuring the integrity of the `data.json` file.
