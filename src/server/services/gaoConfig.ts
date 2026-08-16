import { getDocById, upsertDoc } from './db.js';

export interface GaoApiConfig {
  host: string;
  apiKey: string;
  authHeaderType: 'X-API-Key' | 'Bearer' | 'Custom';
  customHeaderName: string;
  pollingIntervalSeconds: number;
  pollingEnabled: boolean;
  requestTimeoutMs: number;
  apiKeyConfigured: boolean;
  apiKeyMasked: string;
  realTimeSyncActive: boolean;
  historySyncActive: boolean;
  lastSuccessfulSync: string | null;
  lastError: string | null;
  updatedAt?: string;
}

export type MaskedGaoApiConfig = Omit<GaoApiConfig, 'apiKey'>;

export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 4) return '••••••••••••';
  return '••••••••••••' + key.slice(-4);
}

const DEFAULT_HOST =
  process.env.GAO_RFID_HOST ||
  process.env.BEECEPTOR_MOCK_URL ||
  process.env.APERTURE_RFID_HOST ||
  'https://www.i360services.com/peopletrackinguhf';

const DEFAULT_API_KEY =
  process.env.GAO_RFID_API_KEY ||
  process.env.APERTURE_RFID_API_KEY ||
  '';

const DEFAULT_AUTH_HEADER =
  (process.env.GAO_RFID_AUTH_HEADER as 'X-API-Key' | 'Bearer' | 'Custom') || 'X-API-Key';

const DEFAULT_CUSTOM_HEADER =
  process.env.GAO_RFID_CUSTOM_HEADER || 'X-API-Key';

const DEFAULT_POLLING_INTERVAL = 10; // seconds
const DEFAULT_REQUEST_TIMEOUT = 8000; // milliseconds

let memoryConfigCache: GaoApiConfig | null = null;

/**
 * Loads the current GAO RFID API configuration from MongoDB settings.
 * Returns the raw configuration (including apiKey) for secure server-side usage only.
 */
export async function getSecureGaoConfig(): Promise<GaoApiConfig> {
  let doc = await getDocById('settings', 'gao_rfid_config');
  if (!doc) {
    doc = await getDocById('settings', 'rfid_api_config');
  }
  if (!doc) {
    doc = await getDocById('settings', 'aperture_config');
  }

  const host = (doc?.host || memoryConfigCache?.host || DEFAULT_HOST).trim();
  const apiKey = doc?.apiKey !== undefined ? doc.apiKey : (memoryConfigCache?.apiKey !== undefined ? memoryConfigCache.apiKey : DEFAULT_API_KEY);
  const authHeaderType = doc?.authHeaderType || memoryConfigCache?.authHeaderType || DEFAULT_AUTH_HEADER;
  const customHeaderName = (doc?.customHeaderName || memoryConfigCache?.customHeaderName || DEFAULT_CUSTOM_HEADER).trim();
  const pollingIntervalSeconds = Number(doc?.pollingIntervalSeconds || memoryConfigCache?.pollingIntervalSeconds || DEFAULT_POLLING_INTERVAL);
  const pollingEnabled = doc?.pollingEnabled !== undefined ? Boolean(doc.pollingEnabled) : (memoryConfigCache?.pollingEnabled ?? true);
  const requestTimeoutMs = Number(doc?.requestTimeoutMs || memoryConfigCache?.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT);
  const realTimeSyncActive = doc?.realTimeSyncActive !== undefined ? Boolean(doc.realTimeSyncActive) : (memoryConfigCache?.realTimeSyncActive ?? true);
  const historySyncActive = doc?.historySyncActive !== undefined ? Boolean(doc.historySyncActive) : (memoryConfigCache?.historySyncActive ?? true);
  const lastSuccessfulSync = doc?.lastSuccessfulSync || memoryConfigCache?.lastSuccessfulSync || null;
  const lastError = doc?.lastError || memoryConfigCache?.lastError || null;

  const result: GaoApiConfig = {
    host,
    apiKey,
    authHeaderType,
    customHeaderName,
    pollingIntervalSeconds: Math.max(2, Math.min(300, pollingIntervalSeconds)),
    pollingEnabled,
    requestTimeoutMs: Math.max(1000, Math.min(60000, requestTimeoutMs)),
    apiKeyConfigured: Boolean(apiKey && apiKey.length > 0),
    apiKeyMasked: maskApiKey(apiKey),
    realTimeSyncActive,
    historySyncActive,
    lastSuccessfulSync,
    lastError,
    updatedAt: doc?.updatedAt || memoryConfigCache?.updatedAt
  };

  memoryConfigCache = result;
  return result;
}

