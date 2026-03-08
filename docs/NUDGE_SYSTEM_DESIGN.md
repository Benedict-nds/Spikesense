# Nudge System Architecture & Design

A production-MVP design for robust nudge generation, deduplication, persistence, and dual-channel delivery (in-app + system notifications).

---

## 1. Architecture Overview

The system is split into three clear layers:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Delivery layer                                                          │
│  • GET /nudges → returns only pending, deduplicated, with full meta     │
│  • Frontend: in-app cards + (optional) system push via existing logic   │
└─────────────────────────────────────────────────────────────────────────┘
                                    ▲
┌─────────────────────────────────────────────────────────────────────────┐
│  Nudge instance layer                                                     │
│  • One row per “logical” nudge (state: pending | delivered | dismissed)  │
│  • Channel flags: deliver_in_app, deliver_push (for same instance)         │
└─────────────────────────────────────────────────────────────────────────┘
                                    ▲
┌─────────────────────────────────────────────────────────────────────────┐
│  Rule evaluation layer                                                   │
│  • Only create nudge when conditions are met (e.g. switch_count ≥ threshold) │
│  • Cooldown: do not create same nudge type for same user within N min   │
│  • Embed computed values (switch_count, time_window_minutes) in payload    │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Rule evaluation**: Decides *whether* to create a nudge (thresholds, minimum conditions).
- **Nudge instance creation**: Single record per logical event, with state and channel flags.
- **Delivery**: API returns only relevant instances; frontend shows in-app and/or triggers OS notifications based on `push` (or equivalent) and never shows raw placeholders.

---

## 2. Database Schema

### 2.1 Nudges table (revised)

Keep one row per logical nudge. Add state, channel flags, and a JSON `meta` so the API contract is clean and the frontend never needs to guess values.

```sql
-- nudges
id                  INTEGER PRIMARY KEY
user_id             INTEGER NOT NULL REFERENCES users(id)
type                VARCHAR(50) NOT NULL   -- e.g. 'app_switching', 'entertainment_overload'
message             TEXT NOT NULL           -- final message with values already interpolated
meta                JSON NOT NULL DEFAULT '{}'  -- e.g. {"switch_count": 18, "time_window_minutes": 60}
severity            VARCHAR(20) DEFAULT 'medium'
action_label        VARCHAR(100)
action_type         VARCHAR(50)
state               VARCHAR(20) NOT NULL DEFAULT 'pending'  -- pending | delivered | dismissed
deliver_in_app      BOOLEAN NOT NULL DEFAULT true
deliver_push         BOOLEAN NOT NULL DEFAULT false        -- system notification
dismissed           BOOLEAN NOT NULL DEFAULT false        -- kept for backward compatibility
dismissed_at        DATETIME
created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
time_window_start   DATETIME                               -- optional: window this nudge refers to
time_window_minutes INTEGER                                -- optional: 60 for "last hour"
cooldown_key        VARCHAR(100)                           -- for dedupe: e.g. "app_switching:60:2025-01-27T14"
```

- **state**: `pending` → can be shown; `delivered` → already shown (optional, for analytics); `dismissed` → user dismissed (or map `dismissed` to this).
- **deliver_in_app** / **deliver_push**: Same nudge instance can be delivered in-app only, push only, or both.
- **meta**: Always populated by the backend with the exact numbers used (e.g. `switch_count`, `time_window_minutes`). Frontend can render without fallbacks.
- **cooldown_key**: Used to enforce “same type + same window” cooldown (see below).

### 2.2 Optional: nudge_deliveries (if you want per-channel tracking)

For an MVP you can skip this and infer from `state` + `deliver_in_app` / `deliver_push`. If you want to record each channel separately:

```sql
-- nudge_deliveries (optional)
id          INTEGER PRIMARY KEY
nudge_id    INTEGER NOT NULL REFERENCES nudges(id)
channel     VARCHAR(20) NOT NULL   -- 'in_app' | 'push'
delivered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
```

---

## 3. Nudge Rule and Deduplication Logic (Pseudocode)

### 3.1 Rule: “Frequent app switching / cognitive overload”

- **Condition**: Only create this nudge when **switch_count ≥ threshold** (e.g. user’s `switch_threshold` from `user_thresholds`, default 15 per hour).
- **Inputs**: `switch_count` = actual count in the window; `time_window_minutes` (e.g. 60); `user_id`, `user_thresholds`.
- **Output**: Either no nudge, or one nudge payload with **guaranteed** `meta.switch_count` and `meta.time_window_minutes`.

```text
FUNCTION should_create_switching_nudge(switch_count, time_window_minutes, user_thresholds):
    threshold = user_thresholds.switch_threshold  // default 15
    IF switch_count < threshold:
        RETURN false
    switches_per_hour = (switch_count / time_window_minutes) * 60
    IF switches_per_hour < threshold:
        RETURN false
    RETURN true
```

- **Severity** can still be derived from how far above threshold (e.g. ≥ 1.5× → high, else medium).
- **Message**: Use a template with placeholders; interpolate with **actual** `switch_count` and `time_window_minutes` before saving. Store the **final** message and the same values in `meta`.

### 3.2 Cooldown (prevent same nudge type repeatedly)

- **Goal**: For the same user and same nudge type (and optionally same time window), do not create another instance within a cooldown period (e.g. 60–120 minutes).
- **Key**: e.g. `cooldown_key = f"{nudge_type}:{time_window_minutes}:{window_start_iso}"` or a rounded time bucket (e.g. hour).

