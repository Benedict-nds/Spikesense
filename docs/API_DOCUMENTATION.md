# SpikeSense API Documentation

## Base URL

- **Development**: `http://localhost:5000/api`
- **Production**: `https://your-production-api.com/api`

## Authentication

Currently, the API uses user IDs for identification. In production, implement proper authentication (JWT tokens, OAuth, etc.).

## Endpoints

### Health Check

#### `GET /api/health`

Check API health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

---

### User Management

#### `POST /api/users`

Create a new user.

**Request Body:**
```json
{
  "device_id": "android_abc123_1234567890",
  "name": "John Doe",
  "email": "john@example.com",
  "mode_preference": "balanced"
}
```

**Response:**
```json
{
  "success": true,
  "user_id": 1,
  "message": "User created successfully"
}
```

#### `GET /api/users/:user_id`

Get user profile.

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "device_id": "android_abc123_1234567890",
    "name": "John Doe",
    "email": "john@example.com",
    "mode_preference": "balanced",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

#### `POST /api/users/:user_id/mode`

Update user's mode preference.

**Request Body:**
```json
{
  "mode": "supportive"
}
```

**Valid modes:** `supportive`, `motivational`, `restrictive`, `balanced`

**Response:**
```json
{
  "success": true,
  "message": "Mode updated",
  "mode": "supportive"
}
```

---

### App Usage Tracking

#### `POST /api/users/:user_id/usage`

Log app usage data.

**Request Body:**
```json
{
  "app_name": "Instagram",
  "category": "social",
  "duration_minutes": 15.5,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Valid categories:** `productivity`, `social`, `entertainment`, `other`

**Response:**
```json
{
  "success": true,
  "pattern_detected": true,
  "pattern_type": "rapid_switching",
  "nudge": {
    "type": "insight",
    "message": "You've been switching apps frequently...",
    "severity": "medium",
    "action_label": "Start Focus Session",
    "action_type": "focus_mode"
  }
}
```

#### `POST /api/users/:user_id/app-switch`

Log an app switch event.

**Request Body:**
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "switch_count": 12,
  "pattern_detected": false,
  "nudge": null
}
```

---

### Nudges

#### `GET /api/users/:user_id/nudges`

Get pending nudges for a user.

**Response:**
```json
{
  "success": true,
  "nudges": [
    {
      "id": 1,
      "type": "insight",
      "message": "You've been switching apps frequently...",
      "severity": "medium",
      "action_label": "Start Focus Session",
      "action_type": "focus_mode",
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

#### `POST /api/users/:user_id/nudges/:nudge_id/dismiss`

Dismiss a nudge.

**Response:**
```json
{
  "success": true,
  "message": "Nudge dismissed"
}
```

---

### Statistics

#### `GET /api/users/:user_id/stats/daily`

Get daily statistics for a user.

**Query Parameters:**
- `date` (optional): Date in ISO format (YYYY-MM-DD). Defaults to today.

**Response:**
```json
{
  "success": true,
  "stats": {
    "date": "2024-01-15",
    "total_screen_time": 240,
    "app_switches": 45,
    "productivity_time": 120,
    "social_time": 60,
    "entertainment_time": 45,
    "other_time": 15,
    "focus_score": 75.5
  }
}
```

---

### Personalized Thresholds

#### `GET /api/users/:user_id/thresholds`

Get personalized thresholds for a user.

**Response:**
```json
{
  "success": true,
  "thresholds": {
    "switch_threshold": 15,
    "entertainment_threshold": 60,
    "break_interval": 45,
    "rapid_switching_window": 10,
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

#### `POST /api/users/:user_id/thresholds`

Update personalized thresholds (AI learning).

**Request Body:**
```json
{
  "switch_threshold": 18,
  "entertainment_threshold": 75,
  "break_interval": 45,
  "rapid_switching_window": 10
}
```

**Response:**
```json
{
  "success": true,
  "message": "Thresholds updated",
  "thresholds": {
    "switch_threshold": 18,
    "entertainment_threshold": 75,
    "break_interval": 45,
    "rapid_switching_window": 10
  }
}
```

---

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

**HTTP Status Codes:**
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation error)
- `404`: Not Found
- `500`: Internal Server Error

---

## Pattern Detection

The API automatically detects overstimulation patterns when logging app usage:

### Pattern Types

1. **rapid_switching**: High frequency of app switches
2. **entertainment_overload**: Prolonged entertainment app usage
3. **cognitive_overload**: Combination of high switching and entertainment

### Severity Levels

- `low`: Minor pattern detected
- `medium`: Moderate pattern requiring attention
- `high`: Severe pattern requiring intervention

---

## Nudge Types

1. **insight**: Informational nudge with context
2. **challenge**: Motivational challenge
3. **restriction**: Suggestion for restrictive action (focus mode, etc.)

---

## Rate Limiting

Currently, there are no rate limits. In production, implement rate limiting to prevent abuse.

---

## Data Privacy

- All data is stored securely
- User data is not shared with third parties
- Users can request data deletion
- Data is encrypted in transit (HTTPS) and at rest

