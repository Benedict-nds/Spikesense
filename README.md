# SpikeSense: Digital Wellness & Overstimulation Detection System

A comprehensive mobile application that detects digital overstimulation in students through intelligent pattern recognition, providing gentle nudges and personalized wellness insights.

##  Overview

SpikeSense is a production-ready digital wellness platform that goes beyond simple screen time tracking. It uses intelligent pattern detection to identify cognitive overload through:

- **App-switching frequency analysis**
- **Duration-based engagement tracking**
- **Application category classification** (productivity, social, entertainment, etc.)
- **Adaptive AI-powered threshold learning**

## Key Features

###  Intelligent Detection
- Rule-based baseline model for immediate pattern detection
- Optional lightweight ML model for personalized threshold learning
- Real-time overstimulation pattern recognition
- Context-aware cognitive load assessment

###  Gentle Nudging System
- **Supportive Mode**: Educational insights and awareness
- **Motivational Mode**: Gamification with badges, streaks, and challenges
- **Restrictive Mode**: Optional focus sessions and boundaries
- **Balanced Mode**: Combination of all approaches

###  Comprehensive Dashboard
- Daily and weekly usage statistics
- Category-based breakdown (productivity, social, entertainment)
- Focus score calculation
- App switching frequency visualization
- Trend analysis and insights

###  Privacy-First
- Local data storage with optional cloud sync
- No data sharing with third parties
- User-controlled data retention
- Transparent privacy policies

##  Architecture

### Frontend (React Native + Expo)
- Cross-platform mobile app (iOS, Android, Web)
- Real-time usage tracking
- Beautiful, modern UI with smooth animations
- Offline-first architecture

### Backend (Python Flask)
- RESTful API for data processing
- Pattern detection engine
- Nudge generation system
- User profile management
- Personalized threshold learning

### AI Module
- Pattern detection algorithms
- Adaptive threshold learning
- Context-aware nudge generation
- Behavioral analysis

### Data Storage
- PostgreSQL for production
- SQLite for development
- Local storage for offline support
- Async data synchronization

## 📁 Project Structure

```
SpikeSense/
├── app/                    # React Native app screens
│   ├── (tabs)/            # Tab navigation
│   ├── _layout.tsx        # Root layout
│   └── ...
├── backend/                # Flask backend
│   ├── ai_module/         # AI/ML components
│   ├── models.py          # Database models
│   ├── app.py             # Flask application
│   └── utils/             # Utility functions
├── components/            # Reusable UI components
├── services/              # API and tracking services
├── hooks/                 # React hooks
├── types/                 # TypeScript definitions
├── utils/                 # Utility functions
└── docs/                  # Documentation
```

##  Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+
- PostgreSQL 14+ (or SQLite)
- Expo CLI

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/SpikeSense.git
cd SpikeSense
```

2. **Install mobile app dependencies**
```bash
npm install
```

3. **Set up backend**
```bash
cd backend
python3 -m venv env
source venv/bin/activate
pip install -r requirements.txt
```

4. **Configure environment**
```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your database URL

# Mobile app (optional)
# Create .env in root with API_BASE_URL
```

5. **Initialize database**
```bash
cd backend
python3 -c "from app import app, db; app.app_context().push(); db.create_all()"
```

6. **Start services**
```bash
# Terminal 1: Backend
cd backend
python app.py

# Terminal 2: Mobile App
npm run dev
```

See [INSTALLATION.md](docs/INSTALLATION.md) for detailed setup instructions.

## 📱 Usage

### For Students

1. **Install the app** on your device
2. **Grant permissions** for usage tracking (Android: Usage Access, iOS: Limited)
3. **Choose your mode**: Supportive, Motivational, Restrictive, or Balanced
4. **Receive gentle nudges** when overstimulation patterns are detected
5. **View insights** on your digital wellness dashboard
6. **Track progress** with badges, streaks, and challenges

### For Developers

- **API Documentation**: See [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)
- **Architecture**: See [docs/PROJECT_REPORT.md](docs/PROJECT_REPORT.md)
- **Contributing**: See [CONTRIBUTING.md](CONTRIBUTING.md)

## 🔧 Configuration

### Mobile App

Update `services/api.ts`:
```typescript
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:5000/api'
  : 'https://your-production-api.com/api';
```

### Backend

Edit `backend/.env`:
```env
DATABASE_URL=postgresql://user:pass@localhost/spikesense_db
SECRET_KEY=your-secret-key
FLASK_ENV=development
PORT=5000
```

##  Testing

```bash
# Backend tests
cd backend
pytest tests/

# Mobile app tests
npm test
```

##  Building for Production

### Android
```bash
eas build --platform android
```

### iOS
```bash
eas build --platform ios
```

### Backend
```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

##  Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

##  License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

##  Acknowledgments

- Built with [Expo](https://expo.dev/) and [React Native](https://reactnative.dev/)
- Backend powered by [Flask](https://flask.palletsprojects.com/)
- Database: [PostgreSQL](https://www.postgresql.org/)

##  Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Contact: support@spikesense.app

##  Roadmap

- [ ] Native Android app usage tracking module
- [ ] iOS Screen Time API integration
- [ ] Advanced ML models for personalization
- [ ] Social features (optional, privacy-preserving)
- [ ] Web dashboard
- [ ] Export data functionality
- [ ] Multi-language support

---



