/**
 * App Usage Tracker Service
 * Handles real-time app usage tracking on Android/iOS
 */

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './api';

// For Android, we'll use react-native-app-usage (requires native module)
// For iOS, we'll use ScreenTime API (requires special entitlements)
// This is a wrapper that handles both platforms

interface AppUsageEvent {
  appName: string;
  category: 'productivity' | 'social' | 'entertainment' | 'other';
  durationSeconds: number;
  timestamp: string;
}

interface AppCategory {
  [key: string]: 'productivity' | 'social' | 'entertainment' | 'other';
}

// App category mapping (can be extended)
const APP_CATEGORIES: AppCategory = {
  // Productivity
  'Notion': 'productivity',
  'Google Docs': 'productivity',
  'Microsoft Word': 'productivity',
  'Slack': 'productivity',
  'Gmail': 'productivity',
  'Outlook': 'productivity',
  'Calendar': 'productivity',
  'Notes': 'productivity',
  'Reminders': 'productivity',
  'Todoist': 'productivity',
  'Trello': 'productivity',
  'Asana': 'productivity',
  
  // Social
  'Instagram': 'social',
  'Facebook': 'social',
  'Twitter': 'social',
  'WhatsApp': 'social',
  'Messenger': 'social',
  'Snapchat': 'social',
  'TikTok': 'social',
  'LinkedIn': 'social',
  'Discord': 'social',
  
  // Entertainment
  'YouTube': 'entertainment',
  'Netflix': 'entertainment',
  'Spotify': 'entertainment',
  'Apple Music': 'entertainment',
  'Twitch': 'entertainment',
  'Reddit': 'entertainment',
  'Pinterest': 'entertainment',
  'Games': 'entertainment',
  
  // Default to 'other'
};

class AppUsageTracker {
  private userId: number | null = null;
  private deviceId: string | null = null;
  private isTracking: boolean = false;
  private currentApp: string | null = null;
  private appStartTime: Date | null = null;
  private lastSwitchTime: Date | null = null;
  private usageBuffer: AppUsageEvent[] = [];
  private syncInterval: ReturnType<typeof setInterval> | null = null;

  async initialize(): Promise<boolean> {
    try {
      this.deviceId = await this.getDeviceId();

      const isHealthy = await apiService.checkHealth();
      if (!isHealthy) {
        const storedUserId = await AsyncStorage.getItem('userId');
        if (storedUserId) {
          const id = parseInt(storedUserId, 10);
          if (!Number.isNaN(id)) {
            this.userId = id;
            return true;
          }
        }
        return false;
      }

      const userResult = await apiService.bootstrapUser(this.deviceId);
      if (userResult.success && userResult.data?.user_id != null) {
        this.userId = userResult.data.user_id;
        await AsyncStorage.setItem('userId', this.userId.toString());
        return true;
      }

      const storedUserId = await AsyncStorage.getItem('userId');
      if (storedUserId) {
        this.userId = parseInt(storedUserId, 10);
        if (!Number.isNaN(this.userId)) return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to initialize app usage tracker:', error);
      const storedUserId = await AsyncStorage.getItem('userId');
      if (storedUserId) {
        const id = parseInt(storedUserId, 10);
        if (!Number.isNaN(id)) {
          this.userId = id;
          return true;
        }
      }
      return false;
    }
  }

  private async getDeviceId(): Promise<string> {
    let deviceId = await AsyncStorage.getItem('deviceId');
    
    if (!deviceId) {
      // Generate a device ID
      deviceId = Platform.OS === 'ios' 
        ? `ios_${Device.modelId || 'unknown'}_${Date.now()}`
        : `android_${Device.modelId || 'unknown'}_${Date.now()}`;
      
      await AsyncStorage.setItem('deviceId', deviceId);
    }
    
    return deviceId;
  }

  async startTracking(): Promise<void> {
    if (this.isTracking) {
      return;
    }

    if (!this.userId) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize tracker');
      }
    }

    this.isTracking = true;
    
