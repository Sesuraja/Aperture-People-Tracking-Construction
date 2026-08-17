import { Router, Request, Response } from 'express';
import { 
  seedAllDemoData, 
  getCollectionDocs, 
  upsertDoc, 
  DEFAULT_PEOPLE,
  DEFAULT_PERMANENT_ZONES
} from '../services/db.js';
import { broadcastWebSocketEvent } from '../services/websocket.js';

export const demoRouter = Router();

/**
 * GET /api/demo/status
 * Returns current count of seeded records across all key demo collections
 */
demoRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const collections = [
      'registered_people',
      'incidents_enterprise',
      'alerts_enterprise',
      'alerts',
      'alert_rules',
      'emergency_broadcasts',
      'devices',
      'audit_logs',
      'compliance_frameworks',
      'retention_policies',
      'visitors',
      'visitor_security_list',
      'work_orders',
      'maintenance_nodes',
      'attendance_logs',
      'shift_schedules',
      'leave_requests',
      'assets',
      'vehicles',
      'zones',
      'geofences',
      'real_time_tags'
    ];

    const counts: Record<string, number> = {};
    for (const col of collections) {
      const docs = await getCollectionDocs(col);
      counts[col] = docs.length;
    }

    res.json({
      success: true,
      status: 'active',
      mode: 'demo_synthetic',
      timestamp: new Date().toISOString(),
      counts
    });
  } catch (err: any) {
    console.error('[Demo Router] Error fetching demo status:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/demo/seed
 * Forces re-seeding of all synthetic datasets
 */
demoRouter.post('/seed', async (req: Request, res: Response) => {
  try {
    const { force = true } = req.body || {};
    const result = await seedAllDemoData(Boolean(force));

    // Broadcast system notification via WebSocket
    broadcastWebSocketEvent('DEMO_DATA_RESEEDED', {
      timestamp: new Date().toISOString(),
      message: 'All enterprise collections re-seeded with synthetic demo data.'
    });

    res.json({
      success: result.success,
      message: 'All enterprise demo collections successfully seeded.',
      seededCollections: result.seededCollections
    });
  } catch (err: any) {
    console.error('[Demo Router] Error seeding demo data:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/demo/event
 * Triggers interactive simulation events (SOS, Geofence breach, Turnstile punch, Incident)
 */
demoRouter.post('/event', async (req: Request, res: Response) => {
  try {
    const { eventType, details } = req.body;

    if (eventType === 'sos_alarm') {
      const sosAlert = {
        id: `ALT-SOS-${Date.now().toString().slice(-4)}`,
        type: 'security',
        category: 'Emergency',
        priority: 'Critical',
        status: 'In Progress',
        title: 'EMERGENCY: Man-Down / SOS Button Triggered',
        message: details?.message || 'Worker Marcus Vance (HH-1092) pressed SOS panic tag button in Deep Excavation Shaft.',
        timestamp: new Date().toISOString(),
        assignedTo: 'Marcus Vance (EHS Director)',
        assignedRole: 'EHS Lead Officer',
        assignedAt: new Date().toISOString(),
        aiSummary: {
          rootCause: 'Immediate man-down or duress trigger signal received over UHF frequency 915 MHz.',
          threatScore: 98,
          recommendedActions: [
            'Sound sector emergency buzzer immediately.',
            'Deploy first responder medical kit to Deep Excavation West Bench.',
            'Dispatch safety team lead to confirm worker status.'
          ]
        },
        evidence: {
          locationZone: 'Deep Excavation Shaft',
          rfidReaderId: 'DEV-02',
          rssiDbm: -58,
          telemetryLog: '[SOS_PANIC_ACTIVE] RSSI: -58dBm | Accelerometer Impact: 3.8G | Battery: 94%'
        }
      };

      await upsertDoc('alerts_enterprise', sosAlert);
      await upsertDoc('alerts', {
        id: sosAlert.id,
        type: 'security',
        message: sosAlert.message,
        timestamp: sosAlert.timestamp,
        location: 'Deep Excavation Shaft',
        resolved: false
      });

      broadcastWebSocketEvent('ALERT_EVENT', sosAlert);

      return res.json({ success: true, event: sosAlert });
    }

    if (eventType === 'geofence_breach') {
      const breachAlert = {
        id: `ALT-GEO-${Date.now().toString().slice(-4)}`,
        type: 'warning',
        category: 'Safety',
        priority: 'High',
        status: 'Open',
        title: 'GEOFENCE BREACH: Uncertified Personnel in Exclusion Zone',
        message: details?.message || 'Worker David Kim entered Heavy Crane & Exclusion Area without certified rigger credentials.',
        timestamp: new Date().toISOString(),
        assignedTo: 'Elena Rostova (Field Safety Lead)',
        aiSummary: {
          rootCause: 'Proximity violation within active 25-ton lifting radius during tower crane slew cycle.',
          threatScore: 88,
          recommendedActions: [
            'Alert crane operator Carlos Mendez to hold slew rotation.',
            'Trigger localized exclusion zone strobe lights.'
          ]
        },
        evidence: {
          locationZone: 'Heavy Crane & Exclusion Area',
          rfidReaderId: 'DEV-04',
          rssiDbm: -64
        }
      };

      await upsertDoc('alerts_enterprise', breachAlert);
      broadcastWebSocketEvent('ALERT_EVENT', breachAlert);

      return res.json({ success: true, event: breachAlert });
    }

    if (eventType === 'attendance_punch') {
      const worker = DEFAULT_PEOPLE[Math.floor(Math.random() * DEFAULT_PEOPLE.length)];
      const punch = {
        id: `ATT-${Date.now()}`,
        tagId: worker.hardhatTagId,
        personId: worker.id,
        name: worker.name,
        trade: worker.role,
        department: worker.department,
        direction: Math.random() > 0.5 ? 'IN' : 'OUT',
        readerId: 'DEV-01',
        gateName: 'Main Gate 1 North Turnstile',
        timestamp: new Date().toISOString(),
        verified: true,
        verificationMethod: 'UHF Long-Range Passive RFID'
      };

      await upsertDoc('attendance_logs', punch);
      broadcastWebSocketEvent('ATTENDANCE_PUNCH', punch);

      return res.json({ success: true, punch });
    }

    res.status(400).json({ success: false, error: `Unknown eventType: ${eventType}` });
  } catch (err: any) {
    console.error('[Demo Router] Error triggering demo event:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
