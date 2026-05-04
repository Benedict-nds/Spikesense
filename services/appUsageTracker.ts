/**
 * App Usage Tracker Service
 * Handles real-time app usage tracking on Android/iOS
 */

import { Platform } from 'react-native';
import { getApiBaseUrl } from '@/constants/api';
import { apiService, type UsageEventResponse } from './api';
import { processUsageEventIntervention } from './interventionService';
import { bootstrapUser as runUserBootstrap } from '@/services/userBootstrap';
import { getOrCreateDeviceId, getStoredUserId } from '@/services/userProfile';
import {
  getCurrentAppInfo,
  requestUsagePermission,
  isUntrackableAndroidPackage,
  startNativeTrackingService,
  stopNativeTrackingService,
  type AndroidCategory,
  type AndroidTrackedApp,
} from './androidUsageService';

interface AppUsageEvent {
  appName: string;
  category: AndroidCategory;
  durationSeconds: number;
  timestamp: string;
  packageName: string;
}

const STABLE_POLLS_REQUIRED = 2;
const EMIT_DEDUPE_WINDOW_MS = 3000;
const POLL_INTERVAL_MS = 3000;

class AppUsageTracker {
  private userId: number | null = null;
  private deviceId: string | null = null;
  private isTracking: boolean = false;
  /** Display name sent to the API (native label on Android). */
  private lastTrackedAppName: string | null = null;
  /** Package used for identity, switching, and filtering. */
  private lastTrackedPackage: string | null = null;
  private lastTrackedCategory: AndroidCategory = 'other';
  private lastSwitchTime: number = Date.now();
  private usageBuffer: AppUsageEvent[] = [];
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  /** Chained timeouts so polls never overlap (avoids double emits). */
  private trackingTimeout: ReturnType<typeof setTimeout> | null = null;
  private hasUsagePermission: boolean = false;

  private stableCandidatePackage: string | null = null;
  private stableCandidateHits: number = 0;

  /** When foreground is launcher/settings/self, we pause attributing time until a trackable app is back. */
  private suspendedSince: number | null = null;

  private lastEmittedAppName: string | null = null;
  private lastEmittedPackage: string | null = null;
  private lastEmittedDuration: number = -1;
  private lastEmittedAt: number = 0;

  private emitChain: Promise<void> = Promise.resolve();
  /** Serialized switch work; `finally` always releases the next waiter. */
  private switchMutex: Promise<void> = Promise.resolve();

  async initialize(): Promise<boolean> {
    try {
      this.deviceId = await getOrCreateDeviceId();
      const stored = await getStoredUserId();
      if (stored != null) {
        this.userId = stored;
      }

      const isHealthy = await apiService.checkHealth();
      if (this.userId != null) {
        if (!isHealthy && __DEV__) {
          console.log('[TRACK] backend unreachable; using cached userId');
        }
        return true;
      }

      if (!isHealthy) {
        return false;
      }

      console.log('[TRACK][BOOTSTRAP_USER_FOR_TRACKING]');
      try {
        this.userId = await runUserBootstrap({});
        console.log('[TRACK][START]', { userId: this.userId });
        return true;
      } catch (e) {
        console.warn('[TRACK][BOOTSTRAP_FAILED]', e instanceof Error ? e.message : e);
        return false;
      }
    } catch (error) {
      console.error('Failed to initialize app usage tracker:', error);
      const fallback = await getStoredUserId();
      if (fallback != null) {
        this.userId = fallback;
        return true;
      }
      return false;
    }
  }