    // Start periodic sync
    this.syncInterval = window.setInterval(() => {
      this.syncUsageData();
    }, 60000); // Sync every minute

    // For Android: Start native tracking
    if (Platform.OS === 'android') {
      this.startAndroidTracking();
    } else {
      // For iOS: Use AppState monitoring (limited)
      this.startIOSTracking();
    }
  }

  async stopTracking(): Promise<void> {
    this.isTracking = false;
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // Flush remaining data
    await this.syncUsageData();
  }

  private startAndroidTracking(): void {
    // In a real implementation, this would use react-native-app-usage
    // or similar native module to track foreground app changes
    
    // For now, we'll use AppState as a fallback
    // This is a simplified version - real implementation requires native modules
    console.log('Android tracking started (requires native module)');
  }

  private startIOSTracking(): void {
    // iOS has limitations - ScreenTime API requires special entitlements
    // For now, we'll use AppState monitoring
    console.log('iOS tracking started (limited - requires ScreenTime entitlements)');
  }

  async trackAppSwitch(appName: string): Promise<void> {
    if (!this.isTracking) return;
  
    const now = new Date();
  
    // Ensure we have a valid userId
    const userId = this.userId;
    if (!userId || Number.isNaN(userId)) {
      console.warn('[UsageTracker] Missing userId, skipping app switch log');
      return;
    }
  
    try {
      // Log previous app session immediately to backend
      if (this.currentApp && this.appStartTime) {
        const durationMs = now.getTime() - this.appStartTime.getTime();
        const durationSeconds = Math.floor(durationMs / 1000);

        // Only record sessions that last at least 1 second
        if (durationSeconds >= 1) {
          const category = this.getAppCategory(this.currentApp);

          const event: AppUsageEvent = {
            appName: this.currentApp,
            category,
            durationSeconds,
            timestamp: this.appStartTime.toISOString(),
          };

          /**
           * Fire-and-forget API call
           * We intentionally DO NOT await to avoid blocking tracking.
           * On failure, we buffer the event for later sync.
           */
          apiService
            .logEvent(userId, event.appName, event.category, event.durationSeconds)
            .catch((error) => {
              console.warn('[UsageTracker] logEvent failed, buffering event:', error?.message);
              this.usageBuffer.push(event);
            });
        }
      }
    } catch (error: any) {
      // Catch unexpected errors without crashing the app
      console.warn('[UsageTracker] trackAppSwitch error:', error?.message);
    }
  
    // Update tracker state
    this.currentApp = appName;
    this.appStartTime = now;
    this.lastSwitchTime = now;
  }

  private async syncUsageData(): Promise<void> {
    if (!this.userId || this.usageBuffer.length === 0) {
      return;
    }

    const eventsToSync = [...this.usageBuffer];
    this.usageBuffer = [];

    // Sync buffered events (previous logEvent failures) to backend
    for (const event of eventsToSync) {
      try {
        await apiService.logEvent(
          this.userId!,
          event.appName,
          event.category,
          event.durationSeconds
        );
      } catch (error) {
        console.error('Failed to sync usage data:', error);
        // Re-add to buffer if sync fails
        this.usageBuffer.push(event);
      }
    }
  }

  private getAppCategory(appName: string): 'productivity' | 'social' | 'entertainment' | 'other' {
    // Try exact match first
    if (APP_CATEGORIES[appName]) {
      return APP_CATEGORIES[appName];
    }

    // Try case-insensitive match
    const lowerName = appName.toLowerCase();
    for (const [key, value] of Object.entries(APP_CATEGORIES)) {
      if (key.toLowerCase() === lowerName) {
        return value;
      }
    }

    // Default to 'other'
    return 'other';
  }

  /** Flush any buffered usage to the backend so daily stats are up to date. */
  async flushUsageToBackend(): Promise<void> {
    await this.syncUsageData();
  }

  getUserId(): number | null {
    return this.userId;
  }

  isActive(): boolean {
    return this.isTracking;
  }
}

export const appUsageTracker = new AppUsageTracker();
export default appUsageTracker;