```text
FUNCTION can_create_nudge(user_id, nudge_type, time_window_minutes, window_start):
    cooldown_minutes = 90   // e.g. 90 minutes
    key = "{nudge_type}:{time_window_minutes}:{window_start to hour}"
    recent = DB.query(
        SELECT 1 FROM nudges
        WHERE user_id = ? AND cooldown_key = ? AND created_at > now() - cooldown_minutes
        LIMIT 1
    )
    RETURN recent is empty
```

- Before creating a new nudge, call `can_create_nudge(...)`. If false, skip creation (and do not add a duplicate row).

### 3.3 Deduplication in the same response

- **Goal**: The same “logical” nudge (same type + same time window) must not appear twice in one `GET /nudges` response.
- **Option A**: At creation time, avoid creating duplicates (cooldown + “only when crossing threshold” logic) so the DB never has two identical logical nudges in `pending`.
- **Option B**: When building the API response, group by `(type, time_window_start)` or by `cooldown_key` and return one representative nudge per group (e.g. most recent).

```text
FUNCTION get_pending_nudges_for_user(user_id):
    rows = DB.query(
        SELECT * FROM nudges
        WHERE user_id = ? AND state = 'pending' AND dismissed = false
        AND created_at > now() - 24 hours
        ORDER BY created_at DESC
    )
    seen_keys = {}
    deduped = []
    FOR n IN rows:
        key = n.cooldown_key OR (n.type + ":" + n.created_at to hour)
        IF key NOT IN seen_keys:
            seen_keys[key] = true
            deduped.append(n)
    RETURN deduped
```

---

## 4. Example API Response: “Frequent app switching” nudge

Backend must always send a **fully interpolated** message and a **meta** object with every value the frontend might need, so the UI never shows `{switch_count}` or falls back to 0.

```json
{
  "success": true,
  "nudges": [
    {
      "id": 42,
      "type": "app_switching",
      "message": "You've switched apps 18 times in the last hour — that's a sign of cognitive overload. Let's take a moment to breathe and refocus.",
      "meta": {
        "switch_count": 18,
        "time_window_minutes": 60,
        "switches_per_hour": 18,
        "threshold": 15
      },
      "severity": "medium",
      "action_label": "Take a Break",
      "action_type": "take_break",
      "created_at": "2025-01-27T14:30:00Z",
      "dismissed": false,
      "push": true
    }
  ]
}
```

- **message**: Already interpolated; no placeholders.
- **meta**: Contains the actual numbers; frontend can use them for UI (e.g. secondary text) or re-interpolation if you add new placeholders later.
- **push**: Tells the client whether to also send a system-level notification for this nudge (dual-channel).

---

## 5. Dismiss / Acknowledgement: Frontend ↔ Backend

- **Backend** stores nudge state: `state = 'dismissed'` and `dismissed_at = now()` (and optionally `dismissed = true` for backward compatibility).
- **Frontend** calls the existing endpoint when the user dismisses or acts:

```text
POST /api/users/:user_id/nudges/:nudge_id/dismiss
```

- Backend:
  1. Load nudge by `user_id` and `nudge_id`.
  2. Set `state = 'dismissed'`, `dismissed = true`, `dismissed_at = now()`.
  3. Commit and return 200.

- **GET /nudges** must only return nudges where `state = 'pending'` (and not dismissed). So after dismiss, that nudge never appears again. No re-sending the same nudge unless a **new** logical event occurs after cooldown.

Optional extension: an “acted” endpoint (e.g. user tapped “Start Focus Session”) so you can record that separately from “dismissed” (e.g. `state = 'acted'`). For MVP, a single dismiss endpoint is enough.

---

## 6. Two Delivery Channels (In-App + System Notifications)

- **Same nudge instance** can be delivered in both channels:
  - **In-app**: Shown in the Notifications / Nudges list when the client polls `GET /nudges`.
  - **System (OS)**: Client uses `push: true` (or equivalent) to schedule a local (or push) notification with the same `message` and optional deep link.

- **Backend** does not send push itself; it only:
  - Marks the nudge with `deliver_push = true` (or includes `push: true` in the API).
  - Ensures `message` and `meta` are complete so the client can safely show the same text in-app and in the system notification.

- **Frontend** (already in place): When it receives nudges with `push === true`, it schedules a system notification (Android) and shows the same nudge in-app. Tapping the system notification opens the app (e.g. to the Nudges tab).

This keeps the nudge engine **channel-aware** (it decides *whether* to request in-app and/or push) while delivery is implemented on the client.

---

## 7. Summary Checklist

| Requirement | Approach |
|------------|----------|
| Frequent-switching nudge only when switch_count ≥ threshold | Rule: `switch_count >= user_thresholds.switch_threshold` and per-hour rate ≥ threshold before creating. |
| Embed switch_count and time window in payload | Always set `meta.switch_count`, `meta.time_window_minutes` (and optionally `switches_per_hour`, `threshold`). Interpolate message before saving. |
| No duplicates in one response | Cooldown at creation + optional response dedupe by `cooldown_key` (or type + window). |
| Same nudge not repeated without cooldown | `can_create_nudge()` checks for recent row with same `cooldown_key` within 90 min. |
| Persist state (pending / delivered / dismissed) | `state` + `dismissed` / `dismissed_at` on `nudges` table. |
| Dismiss/ack from frontend | Existing `POST .../nudges/:id/dismiss`; GET only returns `state = 'pending'` and not dismissed. |
| Clean API contract, no missing placeholders | Store interpolated message; always return `meta` with every value used. |
| Dual channel (in-app + system) | `deliver_in_app` / `deliver_push` (or `push`) on nudge; client shows in-app and optionally sends OS notification when `push` is true. |

This design is suitable for a student project or MVP: minimal schema changes, clear separation of rules vs instances vs delivery, and no mock data—all values come from real evaluation and stored `meta`.