  async startTracking(): Promise<void> {
    if (this.isTracking) {
      console.log('[TRACK][POLL_SKIPPED_ALREADY_RUNNING]');
      return;
    }

    if (!this.userId) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize tracker');
      }
    }

    this.isTracking = true;
    this.lastSwitchTime = Date.now();

    this.syncInterval = window.setInterval(() => {
      this.syncUsageData();
    }, 60000);

    if (Platform.OS === 'android') {
      requestUsagePermission();
      this.startAndroidTracking();
      const started = await startNativeTrackingService(this.userId!, getApiBaseUrl());
      console.log('[TRACK][NATIVE_SERVICE]', { started, userId: this.userId });
      return;
    }

    this.startIOSTracking();
    console.log('[TRACK][START]', { pollIntervalMs: POLL_INTERVAL_MS });
    this.scheduleNextTrackingPoll();
  }

  async stopTracking(): Promise<void> {
    console.log('[TRACK][STOP]');
    this.isTracking = false;

    if (Platform.OS === 'android') {
      await stopNativeTrackingService();
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.trackingTimeout) {
      clearTimeout(this.trackingTimeout);
      this.trackingTimeout = null;
    }

    await this.syncUsageData();
  }

  private logPollState(): void {
    console.log('[TRACK][STATE]', {
      isTracking: this.isTracking,
      userId: this.userId,
      lastTrackedPackage: this.lastTrackedPackage,
      suspendedSince: this.suspendedSince,
      hasPollTimer: this.trackingTimeout != null,
    });
  }

  /** Schedules one poll after `POLL_INTERVAL_MS`. Does not run if not tracking. */
  private scheduleNextTrackingPoll(): void {
    if (this.trackingTimeout) {
      clearTimeout(this.trackingTimeout);
      this.trackingTimeout = null;
    }
    if (!this.isTracking) {
      return;
    }
    this.trackingTimeout = setTimeout(() => {
      void this.runTrackingPoll();
    }, POLL_INTERVAL_MS);
  }

  /**
   * Single poll tick: switch + heartbeat. Always reschedules in `finally` while tracking is on.
   */
  private async runTrackingPoll(): Promise<void> {
    if (!this.isTracking) {
      return;
    }

    console.log('[TRACK][POLL_TICK]');
    this.logPollState();

    try {
      await this.trackAppSwitch();
      await this.trackAppUsageHeartbeat();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('[TRACK][POLL_ERROR]', msg, e);
    } finally {
      if (this.isTracking) {
        console.log('[TRACK][POLL_RESCHEDULE]', { nextInMs: POLL_INTERVAL_MS });
        this.scheduleNextTrackingPoll();
      }
    }
  }

  private startAndroidTracking(): void {
    console.log('Android tracking started (UsageStats + PackageManager)');
  }

  private startIOSTracking(): void {
    console.log('iOS tracking started (limited - requires ScreenTime entitlements)');
  }

  private resetStability(): void {
    this.stableCandidatePackage = null;
    this.stableCandidateHits = 0;
  }

  /** Untrackable foreground: never promote into stability or lastTracked. */
  private onUntrackableForeground(packageName: string): void {
    this.resetStability();
    const pkg = (packageName || '').trim();
    const isSelf = pkg.toLowerCase() === 'com.anonymous.natively';
    if (isSelf) {
      console.log('[TRACK][STATE_SKIPPED_SELF]', pkg);
    }
    console.log('[TRACK][IGNORED_PACKAGE]', pkg);
    if (this.lastTrackedPackage != null && this.suspendedSince === null) {
      this.suspendedSince = Date.now();
    }
  }

  private advanceStableForeground(
    packageName: string,
  ): { stable: boolean; justBecameStable: boolean } {
    if (this.stableCandidatePackage === packageName) {
      this.stableCandidateHits += 1;
    } else {
      this.stableCandidatePackage = packageName;
      this.stableCandidateHits = 1;
    }

    const stable = this.stableCandidateHits >= STABLE_POLLS_REQUIRED;
    const justBecameStable = stable && this.stableCandidateHits === STABLE_POLLS_REQUIRED;
    return { stable, justBecameStable };
  }

  /**
   * After an ignored/suspended gap, close or resume the session before applying stability to the new poll.
   */
  private async resolveAfterSuspension(info: AndroidTrackedApp): Promise<void> {
    if (this.suspendedSince === null) {
      return;
    }

    const suspendedAt = this.suspendedSince;

    if (this.lastTrackedPackage == null) {
      this.suspendedSince = null;
      return;
    }

    if (this.lastTrackedPackage === info.packageName) {
      this.suspendedSince = null;
      this.lastSwitchTime = Date.now();
      this.resetStability();
      return;
    }

    const duration = Math.max(1, Math.floor((suspendedAt - this.lastSwitchTime) / 1000));
    await this.emitSession(
      this.lastTrackedAppName!,
      this.lastTrackedCategory,
      duration,
      this.lastTrackedPackage,
    );

    this.lastTrackedPackage = null;
    this.lastTrackedAppName = null;
    this.lastTrackedCategory = 'other';
    this.suspendedSince = null;
    this.lastSwitchTime = Date.now();
    this.resetStability();
  }

  private async emitSession(
    appName: string,
    category: AndroidCategory,
    durationSeconds: number,
    packageName: string,
  ): Promise<boolean> {
    const previous = this.emitChain;
    const next = (async (): Promise<boolean> => {
      await previous.catch(() => undefined);
      return this.emitSessionLocked(appName, category, durationSeconds, packageName);
    })();
    this.emitChain = next.then(() => undefined).catch(() => undefined);
    return next;
  }

  private async emitSessionLocked(
    appName: string,
    category: AndroidCategory,
    durationSeconds: number,
    packageName: string,
  ): Promise<boolean> {
    if (!this.userId) {
      return false;
    }

    const pkg = (packageName || '').trim();
    if (!pkg || isUntrackableAndroidPackage(pkg)) {
      if (pkg.toLowerCase() === 'com.anonymous.natively') {
        console.log('[TRACK][STATE_SKIPPED_SELF]', pkg);
      }
      return false;
    }

    const d = Math.floor(Number(durationSeconds));
    if (!Number.isFinite(d) || d < 5) {
      return false;
    }

    console.log('[TRACK][EMIT_ATTEMPT]', { appName, category, duration: d, packageName: pkg });

    const now = Date.now();
    if (
      this.lastEmittedAppName === appName &&
      this.lastEmittedPackage === pkg &&
      this.lastEmittedDuration === d &&
      now - this.lastEmittedAt < EMIT_DEDUPE_WINDOW_MS
    ) {
      console.log('[TRACK][EMIT_SKIPPED_DUPLICATE]', { appName, packageName: pkg, duration: d });
      return false;
    }

    try {
      const res = await apiService.logEvent(this.userId, appName, category, d, { packageName: pkg });
      const payload = res.success ? (res.data as UsageEventResponse | undefined) : undefined;
      try {
        await processUsageEventIntervention(payload, this.userId);
      } catch {
        if (__DEV__) console.warn('[appUsageTracker] processUsageEventIntervention failed');
      }
      this.lastEmittedAppName = appName;
      this.lastEmittedPackage = pkg;
      this.lastEmittedDuration = d;
      this.lastEmittedAt = Date.now();
      console.log('[TRACK][EMIT_SUCCESS]', { appName, duration: d });
      return true;
    } catch {
      return false;
    }
  }

  async trackAppSwitch(): Promise<void> {
    if (Platform.OS === 'android') {
      return;
    }

    const previous = this.switchMutex;
    let release!: () => void;
    this.switchMutex = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous.catch(() => undefined);
    try {
      await this.executeTrackAppSwitch();
    } finally {
      release();
    }
  }

  private async executeTrackAppSwitch(): Promise<void> {
    if (!this.userId || !this.isTracking) return;

    if (Platform.OS !== 'android') {
      return;
    }

    const info = await getCurrentAppInfo();

    if (info == null) {
      if (!this.hasUsagePermission) {
        console.warn('[Tracking] Usage permission not granted');
      }
      this.hasUsagePermission = false;
      return;
    }

    if (info.ignored || isUntrackableAndroidPackage(info.packageName)) {
      this.onUntrackableForeground(info.packageName);
      return;
    }

    this.hasUsagePermission = true;

    await this.resolveAfterSuspension(info);

    const { packageName, appName, category } = info;

    console.log('[TRACK][RAW_PACKAGE]', packageName);
    console.log('[TRACK][APP_NAME]', appName);
    console.log('[TRACK][CATEGORY]', category);

    const { stable, justBecameStable } = this.advanceStableForeground(packageName);
    if (!stable) {
      return;
    }
    if (justBecameStable) {
      console.log('[TRACK][STABLE_ACCEPTED]', packageName);
    }

    if (this.lastTrackedPackage === packageName) {
      if (justBecameStable) {
        console.log('[TRACK][DUPLICATE_SKIPPED]', packageName);
      }
      return;
    }

    if (!this.lastTrackedPackage) {
      this.lastTrackedPackage = packageName;
      this.lastTrackedAppName = appName;
      this.lastTrackedCategory = category;
      this.lastSwitchTime = Date.now();
      this.stableCandidateHits = STABLE_POLLS_REQUIRED;
      return;
    }

    const now = Date.now();
    const duration = Math.max(1, Math.floor((now - this.lastSwitchTime) / 1000));

    console.log('[SWITCH]', {
      from: this.lastTrackedAppName,
      fromPackage: this.lastTrackedPackage,
      to: appName,
      toPackage: packageName,
      duration,
    });

    const prevPackage = this.lastTrackedPackage;
    const prevName = this.lastTrackedAppName!;
    const prevCat = this.lastTrackedCategory;

    await this.emitSession(prevName, prevCat, duration, prevPackage);

    this.lastTrackedPackage = packageName;
    this.lastTrackedAppName = appName;
    this.lastTrackedCategory = category;
    this.lastSwitchTime = now;
  }

  async trackAppUsageHeartbeat(): Promise<void> {
    if (!this.userId || !this.isTracking) return;
    if (Platform.OS !== 'android') return;
    /* Android: UsageTrackingService posts sessions; legacy JS heartbeat removed. */
  }

  private async syncUsageData(): Promise<void> {
    if (!this.userId || this.usageBuffer.length === 0) {
      return;
    }

    const eventsToSync = [...this.usageBuffer];
    this.usageBuffer = [];

    for (const event of eventsToSync) {
      try {
        await this.emitSession(
          event.appName,
          event.category,
          event.durationSeconds,
          event.packageName || '__buffer__',
        );
      } catch (error) {
        console.error('Failed to sync usage data:', error);
        this.usageBuffer.push(event);
      }
    }
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
