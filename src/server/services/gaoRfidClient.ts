import { getSecureGaoConfig, GaoApiConfig, updateGaoSyncStatus } from './gaoConfig.js';

export interface GaoRealtimeTagRaw {
  TagID?: string;
  tagId?: string;
  epc?: string;
  id?: string;
  Location?: string;
  location?: string;
  LocationName?: string;
  zone?: string;
  Timestamp?: string;
  timestamp?: string;
  lastSeen?: string;
  FirstName?: string;
  firstName?: string;
  LastName?: string;
  lastName?: string;
  rssi?: number;
  antennaId?: number;
  readerId?: string;
  [key: string]: any;
}

export interface GaoHistoryRecordRaw {
  TagID?: string;
  tagId?: string;
  epc?: string;
  id?: string;
  FirstName?: string;
  firstName?: string;
  LastName?: string;
  lastName?: string;
  LocationName?: string;
  locationName?: string;
  Location?: string;
  location?: string;
  EnterTime?: string;
  enterTime?: string;
  EnterTimeStr?: string;
  LeaveTime?: string;
  leaveTime?: string;
  LeaveTimeStr?: string;
  Duration?: number;
  duration?: number;
  [key: string]: any;
}

export interface GaoConnectionTestResult {
  status: 'CONNECTED' | 'AUTHENTICATION_FAILED' | 'SERVER_UNAVAILABLE' | 'NOT_CONFIGURED' | 'TIMEOUT' | 'UNKNOWN_ERROR';
  provider: string;
  responseCode?: number;
  latencyMs?: number;
  checkedAt: string;
  message: string;
  details?: Record<string, any>;
}

export class GaoApiError extends Error {
  public statusCode?: number;
  public endpoint?: string;
  public isTimeout?: boolean;
  public details?: any;

  constructor(message: string, options?: { statusCode?: number; endpoint?: string; isTimeout?: boolean; details?: any }) {
    super(message);
    this.name = 'GaoApiError';
    this.statusCode = options?.statusCode;
    this.endpoint = options?.endpoint;
    this.isTimeout = options?.isTimeout;
    this.details = options?.details;
  }
}

/**
 * Centralized GAO RFID API Client Service
 */
export class GaoRfidClient {
  private customConfig: Partial<GaoApiConfig> | null = null;

  constructor(customConfig?: Partial<GaoApiConfig>) {
    if (customConfig) {
      this.customConfig = customConfig;
    }
  }

  /**
   * Resolves runtime configuration dynamically
   */
  private async resolveConfig(): Promise<GaoApiConfig> {
    const base = await getSecureGaoConfig();
    if (this.customConfig) {
      return { ...base, ...this.customConfig };
    }
    return base;
  }

  /**
   * Constructs the full target URL handling edge cases and trailing slashes
   */
  private resolveUrl(host: string, endpointPath: string): string {
    const rawHost = host.trim().replace(/\/+$/, '');
    const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;

    // Handle when host already points directly to the endpoint
    if (rawHost.toLowerCase().endsWith(cleanPath.toLowerCase())) {
      return rawHost;
    }
    // Handle root mock endpoint paths without /api/
    if (rawHost.toLowerCase().includes(cleanPath.toLowerCase().replace('/api/', ''))) {
      return rawHost;
    }

    return `${rawHost}${cleanPath}`;
  }

  /**
   * Builds configurable authentication and standard headers
   */
  private buildHeaders(config: GaoApiConfig, extraHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'GAO-People-Tracking-Server/2.0',
      ...extraHeaders
    };

