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

**Backend won't start?**
- Check Python version: `python3 --version`
- Verify dependencies: `pip list`
- Check port 5000 is available

**Mobile app won't connect?**
- Verify backend is running
- For Android emulator, use `http://10.0.2.2:5000/api` in `services/api.ts`
- Check CORS settings in backend

**No data showing?**
- Check permissions are granted
- Verify backend is receiving requests (check logs)
- Try restarting both services

## Next Steps

- Read [INSTALLATION.md](INSTALLATION.md) for detailed setup
- Check [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for API details
- Review [PROJECT_REPORT.md](PROJECT_REPORT.md) for architecture

## Need Help?

- Check the [README.md](../README.md)
- Review [DEPLOYMENT.md](DEPLOYMENT.md) for production setup
- Open an issue on GitHub

Happy tracking! 🎉



