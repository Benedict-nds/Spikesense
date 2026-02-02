/**
 * API Service for SpikeSense Backend
 * Handles all HTTP requests to the Flask backend
 */

const API_BASE_URL = __DEV__ 
  ? 'http://localhost:5000/api' 
  : 'https://your-production-api.com/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
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
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // User endpoints
  async createUser(deviceId: string, name?: string, email?: string) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify({
        device_id: deviceId,
        name: name || 'User',
        email,
      }),
    });
  }

  async getUser(userId: number) {
    return this.request(`/users/${userId}`);
  }

  async updateUserMode(userId: number, mode: string) {
    return this.request(`/users/${userId}/mode`, {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
  }

  // App usage endpoints
  async logAppUsage(
    userId: number,
    appName: string,
    category: string,
    durationMinutes: number,
    timestamp: string
  ) {
    return this.request('/users/' + userId + '/usage', {
      method: 'POST',
      body: JSON.stringify({
        app_name: appName,
        category,
        duration_minutes: durationMinutes,
        timestamp,
      }),
    });
  }

  async logAppSwitch(userId: number, timestamp?: string) {
    return this.request('/users/' + userId + '/app-switch', {
      method: 'POST',
      body: JSON.stringify({
        timestamp: timestamp || new Date().toISOString(),
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