    if (config.apiKey) {
      const apiKey = config.apiKey.trim();
      if (config.authHeaderType === 'Bearer') {
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else if (config.authHeaderType === 'Custom' && config.customHeaderName) {
        headers[config.customHeaderName.trim()] = apiKey;
      } else {
        // Default: X-API-Key
        headers['X-API-Key'] = apiKey;
        // Also attach Authorization Bearer for dual-compatibility
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
    }

    return headers;
  }

  /**
   * Executes HTTP request with timeout, authentication headers, and comprehensive error handling
   */
  public async makeRequest(endpointPath: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
    const config = await this.resolveConfig();

    if (!config.host) {
      throw new GaoApiError('GAO RFID Host URL is not configured.', {
        statusCode: 400,
        endpoint: endpointPath
      });
    }

    const targetUrl = this.resolveUrl(config.host, endpointPath);
    const headers = this.buildHeaders(config, options.headers as Record<string, string>);
    const timeoutDuration = options.timeoutMs || config.requestTimeoutMs || 8000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

    try {
      let res = await fetch(targetUrl, {
        ...options,
        headers,
        signal: options.signal || controller.signal
      });

      // Fallback for mock servers configured without '/api/' prefix
      if (res.status === 404 && endpointPath.startsWith('/api/')) {
        const fallbackPath = endpointPath.replace('/api/', '/');
        const fallbackUrl = this.resolveUrl(config.host, fallbackPath);
        try {
          const fallbackRes = await fetch(fallbackUrl, {
            ...options,
            headers,
            signal: options.signal || controller.signal
          });
          if (fallbackRes.ok) {
            clearTimeout(timeoutId);
            return fallbackRes;
          }
        } catch {
          // Ignore fallback error and return original response
        }
      }

      clearTimeout(timeoutId);
      return res;
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError' || controller.signal.aborted) {
        throw new GaoApiError(`Request to GAO RFID API timed out after ${timeoutDuration}ms: ${endpointPath}`, {
          isTimeout: true,
          endpoint: endpointPath,
          statusCode: 408
        });
      }

      if (err.code === 'ECONNREFUSED' || err.message?.includes('fetch failed')) {
        throw new GaoApiError(`GAO RFID API server unreachable at ${config.host}: ${err.message}`, {
          statusCode: 503,
          endpoint: endpointPath,
          details: err
        });
      }

      throw new GaoApiError(err.message || 'Unknown network error calling GAO RFID API', {
        endpoint: endpointPath,
        details: err
      });
    }
  }

  /**
   * 1. GET /api/GetTagsInRealtime
   * Fetches active real-time RFID tags currently in range of GAO UHF readers.
   */
  public async getTagsInRealtime(options: { timeoutMs?: number } = {}): Promise<GaoRealtimeTagRaw[]> {
    const res = await this.makeRequest('/api/GetTagsInRealtime', options);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new GaoApiError(`GAO RFID GetTagsInRealtime failed with HTTP ${res.status}: ${errBody || res.statusText}`, {
        statusCode: res.status,
        endpoint: '/api/GetTagsInRealtime',
        details: errBody
      });
    }

    const data = await res.json();
    let tagsArray: GaoRealtimeTagRaw[] = [];

