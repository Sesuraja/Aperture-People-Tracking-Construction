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
  LocationName?: string;
  personName?: string;
  personId?: string | null;
  zoneId?: string;
  zoneName?: string;
  x?: number;
  y?: number;
  rssi?: number;
  readerId?: string;
  antennaId?: number;
}

class GaoApi {
  private host: string;

  constructor(host: string = DEFAULT_HOST) {
    this.host = host;
  }

  setHost(host: string) {
    this.host = host.replace(/\/$/, '');
    if (typeof window !== 'undefined') {
      localStorage.setItem('gao_api_url', this.host);
    }
  }

  getHost() {
    return this.host;
  }

  getProxyHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };
    if (typeof window !== 'undefined') {
      const targetHost = localStorage.getItem('gao_api_url');
      if (targetHost) headers['x-gao-target-host'] = targetHost;
    }
    return headers;
  }
  /**
   * 1. GET /api/GetHistoryTotalCount
   * Queries backend for history total count.
   */
  async getHistoryTotalCount(): Promise<number> {
    const isDemo = typeof window !== 'undefined' && localStorage.getItem('gao_app_mode') === 'demo';
    if (isDemo) {
      return 52;
    }

    const response = await fetch('/api/GetHistoryTotalCount', {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Failed to fetch history count: ${response.status} ${errText}`);
    }

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      if (typeof data === 'number') return data;
      if (data && typeof data.totalCount === 'number') return data.totalCount;
      if (data && typeof data.count === 'number') return data.count;
    } catch {
      const num = parseInt(text.trim(), 10);
      if (!isNaN(num)) return num;
    }

    return 0;
  }

  /**
   * 2. GET /api/GetHistoryRecords/{skip}/{take}
   * Queries backend for paginated history records.
   */
  async getHistoryRecords(skip: number, take: number): Promise<HistoryRecord[]> {
    const isDemo = typeof window !== 'undefined' && localStorage.getItem('gao_app_mode') === 'demo';
    if (isDemo) {
      // Explicit Demo Mode sample dataset
      const mockHistoricalPool: HistoryRecord[] = [
        { TagID: "1", FirstName: "Alice", LastName: "Smith", LocationName: "Structure & Scaffolding (L1-L4)", EnterTimeStr: "2026-06-10 11:15:00", LeaveTimeStr: "2026-06-10 12:05:00", Duration: 50 },
        { TagID: "2", FirstName: "Bob", LastName: "Johnson", LocationName: "Gate 1 / Main Access Gate", EnterTimeStr: "2026-06-10 10:30:00", LeaveTimeStr: "2026-06-10 10:45:00", Duration: 15 },
        { TagID: "3", FirstName: "Charlie", LastName: "Davis", LocationName: "Site Office & Welfare Container", EnterTimeStr: "2026-06-10 09:00:00", LeaveTimeStr: "2026-06-10 10:30:00", Duration: 90 },
        { TagID: "4", FirstName: "Diana", LastName: "Prince", LocationName: "Material Laydown & Loading", EnterTimeStr: "2026-06-10 12:00:00", LeaveTimeStr: "2026-06-10 12:45:00", Duration: 45 },
        { TagID: "1", FirstName: "Alice", LastName: "Smith", LocationName: "Heavy Crane & Exclusion Area", EnterTimeStr: "2026-06-10 08:30:00", LeaveTimeStr: "2026-06-10 08:55:00", Duration: 25 },
        { TagID: "2", FirstName: "Bob", LastName: "Johnson", LocationName: "Excavation & Foundation Pit", EnterTimeStr: "2026-06-10 11:00:00", LeaveTimeStr: "2026-06-10 11:30:00", Duration: 30 },
        { TagID: "3", FirstName: "Charlie", LastName: "Davis", LocationName: "Confined Shaft & Tunneling", EnterTimeStr: "2026-06-10 10:45:00", LeaveTimeStr: "2026-06-10 11:15:00", Duration: 30 }
      ];

      const paddedPool = [...mockHistoricalPool];
      for (let i = mockHistoricalPool.length; i < 52; i++) {
        const indexSeed = i + 1;
        paddedPool.push({
          TagID: String((indexSeed % 4) + 1),
          FirstName: indexSeed % 2 === 0 ? "Jane" : "John",
          LastName: indexSeed % 3 === 0 ? "Doe" : "Smith",
          LocationName: indexSeed % 4 === 0 ? "Heavy Crane & Exclusion Area" : indexSeed % 4 === 1 ? "Excavation & Foundation Pit" : "Structure & Scaffolding (L1-L4)",
          EnterTimeStr: `2026-06-10 07:${10 + (indexSeed % 40)}:00`,
          LeaveTimeStr: `2026-06-10 07:${30 + (indexSeed % 20)}:00`,
          Duration: 20
        });
      }

      return paddedPool.slice(skip, skip + take);
    }

    const response = await fetch(`/api/GetHistoryRecords/${skip}/${take}`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Failed to fetch history records: ${response.status} ${errText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  /**
   * 3. GET /api/GetTagsInRealtime
   * Queries backend server for real live tags.
   */
  async getTagsInRealtime(): Promise<RealtimeTag[]> {
    const isDemo = typeof window !== 'undefined' && localStorage.getItem('gao_app_mode') === 'demo';
    if (isDemo) {
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
        { TagID: "1", Timestamp: nowStr, Location: spot1, LocationName: spot1 },
        { TagID: "2", Timestamp: nowStr, Location: spot2, LocationName: spot2 },
        { TagID: "3", Timestamp: nowStr, Location: spot3, LocationName: spot3 },
        { TagID: "4", Timestamp: nowStr, Location: spot4, LocationName: spot4 }
      ];
    }

    const response = await fetch('/api/GetTagsInRealtime', {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Real-time tags request failed with HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }
}

export const gaoApi = new GaoApi();
