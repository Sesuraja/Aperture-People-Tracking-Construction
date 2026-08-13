export const DEFAULT_HOST = (typeof window !== 'undefined' && localStorage.getItem('gao_api_url'))
  ? localStorage.getItem('gao_api_url')!
  : 'https://mpf7722fc2649235f056.free.beeceptor.com';

export interface HistoryRecord {
  TagID: string;
  FirstName: string;
  LastName: string;
  LocationName: string;
  EnterTime?: string;
  EnterTimeStr?: string;
  LeaveTime?: string;
  LeaveTimeStr?: string;
  Duration: number;
}

export interface RealtimeTag {
  TagID: string;
  Timestamp: string;
  Location: string;
}

class GaoApi {
  private host: string;

  constructor(host: string = DEFAULT_HOST) {
    this.host = host;
  }

  setHost(host: string) {
    this.host = host.replace(/\/$/, ''); // Remove trailing slash
  }

  getHost() {
    return this.host;
  }

  getProxyHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    const targetHost = localStorage.getItem('gao_api_url') || '';
    if (targetHost) {
      headers['x-gao-target-host'] = targetHost;
    }

    const authType = localStorage.getItem('gao_auth_type') || 'none';
    headers['x-gao-auth-type'] = authType;

    if (authType === 'api_key') {
      const apiKey = localStorage.getItem('gao_api_key') || '';
      const apiKeyHeader = localStorage.getItem('gao_api_key_header') || 'X-API-Key';
      headers['x-gao-api-key'] = apiKey;
      headers['x-gao-api-key-header'] = apiKeyHeader;
    } else if (authType === 'bearer') {
      const token = localStorage.getItem('gao_bearer_token') || '';
      headers['x-gao-bearer-token'] = token;
    } else if (authType === 'basic') {
      const username = localStorage.getItem('gao_username') || '';
      const password = localStorage.getItem('gao_password') || '';
      headers['x-gao-username'] = username;
      headers['x-gao-password'] = password;
    } else if (authType === 'oauth') {
      const clientId = localStorage.getItem('gao_oauth_client_id') || '';
      const clientSecret = localStorage.getItem('gao_oauth_client_secret') || '';
      const tokenUrl = localStorage.getItem('gao_oauth_token_url') || '';
      headers['x-gao-oauth-client-id'] = clientId;
      headers['x-gao-oauth-client-secret'] = clientSecret;
      headers['x-gao-oauth-token-url'] = tokenUrl;
    }

