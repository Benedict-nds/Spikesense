/**
 * API Service for SpikeSense Backend
 * Handles all HTTP requests to the Flask backend
 */

import { getApiBaseUrl } from '@/constants/api';

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
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const isHealthy = response.ok;
      this.backendReachable = isHealthy;

      if (!isHealthy && __DEV__) {
        console.warn('[API] Health check failed:', response.status);
      }

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
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (__DEV__) {
          console.warn('[API] Request failed:', endpoint, response.status, data?.error ?? data);
        }
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        data: data,
      };
    } catch (error) {
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

  async updateUserMode(userId: number, mode: string) {
    return this.request(`/users/${userId}/mode`, {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
  }

  // App usage endpoints
  async logEvent(
    userId: number,
    appName: string,
    category: string,
    durationSeconds: number
  ) {
    return this.request(`/users/${userId}/events`, {
      method: 'POST',
      body: JSON.stringify({
        app_name: appName,
        category: category,
        duration: durationSeconds
      }),
    });
  }

  // Nudge endpoints
  async getPendingNudges(userId: number) {
    return this.request(`/users/${userId}/nudges`);
  }

  async dismissNudge(userId: number, nudgeId: number) {
    return this.request(`/users/${userId}/nudges/${nudgeId}/dismiss`, {
      method: 'POST',
    });
  }

  // Stats endpoints
  async getDailyStats(userId: number, date?: string) {
    const dateParam = date ? `?date=${date}` : '';
    return this.request(`/users/${userId}/stats/daily${dateParam}`);
  }

  // Threshold endpoints
  async getUserThresholds(userId: number) {
    return this.request(`/users/${userId}/thresholds`);
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
