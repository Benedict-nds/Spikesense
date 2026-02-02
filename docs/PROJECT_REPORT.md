# SpikeSense: Digital Overstimulation Detection System
## Project Report

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Problem Statement](#2-problem-statement)
3. [Aims and Objectives](#3-aims-and-objectives)
4. [Literature Review](#4-literature-review)
5. [Methodology](#5-methodology)
6. [System Architecture](#6-system-architecture)
7. [Flow Diagrams](#7-flow-diagrams)
8. [Implementation](#8-implementation)
9. [Testing](#9-testing)
10. [Conclusion](#10-conclusion)
11. [References](#11-references)

---

## 1. Introduction

Digital overstimulation has become a significant concern in modern education, particularly among students who spend extensive time on mobile devices. Traditional screen time tracking applications focus solely on total usage duration, failing to capture the nuanced patterns that indicate cognitive overload. SpikeSense addresses this gap by implementing an intelligent detection system that analyzes app-switching frequency, engagement duration, and application categories to identify overstimulation patterns.

This project presents a comprehensive mobile application with a backend API that combines rule-based pattern detection with optional machine learning capabilities to provide personalized digital wellness insights. The system emphasizes user autonomy, privacy, and gentle intervention through contextual nudges rather than restrictive measures.

---

## 2. Problem Statement

### 2.1 Current Limitations

Existing digital wellness applications suffer from several critical limitations:

1. **Oversimplified Metrics**: Most apps rely solely on total screen time, ignoring behavioral patterns that indicate cognitive overload.

2. **Lack of Context**: Simple time-based restrictions fail to account for the quality of engagement or the cognitive impact of rapid app switching.

3. **One-Size-Fits-All Approach**: Fixed thresholds do not adapt to individual user patterns and needs.

4. **Privacy Concerns**: Many solutions require extensive data sharing with third parties.

5. **Platform Limitations**: iOS restrictions and Android permission complexities make comprehensive tracking challenging.

### 2.2 Research Questions

- How can we detect digital overstimulation beyond simple screen time metrics?
- What patterns indicate cognitive overload in mobile device usage?
- How can we provide effective, non-intrusive interventions?
- Can personalized thresholds improve detection accuracy and user engagement?

---

## 3. Aims and Objectives

### 3.1 Primary Aims

1. **Develop an intelligent overstimulation detection system** that analyzes app-switching frequency, duration, and category patterns.

2. **Create a production-ready mobile application** with cross-platform support (iOS, Android, Web).

3. **Implement a flexible nudge system** that adapts to user preferences (supportive, motivational, restrictive, balanced).

4. **Build a scalable backend API** with pattern detection and personalized threshold learning.

5. **Ensure privacy and user autonomy** through local-first architecture and transparent data handling.

### 3.2 Specific Objectives

1. **Pattern Detection Engine**
   - Implement rule-based baseline model
   - Develop lightweight ML model for personalization
   - Detect rapid switching, entertainment overload, and cognitive overload patterns

2. **Mobile Application**
   - Real-time app usage tracking
   - Beautiful, intuitive dashboard
   - Permission handling for Android/iOS
   - Offline functionality

3. **Backend Infrastructure**
   - RESTful API with Flask
   - PostgreSQL database
   - AI module for pattern detection
   - Nudge generation engine

4. **User Experience**
   - Four operating modes (supportive, motivational, restrictive, balanced)
   - Contextual, gentle nudges
   - Comprehensive statistics and insights
   - Gamification elements (badges, streaks, challenges)

---

## 4. Literature Review

### 4.1 Digital Wellness and Cognitive Load

Research in cognitive psychology (Sweller, 1988; Paas & Van Merriënboer, 1994) has established that cognitive load increases with task switching and information overload. In the digital context, rapid app switching has been linked to decreased productivity and increased stress (Mark et al., 2015).

### 4.2 Screen Time vs. Behavioral Patterns

Studies have shown that total screen time is a poor predictor of negative outcomes compared to usage patterns (Twenge & Campbell, 2018). The frequency of app switches and the nature of content consumed are more significant indicators of digital overstimulation.

### 4.3 Intervention Strategies

Research on digital wellness interventions suggests that:
- **Supportive approaches** (awareness, education) are more effective than restrictive measures (Valkenburg et al., 2022)
- **Personalization** improves engagement and outcomes (Orben & Przybylski, 2019)
- **Gamification** can motivate behavior change when used appropriately (Hamari et al., 2014)

### 4.4 Technical Approaches

- **Android Usage Stats API**: Provides access to app usage data with proper permissions (Android Developers, 2023)
- **iOS Screen Time API**: Limited but available through Screen Time framework (Apple Developer, 2023)
- **Pattern Recognition**: Machine learning approaches for behavioral analysis (Boyd & Crawford, 2012)

---

## 5. Methodology

### 5.1 Development Approach

**Agile Development**: Iterative development with continuous feedback and testing.

**Technology Stack Selection**:
- **Frontend**: React Native with Expo for cross-platform development
- **Backend**: Python Flask for API development
- **Database**: PostgreSQL for production, SQLite for development
- **AI/ML**: NumPy, scikit-learn for lightweight ML models

### 5.2 Pattern Detection Methodology

#### 5.2.1 Rule-Based Baseline Model

The baseline model uses predefined rules to detect patterns:

1. **Rapid Switching Detection**
   - Threshold: 15+ switches per hour (configurable)
   - Window-based detection: 8+ switches in 10 minutes = high severity

2. **Entertainment Overload**
   - Threshold: 60+ minutes of entertainment apps (configurable)
   - Ratio-based: >50% entertainment time = high severity

3. **Cognitive Overload**
   - Combination: High switching + high entertainment ratio
   - Formula: `switch_rate >= threshold AND entertainment_ratio > 0.5`

#### 5.2.2 Machine Learning Personalization

The optional ML model adapts thresholds based on:

1. **Historical Analysis**
   - Percentile-based threshold calculation (75th percentile)
   - Clamping to reasonable bounds (10-30 switches, 30-120 minutes)

2. **User Response Learning**
   - Dismissal rate analysis
   - Threshold adjustment based on user feedback
   - Adaptive sensitivity tuning

### 5.3 Nudge Generation Strategy

Nudges are generated based on:
- **Pattern Type**: rapid_switching, entertainment_overload, cognitive_overload
- **Severity**: low, medium, high
- **User Mode**: supportive, motivational, restrictive, balanced
- **Context**: Specific metrics (switch count, time spent, etc.)

---

## 6. System Architecture

### 6.1 High-Level Architecture

```
┌─────────────────┐
│  Mobile App     │
│  (React Native) │
└────────┬────────┘
         │ HTTP/REST
         │
┌────────▼────────┐
│  Flask Backend  │
│  (Python)       │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼──────┐
│  AI   │ │Database │
│Module │ │(Postgres)│
└───────┘ └─────────┘
```

### 6.2 Component Architecture

#### 6.2.1 Mobile App Components

- **App Usage Tracker**: Real-time tracking service
- **API Service**: HTTP client for backend communication
- **UI Components**: Dashboard, charts, cards, nudges
- **State Management**: React hooks and context
- **Permissions Handler**: Android/iOS permission management

#### 6.2.2 Backend Components

- **Flask Application**: Main API server
- **Pattern Detector**: Rule-based and ML pattern detection
- **Nudge Engine**: Context-aware nudge generation
- **Database Models**: User, AppUsage, Nudge, UserThreshold, DailyStats
- **Validators**: Input validation utilities

### 6.3 Data Flow

1. **Usage Tracking**: Mobile app → API → Database
2. **Pattern Detection**: Database → AI Module → Pattern Results
3. **Nudge Generation**: Pattern Results → Nudge Engine → Database
4. **User Retrieval**: Mobile app → API → Database → Mobile app

---

## 7. Flow Diagrams

### 7.1 App Usage Tracking Flow

```
User Opens App
    │
    ▼
Check Permissions
    │
    ├─► Not Granted → Request Permissions
    │                    │
    │                    └─► User Grants → Continue
    │
    └─► Granted → Start Tracking
                    │
                    ▼
            Monitor App Switches
                    │
                    ▼
            Log to Backend API
                    │
                    ▼
            Pattern Detection
                    │
                    ├─► Pattern Detected → Generate Nudge
                    │                        │
                    │                        └─► Store in Database
                    │
                    └─► No Pattern → Continue Monitoring
```

### 7.2 Pattern Detection Flow

```
App Usage Data
    │
    ▼
Check Rapid Switching
    │
    ├─► Detected → Calculate Severity
    │                │
    │                └─► Return Pattern Result
    │
    ▼
Check Entertainment Overload
    │
    ├─► Detected → Calculate Severity
    │                │
    │                └─► Return Pattern Result
    │
    ▼
Check Cognitive Overload
    │
    ├─► Detected → Calculate Severity
    │                │
    │                └─► Return Pattern Result
    │
    ▼
Select Most Severe Pattern
    │
    └─► Return Detection Result
```

### 7.3 Nudge Generation Flow

```
Pattern Detection Result
    │
    ▼
Check User Mode
    │
    ├─► Supportive → Generate Insight Nudge
    ├─► Motivational → Generate Challenge Nudge
    ├─► Restrictive → Generate Restriction Nudge
    └─► Balanced → Generate Contextual Nudge
            │
            ▼
    Customize Message with Context
            │
            ▼
    Store in Database
            │
            ▼
    Return to Mobile App
```

---

## 8. Implementation

### 8.1 Mobile Application

#### 8.1.1 Technology Stack
- **Framework**: React Native with Expo
- **Navigation**: Expo Router
- **State Management**: React Hooks
- **UI Components**: Custom components with React Native
- **Charts**: React Native SVG for data visualization
- **Storage**: AsyncStorage for local data

#### 8.1.2 Key Features Implemented

1. **Real-Time Tracking**
   - AppState monitoring for app switches
   - Usage data collection and buffering
   - Periodic synchronization with backend

2. **Dashboard**
   - Daily statistics visualization
   - Category breakdown (doughnut chart)
   - Weekly trends (line chart)
   - Focus score display

3. **Nudge System**
   - Real-time nudge display
   - Dismissal functionality
   - Action buttons (focus mode, take break, view stats)

4. **Settings**
   - Mode selection (supportive, motivational, restrictive, balanced)
   - Nudge configuration
   - Threshold customization

### 8.2 Backend API

#### 8.2.1 Technology Stack
- **Framework**: Flask (Python)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **CORS**: flask-cors for cross-origin requests
- **Validation**: Custom validators

#### 8.2.2 Key Endpoints

1. **User Management**
   - `POST /api/users`: Create user
   - `GET /api/users/:id`: Get user profile
   - `POST /api/users/:id/mode`: Update mode

2. **Usage Tracking**
   - `POST /api/users/:id/usage`: Log app usage
   - `POST /api/users/:id/app-switch`: Log app switch

3. **Nudges**
   - `GET /api/users/:id/nudges`: Get pending nudges
   - `POST /api/users/:id/nudges/:id/dismiss`: Dismiss nudge

4. **Statistics**
   - `GET /api/users/:id/stats/daily`: Get daily stats

5. **Thresholds**
   - `GET /api/users/:id/thresholds`: Get thresholds
   - `POST /api/users/:id/thresholds`: Update thresholds

### 8.3 AI Module

#### 8.3.1 Pattern Detector

**Rule-Based Detection**:
- Rapid switching: Count switches in time window
- Entertainment overload: Sum entertainment app time
- Cognitive overload: Combine switching rate and entertainment ratio

**ML Personalization**:
- Historical data analysis using percentiles
- User response learning (dismissal rate)
- Adaptive threshold adjustment

#### 8.3.2 Nudge Engine

**Template-Based Generation**:
- Predefined message templates for each pattern type
- Severity-based template selection
- Mode-appropriate template filtering
- Context variable substitution

### 8.4 Database Schema

**Users Table**:
- id, device_id, name, email, mode_preference, created_at

**App Usage Table**:
- id, user_id, app_name, category, duration_minutes, timestamp

**Nudges Table**:
- id, user_id, type, message, severity, action_label, action_type, dismissed, created_at

**User Thresholds Table**:
- id, user_id, switch_threshold, entertainment_threshold, break_interval, rapid_switching_window

**Daily Stats Table**:
- id, user_id, date, total_screen_time, app_switches, productivity_time, social_time, entertainment_time, other_time, focus_score

---

## 9. Testing

### 9.1 Testing Strategy

#### 9.1.1 Unit Testing
- Pattern detection algorithms
- Nudge generation logic
- Data validation functions
- API endpoint handlers

#### 9.1.2 Integration Testing
- API endpoint integration
- Database operations
- Mobile app ↔ Backend communication
- Pattern detection → Nudge generation flow

#### 9.1.3 User Testing
- Permission handling
- UI/UX usability
- Nudge effectiveness
- Mode switching

### 9.2 Test Cases

**Pattern Detection**:
- Rapid switching: 20 switches in 1 hour → Should detect medium severity
- Entertainment overload: 90 minutes entertainment → Should detect high severity
- Cognitive overload: 18 switches + 70% entertainment → Should detect high severity

**Nudge Generation**:
- Supportive mode + rapid switching → Should generate insight nudge
- Motivational mode + focus achievement → Should generate challenge nudge
- Restrictive mode + high overload → Should generate restriction nudge

**API Endpoints**:
- Create user → Should return user_id
- Log usage → Should trigger pattern detection
- Get nudges → Should return pending nudges only

---

## 10. Conclusion

### 10.1 Achievements

SpikeSense successfully implements a comprehensive digital wellness system that:

1. **Detects overstimulation** through intelligent pattern analysis beyond simple screen time
2. **Provides personalized insights** through adaptive threshold learning
3. **Offers flexible intervention** through multiple operating modes
4. **Maintains user privacy** through local-first architecture
5. **Delivers production-ready code** with proper documentation and testing

### 10.2 Limitations and Future Work

**Current Limitations**:
- iOS tracking is limited due to platform restrictions
- Android requires manual permission setup
- ML model is lightweight and could be enhanced
- Real-time tracking requires native modules for full accuracy

**Future Enhancements**:
- Native Android app usage tracking module
- iOS Screen Time API integration with proper entitlements
- Advanced ML models (neural networks) for better personalization
- Social features (optional, privacy-preserving)
- Web dashboard for comprehensive analytics
- Multi-language support

### 10.3 Impact

SpikeSense provides a foundation for evidence-based digital wellness interventions. By focusing on behavioral patterns rather than simple metrics, it offers a more nuanced approach to understanding and managing digital overstimulation. The system's emphasis on user autonomy and gentle intervention aligns with research on effective behavior change strategies.

---

## 11. References

Android Developers. (2023). *UsageStatsManager*. Android Developer Documentation. https://developer.android.com/reference/android/app/usage/UsageStatsManager

Apple Developer. (2023). *Family Controls Framework*. Apple Developer Documentation. https://developer.apple.com/documentation/familycontrols

Boyd, D., & Crawford, K. (2012). Critical questions for big data. *Information, Communication & Society*, 15(5), 662-679.

Hamari, J., Koivisto, J., & Sarsa, H. (2014). Does gamification work?—A literature review of empirical studies on gamification. *2014 47th Hawaii International Conference on System Sciences*, 3025-3034.

Mark, G., Gudith, D., & Klocke, U. (2008). The cost of interrupted work: more speed and stress. *Proceedings of the SIGCHI Conference on Human Factors in Computing Systems*, 107-110.

Orben, A., & Przybylski, A. K. (2019). The association between adolescent well-being and digital technology use. *Nature Human Behaviour*, 3(2), 173-182.

Paas, F., & Van Merriënboer, J. J. (1994). Instructional control of cognitive load in the training of complex cognitive tasks. *Educational Psychology Review*, 6(4), 351-371.

Sweller, J. (1988). Cognitive load during problem solving: Effects on learning. *Cognitive Science*, 12(2), 257-285.

Twenge, J. M., & Campbell, W. K. (2018). Associations between screen time and lower psychological well-being among children and adolescents: Evidence from a population-based study. *Preventive Medicine Reports*, 12, 271-283.

Valkenburg, P. M., Meier, A., & Beyens, I. (2022). Social media use and its impact on adolescent mental health: An umbrella review of the evidence. *Current Opinion in Psychology*, 44, 58-68.

---

**Report Generated**: January 2024  
**Version**: 1.0.0  
**Author**: SpikeSense Development Team



