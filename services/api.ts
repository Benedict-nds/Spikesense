/**
 * API Service for SpikeSense Backend
 * Handles all HTTP requests to the Flask backend
 */

import { getApiBaseUrl } from '@/constants/api';
import type { Mode } from '@/constants/modes';
import { apiRequest, ApiRequestError } from '@/services/apiRequest';
import type { NudgeDeliveryTier, NudgeRealtimePayload } from '@/types/nudgeDelivery';

const API_BASE_URL = getApiBaseUrl();

// Debug log at startup
if (__DEV__) {
  console.log('API base URL:', API_BASE_URL);
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Server focus session row (GET/POST focus endpoints). */
export type FocusSessionApi = {
  id: number;
  user_id?: number;
  start_time?: string | null;
  end_time?: string | null;
  duration_minutes: number;
  is_active: boolean;
  violations_count: number;
};

/** POST /users/:id/events JSON body (additive fields from focus enforcement). */
export type UsageEventResponse = {
  success?: boolean;
  enforcement?: boolean;
  reason?: string;
  category?: string;
  violations_count?: number;
  current_state?: string;
  total_usage_seconds?: number;
  nudge?: unknown;
  deduplicated?: boolean;
  /** Real-time delivery path (additive; persisted nudges unchanged) */
  nudge_delivery?: NudgeDeliveryTier;
  nudge_payload?: NudgeRealtimePayload;
};

class ApiService {
  private backendReachable: boolean | null = null;

  /**
   * Check if backend is reachable by calling GET /api/health
   * Must be called before any other API calls.
   */
  async checkHealth(): Promise<boolean> {
    if (this.backendReachable === false) {
      return false;
    }

    try {
      await apiRequest(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const isHealthy = true;
      this.backendReachable = isHealthy;

      return isHealthy;
    } catch (error) {
      this.backendReachable = false;
      if (__DEV__) {
        console.log('Backend not reachable');
        console.warn('[API] Health check error:', error instanceof Error ? error.message : error);
      }
      return false;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    if (this.backendReachable === false) {
      return {
        success: false,
        error: 'Backend not reachable',
      };
    }

    try {
      const data = (await apiRequest(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })) as T;

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (__DEV__) {
          console.warn('[API] Request failed:', endpoint, error.status, (error.data as any)?.error ?? error.data);
        }
        return {
          success: false,
          error: error.message,
        };
      }
      if (__DEV__) {
        console.warn('[API] Request error:', endpoint, error instanceof Error ? error.message : error);
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // User bootstrap: POST /api/users with { device_id }, returns user_id. Do not use GET /users.
  async bootstrapUser(deviceId: string) {
    return this.request<{ user_id: number }>('/users', {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId }),
    });
  }

  /** PATCH user row — still supported for older clients */
  async updateUserMode(userId: number, mode: Mode) {
    return this.request(`/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ mode_preference: mode }),
    });
  }

  /** GET effective adaptive/manual mode (canonical Focus/Balanced/Relax + flags). */
  async getUserAdaptiveMode(userId: number) {
    return this.request<{
      success?: boolean;
      mode?: string;
      confidence?: number;
      reason?: string;
      auto?: boolean;
      manual_lock?: boolean;
      mode_source?: 'manual' | 'adaptive';
      stored_mode_preference?: string | null;
      effective_profile?: Record<string, unknown>;
    }>(`/users/${userId}/mode`, { method: 'GET' });
  }

  /** POST preferred mode to backend (persists mode_preference + returns adaptive_mode). */
  async postUserMode(userId: number, mode: Mode) {
    return this.request<{
      success?: boolean;
      mode_preference?: string;
      adaptive_mode?: Record<string, unknown>;
    }>(`/users/${userId}/mode`, {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
  }

  // App usage endpoints
  async logEvent(
    userId: number,
    appName: string,
    category: string,
    durationSeconds: number,
    options?: { packageName?: string }
  ) {
    const body: Record<string, unknown> = {
      app_name: appName,
      category,
      duration: durationSeconds,
    };
    if (options?.packageName) {
      body.package_name = options.packageName;
    }
    return this.request<UsageEventResponse>(`/users/${userId}/events`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async startFocusSession(userId: number, durationMinutes: number) {
    return this.request<{
      success?: boolean;
      session?: FocusSessionApi;
      error?: string;
    }>(`/users/${userId}/focus/start`, {
      method: 'POST',
      body: JSON.stringify({ duration_minutes: durationMinutes }),
    });
  }

  async stopFocusSession(userId: number) {
    return this.request<{ success?: boolean; stopped?: number; error?: string }>(
      `/users/${userId}/focus/stop`,
      { method: 'POST', body: JSON.stringify({}) }
    );
  }

  async getFocusSessionStatus(userId: number) {
    return this.request<{
      success?: boolean;
      active?: boolean;
      session?: FocusSessionApi | null;
      is_expired?: boolean;
      error?: string;
    }>(`/users/${userId}/focus/status`, { method: 'GET' });
  }

  async postFocusViolation(userId: number) {
    return this.request<{
      success?: boolean;
      violations_count?: number;
      session?: FocusSessionApi;
      error?: string;
    }>(`/users/${userId}/focus/violation`, { method: 'POST', body: JSON.stringify({}) });
  }

  // Nudge endpoints
  async getPendingNudges(userId: number) {
    return this.request<{
      success?: boolean;
      nudges?: Array<Record<string, unknown> & { explanation?: string }>;
    }>(`/users/${userId}/nudges`);
  }

  async dismissNudge(userId: number, nudgeId: number) {
    return this.request(`/users/${userId}/nudges/${nudgeId}/dismiss`, {
      method: 'POST',
    });
  }

  // Stats endpoints
  async getDailyStats(userId: number, date?: string) {
    const dateParam = date ? `?date=${date}` : '';
    return this.request<{
      success?: boolean;
      stats?: Record<string, unknown>;
      top_apps?: Array<Record<string, unknown>>;
      adaptive_mode?: {
        mode?: string;
        manual_lock?: boolean;
        auto?: boolean;
        mode_source?: 'manual' | 'adaptive';
        stored_mode_preference?: string | null;
      };
    }>(`/users/${userId}/stats/daily${dateParam}`);
  }

  // Threshold endpoints
  async getUserThresholds(userId: number) {
    return this.request<{ success?: boolean; thresholds?: Record<string, unknown> }>(
      `/users/${userId}/thresholds`
    );
  }

  // Achievements endpoints
  async getAchievements(userId: number) {
    return this.request<{
      success?: boolean;
      badges?: Array<Record<string, unknown>>;
      available_badges?: Array<Record<string, unknown>>;
      today_challenge?: Record<string, unknown> | null;
      streaks?: Record<string, unknown> | null;
      challenges?: unknown[];
    }>(`/users/${userId}/achievements`);
  }

  async updateUserThresholds(
    userId: number,
    thresholds: {
      switch_threshold?: number;
      entertainment_threshold?: number;
      break_interval?: number;
      rapid_switching_window?: number;
    }
  ) {
    return this.request(`/users/${userId}/thresholds`, {
      method: 'POST',
      body: JSON.stringify(thresholds),
    });
  }
}

export const apiService = new ApiService();
export default apiService;
