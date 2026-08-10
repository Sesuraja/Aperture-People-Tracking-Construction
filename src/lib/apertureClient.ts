export interface ApertureConfigResponse {
  success: boolean;
  provider: string;
  host: string;
  apiKeyConfigured: boolean;
  apiKeyMasked: string;
  realTimeSyncActive: boolean;
  historySyncActive: boolean;
  lastSuccessfulSync: string | null;
  lastError: string | null;
}

export interface ApertureTestResponse {
  status: 'connected' | 'AUTHENTICATION_FAILED' | 'SERVER_UNAVAILABLE' | 'TIMEOUT' | 'NOT_CONFIGURED' | 'UNKNOWN_ERROR' | string;
  provider: string;
  responseCode: number;
  checkedAt: string;
  message?: string;
}

export interface ApertureHeaderOptions {
  apiKey?: string;
  authHeaderType?: 'X-API-Key' | 'Bearer';
}

/**
 * Encapsulates authentication header creation logic for Aperture RFID API requests.
 * Supports configurable header formats: 'X-API-Key' or 'Bearer' tokens.
 */
export function getApertureAuthHeaders(options: ApertureHeaderOptions = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  if (options.apiKey && options.apiKey.trim() !== '') {
    if (options.authHeaderType === 'Bearer') {
      headers['Authorization'] = `Bearer ${options.apiKey.trim()}`;
    } else {
      headers['X-API-Key'] = options.apiKey.trim();
    }
  }

  return headers;
}

/**
 * Client-side service methods to interact with the backend Aperture RFID integration routes.
 */
export const apertureClient = {
  /**
   * Retrieves the current Aperture RFID configuration status.
   * Note: The backend NEVER returns the raw API key. Only masked key string.
   */
  async getConfig(): Promise<ApertureConfigResponse> {
    const res = await fetch('/api/integrations/aperture/config');
    if (!res.ok) {
      throw new Error(`Failed to fetch Aperture RFID config (HTTP ${res.status})`);
    }
    return res.json();
  },

  /**
   * Saves host and API key securely on the backend server.
   */
  async saveConfig(host: string, apiKey: string, authHeaderType: 'X-API-Key' | 'Bearer' = 'X-API-Key'): Promise<ApertureConfigResponse> {
    const res = await fetch('/api/integrations/aperture/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host, apiKey, authHeaderType })
    });
    if (!res.ok) {
      throw new Error(`Failed to save Aperture RFID config (HTTP ${res.status})`);
    }
    return res.json();
  },

  /**
   * Tests connection to the Aperture RFID API server via backend proxy.
   */
  async testConnection(host?: string, apiKey?: string): Promise<ApertureTestResponse> {
    const res = await fetch('/api/integrations/aperture/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host, apiKey })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        status: errData.status || 'UNKNOWN_ERROR',
        provider: 'Aperture RFID',
        responseCode: res.status,
        checkedAt: new Date().toISOString(),
        message: errData.message || `Test failed with status ${res.status}`
      };
    }
    return res.json();
  },

  /**
   * Triggers manual real-time tags sync.
   */
  async syncRealtime(): Promise<{ success: boolean; processedCount: number; error?: string }> {
    const res = await fetch('/api/integrations/aperture/sync-realtime', { method: 'POST' });
    return res.json();
  },

  /**
   * Triggers manual history sync.
   */
  async syncHistory(skipCount = 0, takeCount = 200): Promise<{ success: boolean; totalCount: number; recordsFetched: number; error?: string }> {
    const res = await fetch('/api/integrations/aperture/sync-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skipCount, takeCount })
    });
    return res.json();
  }
};

export default apertureClient;