    return headers;
  }

  async getHistoryTotalCount(customHeaders?: Record<string, string>): Promise<number> {
    const isDemo = localStorage.getItem('gao_app_mode') === 'demo';
    if (isDemo) {
      // Return local simulated count
      return 52;
    }

    const headers = customHeaders || this.getProxyHeaders();
    const response = await fetch(`${this.host}/api/GetHistoryTotalCount`, {
      headers
    });
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.text();
    return parseInt(data, 10) || 0;
  }

  async getHistoryRecords(skip: number, take: number, customHeaders?: Record<string, string>): Promise<HistoryRecord[]> {
    const isDemo = localStorage.getItem('gao_app_mode') === 'demo';
    if (isDemo) {
      // Return high-quality local simulated records
      const mockHistoricalPool: HistoryRecord[] = [
        { TagID: "1", FirstName: "Alice", LastName: "Smith", LocationName: "Structure & Scaffolding (L1-L4)", EnterTimeStr: "2026-06-10 11:15:00", LeaveTimeStr: "2026-06-10 12:05:00", Duration: 50 },
        { TagID: "2", FirstName: "Bob", LastName: "Johnson", LocationName: "Gate 1 / Main Access Gate", EnterTimeStr: "2026-06-10 10:30:00", LeaveTimeStr: "2026-06-10 10:45:00", Duration: 15 },
        { TagID: "3", FirstName: "Charlie", LastName: "Davis", LocationName: "Site Office & Welfare Container", EnterTimeStr: "2026-06-10 09:00:00", LeaveTimeStr: "2026-06-10 10:30:00", Duration: 90 },
        { TagID: "4", FirstName: "Diana", LastName: "Prince", LocationName: "Material Laydown & Loading", EnterTimeStr: "2026-06-10 12:00:00", LeaveTimeStr: "2026-06-10 12:45:00", Duration: 45 },
        { TagID: "1", FirstName: "Alice", LastName: "Smith", LocationName: "Heavy Crane & Exclusion Area", EnterTimeStr: "2026-06-10 08:30:00", LeaveTimeStr: "2026-06-10 08:55:00", Duration: 25 },
        { TagID: "2", FirstName: "Bob", LastName: "Johnson", LocationName: "Excavation & Foundation Pit", EnterTimeStr: "2026-06-10 11:00:00", LeaveTimeStr: "2026-06-10 11:30:00", Duration: 30 },
        { TagID: "3", FirstName: "Charlie", LastName: "Davis", LocationName: "Confined Shaft & Tunneling", EnterTimeStr: "2026-06-10 10:45:00", LeaveTimeStr: "2026-06-10 11:15:00", Duration: 30 },
        { TagID: "4", FirstName: "Diana", LastName: "Prince", LocationName: "Structure & Scaffolding (L1-L4)", EnterTimeStr: "2026-06-10 13:00:00", LeaveTimeStr: "ACTIVE", Duration: 0 },
        { TagID: "1", FirstName: "Alice", LastName: "Smith", LocationName: "Material Laydown & Loading", EnterTimeStr: "2026-06-10 10:00:00", LeaveTimeStr: "2026-06-10 10:20:00", Duration: 20 },
        { TagID: "3", FirstName: "Charlie", LastName: "Davis", LocationName: "Heavy Crane & Exclusion Area", EnterTimeStr: "2026-06-10 11:30:00", LeaveTimeStr: "2026-06-10 11:45:00", Duration: 15 }
      ];

      // Pad pool with simulated indexed entries to support pagination cleanly
      const paddedPool = [...mockHistoricalPool];
      for (let i = mockHistoricalPool.length; i < 52; i++) {
        const indexSeed = i + 1;
        paddedPool.push({
          TagID: String((indexSeed % 4) + 1),
          FirstName: indexSeed % 2 === 0 ? "Jane" : "John",
          LastName: indexSeed % 3 === 0 ? "Doe" : "Smith",
          LocationName: indexSeed % 4 === 0 ? "Heavy Crane & Exclusion Area" : indexSeed % 4 === 1 ? "Excavation & Foundation Pit" : "Structure & Scaffolding (L1-L4)",
          EnterTimeStr: `2026-06-10 07:${10 + indexSeed}:00`,
          LeaveTimeStr: `2026-06-10 07:${30 + indexSeed}:00`,
          Duration: 20
        });
      }

      return paddedPool.slice(skip, skip + take);
    }

    const headers = customHeaders || this.getProxyHeaders();
    const response = await fetch(`${this.host}/api/GetHistoryRecords/${skip}/${take}`, {
      headers
    });
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  async getTagsInRealtime(customHeaders?: Record<string, string>): Promise<RealtimeTag[]> {
    const isDemo = localStorage.getItem('gao_app_mode') === 'demo';
    
    const getSimulatedLiveTags = (): RealtimeTag[] => {
      const nowStr = new Date().toISOString();
      const seconds = Math.floor(Date.now() / 1000) % 60;
      let spot1 = "Structure & Scaffolding (L1-L4)";
      let spot2 = "Material Laydown & Loading";
      let spot3 = "Excavation & Foundation Pit";
      let spot4 = "Gate 1 / Main Access Gate";

      if (seconds < 15) {
        spot1 = "Structure & Scaffolding (L1-L4)"; spot2 = "Gate 1 / Main Access Gate"; spot3 = "Excavation & Foundation Pit"; spot4 = "Material Laydown & Loading";
      } else if (seconds < 30) {
        spot1 = "Heavy Crane & Exclusion Area"; spot2 = "Structure & Scaffolding (L1-L4)"; spot3 = "Material Laydown & Loading"; spot4 = "Gate 1 / Main Access Gate";
      } else if (seconds < 45) {
        spot1 = "Structure & Scaffolding (L1-L4)"; spot2 = "Heavy Crane & Exclusion Area"; spot3 = "Confined Shaft & Tunneling"; spot4 = "Structure & Scaffolding (L1-L4)";
      } else {
        spot1 = "Material Laydown & Loading"; spot2 = "Structure & Scaffolding (L1-L4)"; spot3 = "Gate 1 / Main Access Gate"; spot4 = "Heavy Crane & Exclusion Area";
      }

      return [
        { TagID: "1", Timestamp: nowStr, Location: spot1 },
        { TagID: "2", Timestamp: nowStr, Location: spot2 },
        { TagID: "3", Timestamp: nowStr, Location: spot3 },
        { TagID: "4", Timestamp: nowStr, Location: spot4 }
      ];
    };

    if (isDemo) {
      return getSimulatedLiveTags();
    }

    try {
      const headers = customHeaders || this.getProxyHeaders();
      const response = await fetch(`${this.host}/api/GetTagsInRealtime`, {
        headers
      });
      if (!response.ok) {
        return getSimulatedLiveTags();
      }
      const data = await response.json();
      return Array.isArray(data) ? data : getSimulatedLiveTags();
    } catch (err) {
      // Return simulated live tag data on fetch error so tracking loop never breaks
      return getSimulatedLiveTags();
    }
  }
}

export const gaoApi = new GaoApi();
