# SpikeSense Installation Guide

## Prerequisites

### For Mobile App (React Native)
- Node.js 18+ and npm/yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS: Xcode 14+ (for iOS development)
- Android: Android Studio with Android SDK

### For Backend (Python Flask)
- Python 3.9+
- PostgreSQL 14+ (or SQLite for development)
- pip (Python package manager)

---

## Mobile App Setup

### 1. Install Dependencies

```bash
cd /path/to/SpikeSense
npm install
```

### 2. Configure Environment

Create a `.env` file in the root directory (optional for development):

```env
API_BASE_URL=http://localhost:5000/api
```

### 3. Start Development Server

```bash
# Start Expo development server
npm run dev

# Or for specific platforms
npm run ios      # iOS simulator
npm run android  # Android emulator
npm run web      # Web browser
```

### 4. Android Permissions Setup

For Android app usage tracking:

1. Build the Android app:
```bash
npm run build:android
```

2. Install on device/emulator

3. Enable Usage Access:
   - Go to Settings > Apps > Special access > Usage access
   - Find "SpikeSense" (or "Natively")
   - Enable "Permit usage access"

### 5. iOS Setup

iOS has limitations for app usage tracking. The app uses AppState monitoring as a fallback. For full tracking, you would need:

- Screen Time API entitlements
- Parental Controls framework integration
- App Store approval for usage tracking

---

## Backend Setup

### 1. Create Virtual Environment

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Database Setup

#### Option A: PostgreSQL (Recommended for Production)

```bash
# Install PostgreSQL (if not installed)
# macOS: brew install postgresql
# Ubuntu: sudo apt-get install postgresql

# Create database
createdb spikesense_db

# Create user (optional)
createuser spikesense
```

#### Option B: SQLite (Development)

Update `backend/app.py`:

```python
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///spikesense.db'
```

### 4. Configure Environment

Create `backend/.env`:

```env
DATABASE_URL=postgresql://spikesense:spikesense@localhost/spikesense_db
FLASK_ENV=development
SECRET_KEY=your-secret-key-here
PORT=5000
```

### 5. Initialize Database

```bash
cd backend
python3 -c "from app import app, db; app.app_context().push(); db.create_all()"
```

### 6. Start Backend Server

```bash
# Development
python app.py

# Production (with Gunicorn)
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

The API will be available at `http://localhost:5000`

---

## Full Stack Setup

### 1. Start Backend First

```bash
cd backend
source venv/bin/activate
python app.py
```

### 2. Start Mobile App

In a new terminal:

```bash
cd /path/to/SpikeSense
npm run dev
```

### 3. Configure API URL

Update `services/api.ts` with your backend URL:

```typescript
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:5000/api'  // Development
  : 'https://your-production-api.com/api';  // Production
```

For Android emulator, use `http://10.0.2.2:5000/api` instead of `localhost`.

---

## Production Deployment

### Backend Deployment (Heroku Example)

```bash
# Install Heroku CLI
heroku login

# Create app
heroku create spikesense-api

# Set environment variables
heroku config:set DATABASE_URL=your-postgres-url
heroku config:set SECRET_KEY=your-secret-key
heroku config:set FLASK_ENV=production

# Deploy
git push heroku main

# Run migrations
heroku run python -c "from app import app, db; app.app_context().push(); db.create_all()"
```

### Mobile App Build

#### Android

```bash
# Build APK
eas build --platform android

# Or build locally
cd android
./gradlew assembleRelease
```

#### iOS

```bash
# Build with EAS
eas build --platform ios

# Or build locally (requires macOS)
cd ios
pod install
xcodebuild -workspace Natively.xcworkspace -scheme Natively -configuration Release
```

---

## Troubleshooting

### Backend Issues

**Database Connection Error:**
- Check PostgreSQL is running: `pg_isready`
- Verify DATABASE_URL in `.env`
- Ensure database exists: `psql -l`

**Port Already in Use:**
- Change PORT in `.env`
- Or kill process: `lsof -ti:5000 | xargs kill`

### Mobile App Issues

**API Connection Failed:**
- Check backend is running
- Verify API_BASE_URL in `services/api.ts`
- For Android emulator, use `10.0.2.2` instead of `localhost`
- Check CORS settings in backend

**Permissions Not Working:**
- Android: Ensure Usage Access is enabled in Settings
- iOS: Check Info.plist for required permissions

**Build Errors:**
- Clear cache: `npm start -- --reset-cache`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- For iOS: `cd ios && pod install`

---

## Development Workflow

1. **Start Backend**: `cd backend && python app.py`
2. **Start Mobile App**: `npm run dev`
3. **Make Changes**: Edit files, hot reload will apply changes
4. **Test**: Use Expo Go app or emulator/simulator
5. **Debug**: Check console logs and backend logs

---

## Testing

### Backend Tests

```bash
cd backend
pytest tests/  # If tests are added
```

### Mobile App Tests

```bash
npm test  # If tests are configured
```

---

## Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

