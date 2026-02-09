# 🕰️ ChronoGlass

### *Vision Pro Inspired Time Tracker*

<p align="center">
  <img src="banner.jpg" alt="ChronoGlass Banner" width="100%">
</p>

**ChronoGlass** is a high-fidelity time-tracking application inspired by the Apple Vision Pro aesthetic. It combines a stunning **Glassmorphism** interface with a high-performance **Rust** engine to provide seamless work-hour monitoring, overtime calculation, and deep productivity analytics.

---

## ✨ Key Features

* 💎 **Glassmorphism UI**: A translucent, frosted-glass interface with adaptive blurring and sleek animations.
* 📊 **Overtime Balance**: Automatic calculation of "Time Debt/Credit" based on your weekly targets.
* ⏱️ **Activity Logging**: Track specific tasks within your work sessions for granular reporting.
* 🚀 **Built-in REST API**: Control your data, start timers, or trigger updates via external scripts.
* ⚡ **Tauri v2 Core**: Built with Rust for native performance, minimal RAM usage, and maximum security.

---

## 🛠 Setup & Installation

### Prerequisites

Ensure you have [Rust](https://www.rust-lang.org/) and [pnpm](https://pnpm.io/) installed.

### Development

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Run in development mode (Vite + Tauri Dev):
   ```bash
   pnpm dev
   ```

### Production Build

Generate a platform-specific installer (exe, dmg, or deb):

```bash
pnpm tauri build
```

---

## 📦 Data Structures (JSON Models)

Integrate with the API using these strictly typed objects.

<details>
<summary>🟦 <b>WorkSession</b> (Single Session Object)</summary>

The primary unit of data.

- `id` (string): Unique UUID for the session.
- `startTime` (number): Start timestamp in milliseconds.
- `endTime` (number | null): End timestamp or `null` if the session is currently active.
- `date` (string): Date in `YYYY-MM-DD` format.
- `subActivities` (Array): List of tasks performed during this session (see below).

</details>

<details>
<summary>🟧 <b>SubActivity</b> (Nested Task)</summary>

Specific activities logged within a WorkSession.

- `id` (string): Unique UUID for the task.
- `title` (string): Descriptive name of the activity.
- `startTime` (number): Task start timestamp.
- `endTime` (number | null): Task end timestamp.

</details>

<details>
<summary>⚙️ <b>AppSettings</b> (Global Config)</summary>

- `weeklyHoursTarget` (number): Your weekly goal (e.g., `40`).
- `userName` (string): The user's display name.

</details>

<details>
<summary>📁 <b>AppData</b> (Root Database Object)</summary>

This is the object structure used for full data overwrites.

```json
{
  "sessions": [
    {
      "id": "uuid",
      "startTime": 1700000000000,
      "endTime": 1700003600000,
      "date": "2024-03-20",
      "subActivities": []
    }
  ],
  "settings": {
    "weeklyHoursTarget": 40,
    "userName": "Arthur"
  }
}
```

</details>

---

## 🔌 ChronoGlass API Documentation

The application automatically hosts a local REST server on port **45321**.

**Base URL:** `http://127.0.0.1:45321`

### 📋 Endpoints

<details>
<summary>📂 <b>Global Data Management</b></summary>

#### `GET /data`
* **Description:** Retrieves the entire database (all sessions and settings).

#### `POST /data/overwrite`
* **Description:** Completely overwrites the local database.
* **Body:** `AppData` object.
* **Logic:** The Rust backend validates the JSON structure. If valid, the file is overwritten, and the UI is instantly notified to refresh.

#### `DELETE /data/all`
* **Description:** Wipes all work sessions while keeping user settings intact.

</details>

<details>
<summary>📅 <b>Filtering & Retrieval</b></summary>

#### `GET /data/day/:date`
* **Parameter:** `:date` (e.g., `2024-03-20`).
* **Response:** An array of `WorkSession` objects for that specific day.

#### `GET /data/week/:year/:week`
* **Parameters:** Year and ISO week number.
* **Description:** High-performance filtering performed on the Rust side for dashboard stats.

</details>

<details>
<summary>📝 <b>Session Management (CRUD)</b></summary>

#### `POST /data/append`
* **Description:** Add or Update a single session.
* **Body:** `WorkSession` object.
* **Logic:** If the `id` exists, the session is updated. If not, it is appended. This is the recommended way to sync external trackers without data loss.

#### `DELETE /data/day/:date`
* **Description:** Deletes all session entries for the specified date.

#### `DELETE /data/range?start=...&end=...`
* **Query Params:** `start` and `end` (format `YYYY-MM-DD`).
* **Description:** Mass-deletes data within the specified date range.

</details>

---

## 🧩 Internal Sync Logic

1. **Backend (Rust/Axum)**: Receives the HTTP request and validates the JSON payload.
2. **Storage**: Commits the data to the system's local app-data directory (e.g., `~/.local/share/chronoglass/data.json` on Linux).
3. **Event Bus**: The Rust core emits an `external-data-update` event via the Tauri event system.
4. **Frontend (React)**: Listens for the event and triggers an immediate UI re-render. **No page reloads required.**

---

## 🎨 Tech Stack

* **Frontend**: React 18, TypeScript, Vite 6.
* **Backend**: Tauri v2, Rust (Axum, Tokio, Chrono).
* **Styling**: Tailwind CSS + Framer Motion (Glassmorphism).

---
<div align="center">
  Built with ❤️ using <b>pnpm</b> and <b>Rust</b>.
</div>