    if (Array.isArray(data)) {
      tagsArray = data;
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data.tags)) tagsArray = data.tags;
      else if (Array.isArray(data.data)) tagsArray = data.data;
      else if (Array.isArray(data.records)) tagsArray = data.records;
      else if (Array.isArray(data.events)) tagsArray = data.events;
      else if (Array.isArray(data.items)) tagsArray = data.items;
      else if (Array.isArray(data.payload)) tagsArray = data.payload;
      else if (Array.isArray(data.result)) tagsArray = data.result;
      else if (data.TagID || data.tagId || data.epc) tagsArray = [data];
    }

    return tagsArray;
  }

  /**
   * 2. GET /api/GetHistoryTotalCount
   * Retrieves the total count of historical RFID events stored in the GAO system.
   */
  public async getHistoryTotalCount(options: { timeoutMs?: number } = {}): Promise<number> {
    const res = await this.makeRequest('/api/GetHistoryTotalCount', options);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new GaoApiError(`GAO RFID GetHistoryTotalCount failed with HTTP ${res.status}: ${errBody || res.statusText}`, {
        statusCode: res.status,
        endpoint: '/api/GetHistoryTotalCount',
        details: errBody
      });
    }

    const textData = await res.text();
    try {
      const data = JSON.parse(textData);
      if (typeof data === 'number') return data;
      if (typeof data === 'string' && !isNaN(Number(data))) return Number(data);
      if (data && typeof data === 'object') {
        return Number(data.totalCount || data.count || data.total || data.result || 0);
      }
    } catch {
      const parsedNum = parseInt(textData.trim(), 10);
      if (!isNaN(parsedNum)) {
        return parsedNum;
      }
    }

    return 0;
  }

  /**
   * 3. GET /api/GetHistoryRecords/{skip}/{take}
   * Fetches paginated history records for personnel entry/leave movements.
   */
  public async getHistoryRecords(skip: number = 0, take: number = 100, options: { timeoutMs?: number } = {}): Promise<GaoHistoryRecordRaw[]> {
    const safeSkip = Math.max(0, Number(skip) || 0);
    const safeTake = Math.min(Math.max(1, Number(take) || 100), 500);

    const res = await this.makeRequest(`/api/GetHistoryRecords/${safeSkip}/${safeTake}`, options);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new GaoApiError(`GAO RFID GetHistoryRecords failed with HTTP ${res.status}: ${errBody || res.statusText}`, {
        statusCode: res.status,
        endpoint: `/api/GetHistoryRecords/${safeSkip}/${safeTake}`,
        details: errBody
      });
    }

    const data = await res.json();
    let recordsArray: GaoHistoryRecordRaw[] = [];

    if (Array.isArray(data)) {
      recordsArray = data;
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data.records)) recordsArray = data.records;
      else if (Array.isArray(data.data)) recordsArray = data.data;
      else if (Array.isArray(data.events)) recordsArray = data.events;
      else if (Array.isArray(data.items)) recordsArray = data.items;
      else if (Array.isArray(data.result)) recordsArray = data.result;
      else if (data.TagID || data.tagId) recordsArray = [data];
    }

    return recordsArray;
  }

  /**
   * Validates connection to the GAO RFID API server
   */
  public async testConnection(overrideConfig?: Partial<GaoApiConfig>): Promise<GaoConnectionTestResult> {
    const currentConfig = await getSecureGaoConfig();
    const configToTest: GaoApiConfig = {
      ...currentConfig,
      ...(overrideConfig || {})
    };

    if (!configToTest.host) {
      return {
        status: 'NOT_CONFIGURED',
        provider: 'GAO RFID',
        checkedAt: new Date().toISOString(),
        message: 'API Base URL is not configured.'
      };
    }

    const startMs = Date.now();
    const client = new GaoRfidClient(configToTest);

    try {
      let res: Response;
      try {
        res = await client.makeRequest('/api/GetHistoryTotalCount', { timeoutMs: 7000 });
      } catch (firstErr: any) {
        // Try fallback to GetTagsInRealtime if GetHistoryTotalCount was 404 or failed
        if (firstErr?.statusCode === 404) {
          res = await client.makeRequest('/api/GetTagsInRealtime', { timeoutMs: 7000 });
        } else {
          throw firstErr;
        }
      }

      const latencyMs = Date.now() - startMs;
      const nowIso = new Date().toISOString();

      if (res.ok) {
        await updateGaoSyncStatus(nowIso, null);
        return {
          status: 'CONNECTED',
          provider: 'GAO RFID',
          responseCode: res.status,
          latencyMs,
          checkedAt: nowIso,
          message: `Successfully connected to GAO RFID API server (${latencyMs}ms response).`
        };
      }

      if (res.status === 401 || res.status === 403) {
        const errMsg = `Authentication failed (HTTP ${res.status}). Verify API Key and Header Type.`;
        await updateGaoSyncStatus(undefined, errMsg);
        return {
          status: 'AUTHENTICATION_FAILED',
          provider: 'GAO RFID',
          responseCode: res.status,
          latencyMs,
          checkedAt: nowIso,
          message: errMsg
        };
      }

      const errMsg = `Server returned HTTP ${res.status} ${res.statusText}`;
      await updateGaoSyncStatus(undefined, errMsg);
      return {
        status: 'SERVER_UNAVAILABLE',
        provider: 'GAO RFID',
        responseCode: res.status,
        latencyMs,
        checkedAt: nowIso,
        message: errMsg
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startMs;
      const nowIso = new Date().toISOString();
      let status: GaoConnectionTestResult['status'] = 'UNKNOWN_ERROR';
      let message = err.message || 'Connection test failed';

      if (err.isTimeout) {
        status = 'TIMEOUT';
        message = 'Connection attempt timed out after 7 seconds';
      } else if (err.statusCode === 401 || err.statusCode === 403) {
        status = 'AUTHENTICATION_FAILED';
      } else if (err.statusCode === 503 || err.message?.includes('unreachable') || err.message?.includes('ECONNREFUSED')) {
        status = 'SERVER_UNAVAILABLE';
        message = 'GAO RFID API server is unreachable or offline';
      }

      await updateGaoSyncStatus(undefined, message);

      return {
        status,
        provider: 'GAO RFID',
        responseCode: err.statusCode || 500,
        latencyMs,
        checkedAt: nowIso,
        message
      };
    }
  }
}

/**
 * Singleton instance of GaoRfidClient
 */
export const gaoRfidClient = new GaoRfidClient();
