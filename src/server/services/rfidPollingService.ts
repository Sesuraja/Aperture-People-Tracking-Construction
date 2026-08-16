import crypto from 'crypto';
import { gaoRfidClient, GaoRealtimeTagRaw } from './gaoRfidClient.js';
import { getSecureGaoConfig, updateGaoSyncStatus } from './gaoConfig.js';
import { getCollectionDocs, getDocById, upsertDoc } from './db.js';
import { broadcastSseEvent } from './sse.js';
import { broadcastWebSocketEvent } from './websocket.js';
import { processTelemetryWithAI } from './aiPipeline.js';

export interface IngestionResult {
  success: boolean;
  timestamp: string;
  totalFetched: number;
  newUniqueEventsStored: number;
  activeTagsCount: number;
  error?: string;
}

export interface PollingStatus {
  isActive: boolean;
  intervalSeconds: number;
  lastPollTimestamp: string | null;
  lastPollSuccess: boolean;
  totalPollCount: number;
  totalEventsIngested: number;
  lastError: string | null;
  nextScheduledPoll: string | null;
}

/**
 * In-memory LRU set to track recently ingested event fingerprints for ultra-fast deduplication
 */
const recentEventHashes = new Set<string>();
const MAX_HASH_CACHE_SIZE = 5000;

function addEventHash(hash: string) {
  if (recentEventHashes.size >= MAX_HASH_CACHE_SIZE) {
    // Evict oldest entries
    const iterator = recentEventHashes.values();
    for (let i = 0; i < 500; i++) {
      const val = iterator.next().value;
      if (val) recentEventHashes.delete(val);
    }
  }
  recentEventHashes.add(hash);
}

/**
 * Generates a deterministic unique fingerprint for an RFID event.
 * Combines TagID + Location + normalized UTC timestamp (to second precision).
 */
export function generateEventFingerprint(tagId: string, location: string, timestampIso: string): string {
  // Normalize timestamp to second precision to collapse sub-second duplicate reads
  const dateObj = new Date(timestampIso);
  const normalizedTime = !isNaN(dateObj.getTime())
    ? Math.floor(dateObj.getTime() / 1000)
    : timestampIso;

  const rawKey = `${tagId.trim().toUpperCase()}:${location.trim().toUpperCase()}:${normalizedTime}`;
  return crypto.createHash('sha256').update(rawKey).digest('hex').substring(0, 24);
}

export class RfidPollingService {
  private timer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private inFlight = false;
  private intervalSeconds = 10;
  private lastPollTimestamp: string | null = null;
  private lastPollSuccess = false;
  private totalPollCount = 0;
  private totalEventsIngested = 0;
  private lastError: string | null = null;

  /**
   * Starts the background polling timer
   */
  public async startPolling(customIntervalSeconds?: number): Promise<void> {
    if (this.isPolling && this.timer) {
      console.log('[RFID Polling Service] Background polling already running.');
      return;
    }

    const config = await getSecureGaoConfig();
    this.intervalSeconds = customIntervalSeconds || config.pollingIntervalSeconds || 10;
    this.isPolling = true;

    console.log(`[RFID Polling Service] Started GAO RFID background polling (Interval: ${this.intervalSeconds}s)`);

    // Initial delayed tick
    setTimeout(() => {
      this.pollOnce().catch((err) => {
        console.warn('[RFID Polling Service] Initial poll error:', err?.message || err);
      });
    }, 2000);

    // Main interval loop
    this.scheduleNextTick();
  }