/**
 * Returns safe GAO RFID configuration for client responses.
 * Raw API keys are completely stripped and replaced with masked string.
 */
export async function getMaskedGaoConfig(): Promise<MaskedGaoApiConfig> {
  const secureConfig = await getSecureGaoConfig();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { apiKey, ...safeConfig } = secureConfig;
  return safeConfig;
}

/**
 * Saves and updates GAO RFID API configuration in MongoDB settings collection.
 */
export async function saveGaoConfig(input: {
  host?: string;
  apiKey?: string;
  authHeaderType?: 'X-API-Key' | 'Bearer' | 'Custom';
  customHeaderName?: string;
  pollingIntervalSeconds?: number;
  pollingEnabled?: boolean;
  requestTimeoutMs?: number;
  realTimeSyncActive?: boolean;
  historySyncActive?: boolean;
}): Promise<MaskedGaoApiConfig> {
  const current = await getSecureGaoConfig();

  const newHost = input.host !== undefined ? input.host.trim() : current.host;
  let newApiKey = current.apiKey;

  if (input.apiKey !== undefined) {
    const trimmedKey = input.apiKey.trim();
    if (!trimmedKey.includes('••••')) {
      newApiKey = trimmedKey;
    }
  }

  const newAuthHeaderType = input.authHeaderType || current.authHeaderType || 'X-API-Key';
  const newCustomHeaderName = input.customHeaderName !== undefined ? input.customHeaderName.trim() : current.customHeaderName;
  const newPollingIntervalSeconds = input.pollingIntervalSeconds !== undefined
    ? Math.max(2, Math.min(300, Number(input.pollingIntervalSeconds)))
    : current.pollingIntervalSeconds;
  const newPollingEnabled = input.pollingEnabled !== undefined ? Boolean(input.pollingEnabled) : current.pollingEnabled;
  const newRequestTimeoutMs = input.requestTimeoutMs !== undefined
    ? Math.max(1000, Math.min(60000, Number(input.requestTimeoutMs)))
    : current.requestTimeoutMs;
  const newRealTimeSyncActive = input.realTimeSyncActive !== undefined ? Boolean(input.realTimeSyncActive) : current.realTimeSyncActive;
  const newHistorySyncActive = input.historySyncActive !== undefined ? Boolean(input.historySyncActive) : current.historySyncActive;

  const nowIso = new Date().toISOString();

  const docToPersist = {
    id: 'gao_rfid_config',
    host: newHost,
    apiKey: newApiKey,
    authHeaderType: newAuthHeaderType,
    customHeaderName: newCustomHeaderName,
    pollingIntervalSeconds: newPollingIntervalSeconds,
    pollingEnabled: newPollingEnabled,
    requestTimeoutMs: newRequestTimeoutMs,
    realTimeSyncActive: newRealTimeSyncActive,
    historySyncActive: newHistorySyncActive,
    lastSuccessfulSync: current.lastSuccessfulSync,
    lastError: null,
    updatedAt: nowIso
  };

  // Persist to MongoDB across all aliases for compatibility
  await upsertDoc('settings', docToPersist);
  await upsertDoc('settings', { ...docToPersist, id: 'rfid_api_config' });
  await upsertDoc('settings', { ...docToPersist, id: 'aperture_config' });

  memoryConfigCache = {
    ...docToPersist,
    apiKeyConfigured: Boolean(newApiKey && newApiKey.length > 0),
    apiKeyMasked: maskApiKey(newApiKey)
  };

  console.log(`[GAO Config] Configuration saved to MongoDB settings: Host=${newHost}, Auth=${newAuthHeaderType}, Polling=${newPollingIntervalSeconds}s`);

  return getMaskedGaoConfig();
}

/**
 * Updates sync status (lastSuccessfulSync / lastError) in MongoDB settings.
 */
export async function updateGaoSyncStatus(lastSuccessfulSync?: string, lastError?: string | null): Promise<void> {
  const current = await getSecureGaoConfig();
  const updatedDoc = {
    id: 'gao_rfid_config',
    ...current,
    lastSuccessfulSync: lastSuccessfulSync !== undefined ? lastSuccessfulSync : current.lastSuccessfulSync,
    lastError: lastError !== undefined ? lastError : current.lastError,
    updatedAt: new Date().toISOString()
  };

  await upsertDoc('settings', updatedDoc);
  await upsertDoc('settings', { ...updatedDoc, id: 'rfid_api_config' });
  await upsertDoc('settings', { ...updatedDoc, id: 'aperture_config' });

  memoryConfigCache = {
    ...updatedDoc,
    apiKeyConfigured: Boolean(current.apiKey && current.apiKey.length > 0),
    apiKeyMasked: maskApiKey(current.apiKey)
  };
}
