# SpikeSense Quick Start Guide

Get up and running with SpikeSense in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- Python 3.9+ installed
- PostgreSQL (or use SQLite for quick testing)

## Step 1: Clone and Install

```bash
# Clone repository
git clone https://github.com/yourusername/SpikeSense.git
cd SpikeSense

# Install mobile app dependencies
npm install

# Set up backend
cd backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Step 2: Configure Database

### Option A: SQLite (Quick Start)

No setup needed! The app will use SQLite by default in development.

### Option B: PostgreSQL

```bash
# Create database
createdb spikesense_db

# Update backend/.env
DATABASE_URL=postgresql://localhost/spikesense_db
```

## Step 3: Start Backend

```bash
cd backend
source venv/bin/activate
python app.py
```

Backend should be running at `http://localhost:5000`

## Step 4: Start Mobile App

In a new terminal:

```bash
cd SpikeSense
npm run dev
```

Scan QR code with Expo Go app, or press `i` for iOS simulator / `a` for Android emulator.

## Step 5: Test It Out!

1. Open the app
2. Grant permissions (Android: Usage Access in Settings)
3. Use your phone normally
4. Check the dashboard for insights
5. Receive nudges when patterns are detected

## Troubleshooting

**QR code shows "No usable data found" in Expo Go?**
- The QR may be for a development build instead of Expo Go. Use the **Expo Go**–compatible URL:
  - Run: `npm run dev` (uses `--go` so the QR works with Expo Go), or
  - Run: `npm run dev:lan` (same WiFi only, no tunnel), then scan the LAN QR.
- Ensure your Expo Go app is up to date.
- If it still fails, open Expo Go manually and type the URL shown in the terminal (e.g. `exp://192.168.x.x:8081`).

**Backend won't start?**
- Check Python version: `python3 --version`
- Verify dependencies: `pip list`
- Check port 5000 is available

**Mobile app won't connect?**
- Ensure the backend is running first (`cd backend && python app.py`).
- **iOS Simulator**: uses `http://localhost:5000/api` automatically.
- **Android Emulator**: uses `http://10.0.2.2:5000/api` automatically (no code change needed).
- **Physical device**: the phone must reach your computer. Set your machine’s LAN IP (e.g. `192.168.1.5`) and run the app with `EXPO_PUBLIC_API_URL=http://192.168.1.5:5000/api npm run dev`, or add `EXPO_PUBLIC_API_URL=http://YOUR_IP:5000/api` to a `.env` in the project root.
- Confirm CORS is enabled in the backend (it allows all origins in development).

**No data showing?**
- Check permissions are granted
- Verify backend is receiving requests (check logs)
- Try restarting both services

**Clear the database and start afresh?**
- From the `backend` folder with your venv activated: `python clear_db.py`
- Or, if you use SQLite only: delete the file `backend/spikesense_dev.sqlite`; the next time you run the backend, tables will be recreated empty.

## Next Steps

- Read [INSTALLATION.md](INSTALLATION.md) for detailed setup
- Check [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for API details
- Review [PROJECT_REPORT.md](PROJECT_REPORT.md) for architecture

## Need Help?

- Check the [README.md](../README.md)
- Review [DEPLOYMENT.md](DEPLOYMENT.md) for production setup
- Open an issue on GitHub

Happy tracking! 🎉