  /**
   * Stops the background polling timer
   */
  public stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isPolling = false;
    console.log('[RFID Polling Service] Stopped background polling.');
  }

  /**
   * Dynamically updates the polling interval
   */
  public setPollingInterval(seconds: number): void {
    this.intervalSeconds = Math.max(2, Math.min(300, seconds));
    if (this.isPolling) {
      this.stopPolling();
      this.startPolling(this.intervalSeconds);
    }
  }

  /**
   * Checks if the polling loop is active
   */
  public isPollingActive(): boolean {
    return this.isPolling;
  }

  /**
   * Returns complete telemetry diagnostics of the background polling service
   */
  public getPollingStatus(): PollingStatus {
    const nextScheduled = this.isPolling && this.lastPollTimestamp
      ? new Date(new Date(this.lastPollTimestamp).getTime() + this.intervalSeconds * 1000).toISOString()
      : null;

    return {
      isActive: this.isPolling,
      intervalSeconds: this.intervalSeconds,
      lastPollTimestamp: this.lastPollTimestamp,
      lastPollSuccess: this.lastPollSuccess,
      totalPollCount: this.totalPollCount,
      totalEventsIngested: this.totalEventsIngested,
      lastError: this.lastError,
      nextScheduledPoll: nextScheduled
    };
  }

  private scheduleNextTick(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(async () => {
      if (!this.isPolling) return;
      try {
        await this.pollOnce();
      } catch (err: any) {
        console.warn('[RFID Polling Service] Polling loop error:', err?.message || err);
      }
    }, this.intervalSeconds * 1000);
  }

  /**
   * Executes a single poll and ingestion cycle
   */
  public async pollOnce(): Promise<IngestionResult> {
    if (this.inFlight) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        totalFetched: 0,
        newUniqueEventsStored: 0,
        activeTagsCount: 0,
        error: 'Poll cycle already in flight'
      };
    }

    this.inFlight = true;
    const nowIso = new Date().toISOString();
    this.totalPollCount++;
    this.lastPollTimestamp = nowIso;

    try {
      const config = await getSecureGaoConfig();

      // Check if polling or real-time sync is enabled
      if (!config.realTimeSyncActive || !config.host) {
        this.inFlight = false;
        return {
          success: true,
          timestamp: nowIso,
          totalFetched: 0,
          newUniqueEventsStored: 0,
          activeTagsCount: 0,
          error: 'Real-time sync disabled or host not configured'
        };
      }

      // 1. Fetch raw tags from GAO RFID API Client
      const rawTags = await gaoRfidClient.getTagsInRealtime({ timeoutMs: config.requestTimeoutMs || 8000 });

      // 2. Trigger MongoDB ingestion with strict event deduplication
      const ingestResult = await this.ingestTagsToMongo(rawTags);

      this.lastPollSuccess = true;
      this.lastError = null;
      this.totalEventsIngested += ingestResult.newUniqueEventsStored;

      // 3. Update sync state
      await updateGaoSyncStatus(nowIso, null);

      this.inFlight = false;
      return ingestResult;
    } catch (err: any) {
      this.lastPollSuccess = false;
      this.lastError = err.message || 'Poll failed';
      await updateGaoSyncStatus(undefined, this.lastError);
      this.inFlight = false;

      return {
        success: false,
        timestamp: nowIso,
        totalFetched: 0,
        newUniqueEventsStored: 0,
        activeTagsCount: 0,
        error: this.lastError
      };
    }
  }

  /**
   * Ingestion Pipeline to MongoDB with Strict Event Deduplication
   */
  public async ingestTagsToMongo(tags: GaoRealtimeTagRaw[]): Promise<IngestionResult> {
    const nowIso = new Date().toISOString();

    if (!Array.isArray(tags) || tags.length === 0) {
      return {
        success: true,
        timestamp: nowIso,
        totalFetched: 0,
        newUniqueEventsStored: 0,
        activeTagsCount: 0
      };
    }

    // Load registered personnel, locations, zones, and reader mappings for resolution
    const [peopleDocs, locationDocs, zoneDocs, readerMappings] = await Promise.all([
      getCollectionDocs('people').catch(() => []),
      getCollectionDocs('locations').catch(() => []),
      getCollectionDocs('zones').catch(() => []),
      getCollectionDocs('reader_zone_mappings').catch(() => [])
    ]);

    let newUniqueEventsCount = 0;
    const novelEventsForAi: GaoRealtimeTagRaw[] = [];

    for (let i = 0; i < tags.length; i++) {
      const item = tags[i];
      if (!item) continue;

      const tagId = String(item.TagID || item.tagId || item.epc || item.id || `TAG_${Date.now()}_${i}`).trim();
      const rawLocation = String(item.Location || item.location || item.LocationName || item.zone || 'Zone1').trim();
      const rawTimestamp = item.Timestamp || item.timestamp || item.lastSeen || nowIso;
      const readerId = String(item.readerId || item.ReaderID || 'GAO-UHF-READER-01').trim();
      const antennaId = Number(item.antennaId || item.antennaPort || 1);
      const rssi = item.rssi !== undefined ? Number(item.rssi) : -65;

      let parsedDate = new Date(rawTimestamp);
      if (isNaN(parsedDate.getTime())) parsedDate = new Date();
      const utcTimestampIso = parsedDate.toISOString();

      // 1. Resolve Reader / Antenna -> zoneId mapping
      let resolvedZoneId: string | null = null;
      let resolvedZoneName = rawLocation;
      let zoneX = 50;
      let zoneY = 50;

      const matchedReaderMapping = readerMappings.find(
        (m: any) =>
          m.readerId?.toLowerCase() === readerId.toLowerCase() &&
          Number(m.antennaPort || m.antennaId || 1) === antennaId
      );

      if (matchedReaderMapping && matchedReaderMapping.zoneId) {
        resolvedZoneId = matchedReaderMapping.zoneId;
        if (matchedReaderMapping.zoneName) resolvedZoneName = matchedReaderMapping.zoneName;
      }

      // 2. If not matched by reader/antenna, match against zones collection
      if (!resolvedZoneId) {
        const matchedZone = zoneDocs.find(
          (z: any) =>
            z.zoneId?.toLowerCase() === rawLocation.toLowerCase() ||
            z.id?.toLowerCase() === rawLocation.toLowerCase() ||
            z.name?.toLowerCase() === rawLocation.toLowerCase() ||
            (Array.isArray(z.aliasNames) && z.aliasNames.some((alias: string) => alias.toLowerCase() === rawLocation.toLowerCase() || rawLocation.toLowerCase().includes(alias.toLowerCase())))
        );

        if (matchedZone) {
          resolvedZoneId = matchedZone.zoneId || matchedZone.id;
          resolvedZoneName = matchedZone.name || rawLocation;
          if (matchedZone.x !== undefined && matchedZone.y !== undefined) {
            zoneX = Math.round(matchedZone.x + (matchedZone.width || 10) / 2);
            zoneY = Math.round(matchedZone.y + (matchedZone.height || 10) / 2);
          }
        } else {
          resolvedZoneId = `zone_${rawLocation.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        }
      } else {
        const matchedZone = zoneDocs.find((z: any) => (z.zoneId || z.id) === resolvedZoneId);
        if (matchedZone) {
          resolvedZoneName = matchedZone.name || resolvedZoneName;
          if (matchedZone.x !== undefined && matchedZone.y !== undefined) {
            zoneX = Math.round(matchedZone.x + (matchedZone.width || 10) / 2);
            zoneY = Math.round(matchedZone.y + (matchedZone.height || 10) / 2);
          }
        }
      }

      // Add a slight deterministic spread within the zone box based on tagId hash
      const hashOffset = (tagId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 7) - 3;
      const finalX = Math.max(5, Math.min(95, zoneX + hashOffset));
      const finalY = Math.max(5, Math.min(95, zoneY + hashOffset));

      // Tag -> Person matching
      const matchedPerson = peopleDocs.find(
        (p: any) =>
          p.tagId?.toLowerCase() === tagId.toLowerCase() ||
          p.TagID?.toLowerCase() === tagId.toLowerCase() ||
          p.badgeId?.toLowerCase() === tagId.toLowerCase() ||
          p.id?.toLowerCase() === tagId.toLowerCase() ||
          p.hardhatTagId?.toLowerCase() === tagId.toLowerCase()
      );

      const personId = matchedPerson ? (matchedPerson.id || matchedPerson.personId || null) : null;
      const personName = matchedPerson
        ? (matchedPerson.name || `${matchedPerson.firstName || ''} ${matchedPerson.lastName || ''}`.trim() || null)
        : (item.FirstName || item.firstName ? `${item.FirstName || item.firstName || ''} ${item.LastName || item.lastName || ''}`.trim() : null);

      const unassignedTag = !matchedPerson;

      // Location matching
      const matchedLocation = locationDocs.find(
        (l: any) =>
          l.name?.toLowerCase() === resolvedZoneName.toLowerCase() ||
          l.id?.toLowerCase() === resolvedZoneId?.toLowerCase() ||
          l.zoneName?.toLowerCase() === resolvedZoneName.toLowerCase()
      );

      const locationId = matchedLocation ? (matchedLocation.id || matchedLocation.locationId || resolvedZoneId) : resolvedZoneId;
      const unresolvedLocation = !matchedLocation;

      // Generate deterministic unique event fingerprint
      const eventFingerprint = generateEventFingerprint(tagId, resolvedZoneName, utcTimestampIso);
      const eventDocId = `RFID-EVT-${eventFingerprint}`;

      // Check for deduplication in memory cache and MongoDB
      let isNewUniqueEvent = false;
      if (!recentEventHashes.has(eventFingerprint)) {
        // Double check MongoDB to ensure we never store duplicate records
        const existingEvent = await getDocById('rfid_realtime_events', eventDocId);
        if (!existingEvent) {
          isNewUniqueEvent = true;
          addEventHash(eventFingerprint);
        } else {
          addEventHash(eventFingerprint);
        }
      }

      // If it's a new unique event, persist into the historical event stream in MongoDB
      if (isNewUniqueEvent) {
        newUniqueEventsCount++;
        novelEventsForAi.push(item);

        const newEventRecord = {
          id: eventDocId,
          uniqueFingerprint: eventFingerprint,
          tagId,
          TagID: tagId,
          personId,
          personName: personName || 'Unassigned Tag',
          unassignedTag,
          zoneId: resolvedZoneId,
          zoneName: resolvedZoneName,
          locationId,
          locationName: resolvedZoneName,
          Location: resolvedZoneName,
          LocationName: resolvedZoneName,
          unresolvedLocation,
          timestamp: utcTimestampIso,
          x: finalX,
          y: finalY,
          source: 'GAO_RFID_API',
          processed: true,
          aiAnalyzed: false,
          rssi,
          antennaId,
          readerId,
          createdAt: nowIso,
          rawPayload: item
        };

        await upsertDoc('rfid_realtime_events', newEventRecord);
      }

      // Always update live current tracking state in MongoDB for this active tag
      const liveTagRecord = {
        id: tagId,
        TagID: tagId,
        tagId,
        personId,
        personName: personName || 'Unassigned Tag',
        zoneId: resolvedZoneId,
        zoneName: resolvedZoneName,
        Location: resolvedZoneName,
        LocationName: resolvedZoneName,
        Timestamp: utcTimestampIso,
        lastSeen: utcTimestampIso,
        unassignedTag,
        x: finalX,
        y: finalY,
        rssi,
        antennaId,
        readerId,
        updatedAt: nowIso
      };

      await upsertDoc('real_time_tags', liveTagRecord);
      await upsertDoc('live_tags', liveTagRecord);

      // Update person record if matched
      if (matchedPerson && matchedPerson.id) {
        const updatedPerson = {
          ...matchedPerson,
          currentZone: resolvedZoneName,
          zone: resolvedZoneName,
          zoneId: resolvedZoneId,
          x: finalX,
          y: finalY,
          rssi,
          lastReader: readerId,
          lastSeen: utcTimestampIso,
          status: 'In-Zone',
          updatedAt: nowIso
        };
        await upsertDoc('people', updatedPerson);
        await upsertDoc('registered_people', updatedPerson);
        await upsertDoc('personnel', updatedPerson);
      }

      // Broadcast normalized live event via SSE and WebSockets
      const eventBroadcast = {
        type: 'tag_update',
        tagId,
        TagID: tagId,
        personId,
        personName: personName || 'Unassigned Tag',
        zoneId: resolvedZoneId,
        zoneName: resolvedZoneName,
        Location: resolvedZoneName,
        LocationName: resolvedZoneName,
        x: finalX,
        y: finalY,
        rssi,
        readerId,
        antennaId,
        timestamp: utcTimestampIso,
        Timestamp: utcTimestampIso,
        eventId: eventDocId,
        isNewEvent: isNewUniqueEvent
      };

      broadcastSseEvent('TAG_LOCATION_UPDATE', eventBroadcast);
      broadcastSseEvent('rfid_scan', eventBroadcast);
      broadcastWebSocketEvent('tag_update', eventBroadcast);
      broadcastWebSocketEvent('rfid_scan', eventBroadcast);
    }

    // Recalculate zone occupancies dynamically
    try {
      const activeTags = await getCollectionDocs('real_time_tags');
      const zoneOccupants: Record<string, Set<string>> = {};

      for (const t of activeTags) {
        const zone = t.Location || t.locationName || 'Zone1';
        if (!zoneOccupants[zone]) zoneOccupants[zone] = new Set();
        zoneOccupants[zone].add(t.TagID || t.tagId || t.id);
      }

      for (const loc of locationDocs) {
        if (!loc || !loc.id) continue;
        const locName = loc.name || loc.zoneName || loc.id;
        const count = zoneOccupants[locName] ? zoneOccupants[locName].size : 0;

        await upsertDoc('locations', {
          ...loc,
          currentOccupancy: count,
          updatedAt: nowIso
        });
      }
    } catch (zoneErr) {
      console.warn('[RFID Polling Service] Zone occupancy update warning:', zoneErr);
    }

    // Pass novel unique events to AI pipeline asynchronously
    if (novelEventsForAi.length > 0) {
      processTelemetryWithAI(novelEventsForAi, 'GAO RFID API Polling Service').catch((aiErr) => {
        console.warn('[RFID Polling Service] AI pipeline warning:', aiErr?.message || aiErr);
      });
    }

    return {
      success: true,
      timestamp: nowIso,
      totalFetched: tags.length,
      newUniqueEventsStored: newUniqueEventsCount,
      activeTagsCount: tags.length
    };
  }
}

/**
 * Singleton instance of RfidPollingService
 */
export const rfidPollingService = new RfidPollingService();
