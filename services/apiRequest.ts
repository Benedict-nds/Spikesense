type ApiRequestErrorDetails = {
  status?: number;
  data?: unknown;
  text?: string;
};

export class ApiRequestError extends Error {
  status?: number;
  data?: unknown;
  text?: string;

  constructor(message: string, details: ApiRequestErrorDetails = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = details.status;
    this.data = details.data;
    this.text = details.text;
  }
}

function safeJsonParse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function apiRequest(url: string, options: RequestInit = {}) {
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    const data = text ? safeJsonParse(text) : null;

    if (!response.ok) {
      const message =
        (data as any)?.error ||
        `API request failed (HTTP ${response.status})`;
      throw new ApiRequestError(message, { status: response.status, data, text });
    }

    return data;
  } catch (error) {
    console.error('[API] Request error:', url, error);
    throw error;
  }
}

