# SpikeSense Folder Structure

## Complete Project Structure

```
SpikeSense/
├── app/                          # React Native app screens (Expo Router)
│   ├── _layout.tsx              # Root layout with theme provider
│   ├── (tabs)/                  # Tab navigation group
│   │   ├── _layout.tsx          # Tab layout configuration
│   │   ├── (home)/              # Home/Dashboard tab
│   │   │   ├── _layout.tsx      # Home layout
│   │   │   └── index.tsx        # Dashboard screen
│   │   └── profile.tsx          # Settings/Profile screen
│   ├── modal.tsx                # Modal demo screen
│   ├── formsheet.tsx            # Form sheet demo screen
│   └── transparent-modal.tsx    # Transparent modal demo
│
├── backend/                      # Flask backend server
│   ├── app.py                   # Main Flask application
│   ├── models.py             # Database models (SQLAlchemy)
│   ├── requirements.txt      # Python dependencies
│   ├── .env.example          # Environment variables template
│   ├── .gitignore           # Git ignore rules
│   ├── ai_module/           # AI/ML components
│   │   ├── __init__.py
│   │   ├── pattern_detector.py    # Pattern detection engine
│   │   └── nudge_engine.py        # Nudge generation engine
│   └── utils/                # Utility functions
│       ├── __init__.py
│       └── validators.py         # Input validation
│
├── components/                  # Reusable UI components
│   ├── AppUsageList.tsx        # App usage list component
│   ├── BadgeCard.tsx           # Badge display card
│   ├── BodyScrollView.tsx      # Custom scroll view
│   ├── button.tsx              # Button component
│   ├── ChallengeCard.tsx       # Challenge card
│   ├── DoughnutChart.tsx       # Doughnut chart component
│   ├── FloatingTabBar.tsx      # Custom floating tab bar
│   ├── FocusModeCard.tsx       # Focus mode card
│   ├── IconCircle.tsx          # Icon circle component
│   ├── IconSymbol.tsx          # Icon symbol component
│   ├── IconSymbol.ios.tsx      # iOS-specific icon
│   ├── ListItem.tsx            # List item component
│   ├── NudgeCard.tsx           # Nudge card component
│   ├── StatCard.tsx            # Statistics card
│   ├── StreakCard.tsx          # Streak card
│   ├── Svg.tsx                 # SVG component
│   └── WeeklyChart.tsx         # Weekly chart component
│
├── services/                    # Service layer
│   ├── api.ts                  # API service (HTTP client)
│   └── appUsageTracker.ts     # App usage tracking service
│
├── hooks/                       # React hooks
│   └── useAppUsageTracking.ts # Main tracking hook
│
├── types/                       # TypeScript type definitions
│   └── appUsage.ts            # App usage types
│
├── utils/                       # Utility functions
│   ├── errorLogger.ts         # Error logging utility
│   ├── mockDataGenerator.ts   # Mock data generation
│   └── permissions.ts         # Permission handling
│
├── contexts/                    # React contexts
│   └── WidgetContext.tsx      # Widget context (iOS)
│
├── styles/                      # Style definitions
│   └── commonStyles.ts        # Common styles and colors
│
├── constants/                   # Constants
│   └── Colors.ts              # Color constants
│
├── assets/                      # Static assets
│   ├── fonts/                  # Custom fonts
│   │   ├── SpaceMono-Bold.ttf
│   │   ├── SpaceMono-BoldItalic.ttf
│   │   ├── SpaceMono-Italic.ttf
│   │   └── SpaceMono-Regular.ttf
│   └── images/                 # Images
│       ├── final_quest_240x240__.png
│       ├── final_quest_240x240.png
│       └── natively-dark.png
│
├── docs/                        # Documentation
│   ├── API_DOCUMENTATION.md    # API endpoint documentation
│   ├── INSTALLATION.md        # Installation guide
│   ├── PROJECT_REPORT.md      # Full project report
│   └── FOLDER_STRUCTURE.md    # This file
│
├── android/                     # Android native code
│   └── app/src/main/
│       └── AndroidManifest.xml # Android manifest with permissions
│
├── babel-plugins/              # Babel plugins
│   ├── config.js
│   ├── editable-elements.js
│   ├── inject-source-location.js
│   └── react/
│
├── public/                      # Public web assets
│   ├── favicon.ico
│   ├── index.html
│   ├── logo192x192.png
│   ├── logo512x512.png
│   └── manifest.json
│
├── package.json                 # Node.js dependencies
├── tsconfig.json               # TypeScript configuration
├── babel.config.js             # Babel configuration
├── metro.config.js            # Metro bundler configuration
├── app.json                    # Expo configuration
├── eas.json                    # EAS Build configuration
├── workbox-config.js           # Workbox service worker config
├── index.ts                    # Entry point
└── README.md                   # Main README
```

## Key Directories Explained

### `/app`
Expo Router-based navigation structure. Uses file-based routing where folders represent routes.

### `/backend`
Flask Python backend with:
- **app.py**: Main application entry point
- **models.py**: Database schema definitions
- **ai_module/**: Pattern detection and nudge generation
- **utils/**: Helper functions

### `/components`
Reusable React Native components for UI elements.

### `/services`
Business logic layer:
- **api.ts**: HTTP client for backend communication
- **appUsageTracker.ts**: Real-time usage tracking service

### `/hooks`
Custom React hooks for state management and side effects.

### `/types`
TypeScript type definitions for type safety.

### `/utils`
Utility functions for permissions, data generation, error handling.

### `/docs`
Complete project documentation including API docs, installation guide, and project report.

## File Naming Conventions

- **Components**: PascalCase (e.g., `NudgeCard.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useAppUsageTracking.ts`)
- **Services**: camelCase (e.g., `api.ts`)
- **Utils**: camelCase (e.g., `permissions.ts`)
- **Types**: camelCase (e.g., `appUsage.ts`)
- **Backend Python**: snake_case (e.g., `pattern_detector.py`)

## Import Path Aliases

Configured in `tsconfig.json` and `babel.config.js`:
- `@/` → Root directory
- `@components` → `./components`
- `@hooks` → `./hooks`
- `@types` → `./types`
- `@contexts` → `./contexts`

## Database Files

Database files are not included in the repository:
- SQLite: `backend/spikesense.db` (development)
- PostgreSQL: Managed by database server (production)

## Environment Files

- `backend/.env`: Backend environment variables (not in git)
- `.env`: Frontend environment variables (optional, not in git)

## Build Output

- `node_modules/`: Node.js dependencies (not in git)
- `backend/venv/`: Python virtual environment (not in git)
- `.expo/`: Expo build cache (not in git)
- `dist/`: Build output (not in git)

