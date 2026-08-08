import { useState, useEffect, useRef } from 'react';
import { gaoApi, RealtimeTag } from './gaoApi';
import { db, auth } from './firebase';
import { collection, addDoc, query, orderBy, limit, onSnapshot, doc, serverTimestamp, getDoc, setDoc } from './db';
import { Person, Asset, Vehicle, AIAlert, PresenceState } from '../types';

export type { Person, Asset, Vehicle, AIAlert, PresenceState };
export type Zone = 'People Tracking in Construction';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Operation Notice: ', JSON.stringify(errInfo));
}

export const INITIAL_PROJECT_ZONES: Record<string, Record<string, { x: number; y: number; width: number; height: number }>> = {
  'metro-tower': {
    'Deep Excavation Shaft': { x: 10, y: 15, width: 34, height: 62 },
    'Tower Core Structure': { x: 51, y: 25, width: 32, height: 50 },
    'Heavy Crane & Exclusion Area': { x: 80, y: 5, width: 16, height: 42 },
    'High Voltage Area': { x: 46, y: 5, width: 14, height: 16 }
  },
  'highrise-phase2': {
    'Structural Frame Sector A': { x: 18, y: 22, width: 30, height: 56 },
    'Structural Frame Sector B': { x: 52, y: 22, width: 30, height: 56 },
    'Exterior Scaffolding Perimeter': { x: 15, y: 15, width: 70, height: 70 }
  }
};

export function getZonesForProject(projectId: string): string[] {
  try {
    const saved = localStorage.getItem('gao_project_properties');
    if (saved) {
      const parsed = JSON.parse(saved);
      const proj = parsed[projectId];
      if (proj && proj.customZones) {
        const keys = Object.keys(proj.customZones);
        if (keys.length > 0) return keys;
      }
    }
  } catch (e) {
    console.warn('Failed to read custom zones from localStorage:', e);
  }

  const staticZones = INITIAL_PROJECT_ZONES[projectId];
  if (staticZones) {
    return Object.keys(staticZones);
  }
  return ['People Tracking in Construction'];
}

export function normalizeZoneName(location?: string | null, projectId: string = 'metro-tower'): string {
  const zones = getZonesForProject(projectId);
  if (location && zones.includes(location)) {
    return location;
  }
  if (location) {
    const matched = zones.find(z => z.toLowerCase().includes(location.toLowerCase()) || location.toLowerCase().includes(z.toLowerCase()));
    if (matched) return matched;
  }
  return zones[0] || 'People Tracking in Construction';
}

const DEFAULT_ROOM_BOUNDS: Record<string, { x: number; y: number; width: number; height: number }> = {
  'People Tracking in Construction': { x: 5, y: 5, width: 90, height: 90 }
};

export function getZoneRect(zoneName: string, projectId: string = 'metro-tower', dynamicZones?: Record<string, any>) {
  if (dynamicZones && dynamicZones[zoneName]) {
    return dynamicZones[zoneName];
  }

  try {
    const saved = localStorage.getItem('gao_project_properties');
    if (saved) {
      const parsed = JSON.parse(saved);
      const proj = parsed[projectId];
      if (proj && proj.customZones && proj.customZones[zoneName]) {
        return proj.customZones[zoneName];
      }
    }
  } catch (e) {
    console.warn(e);
  }

  const staticZones = INITIAL_PROJECT_ZONES[projectId];
  if (staticZones && staticZones[zoneName]) {
    return staticZones[zoneName];
  }

  return DEFAULT_ROOM_BOUNDS['People Tracking in Construction'];
}

const ZONES: Record<string, { x: number; y: number; width: number; height: number }> = {
  ...DEFAULT_ROOM_BOUNDS
};

export function useSimulation(mode: 'real' | 'demo' | null, activeProjectId: string = 'metro-tower') {
  const [people, setPeople] = useState<Person[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [alerts, setAlerts] = useState<AIAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dynamic thresholds
  const loiteringThresholdRef = useRef(300);
  const idleAlertThresholdRef = useRef(3600);
  const occupancyLimitsRef = useRef<Record<string, number>>({});
  const alertedZonesRef = useRef<Record<string, number>>({});
  
  const registeredPeopleRef = useRef<Record<string, {name: string, role: string}>>({});

  // Helper to add fake alerts in demo mode
  const addDemoAlert = (type: 'security' | 'warning' | 'info', message: string) => {
     const newAlert: AIAlert = { id: Math.random().toString(), type, message, timestamp: new Date() };
     setAlerts(prev => [newAlert, ...prev].slice(0, 15));
     
     // In real mode, persist to db
     addDoc(collection(db, 'alerts'), {
        type,
        message,
        timestamp: serverTimestamp(),
        resolved: false
     }).catch(() => {});
  };

const [dynamicZones, setDynamicZones] = useState<Record<string, { x: number; y: number; width: number; height: number }>>(ZONES);

  useEffect(() => {
    if (!mode) return;

    // Listen to settings changes globally
    const settingsRef = doc(db, 'settings', 'global');
    const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.loiteringThreshold !== undefined) loiteringThresholdRef.current = data.loiteringThreshold;
        if (data.idleAlertThreshold !== undefined) idleAlertThresholdRef.current = data.idleAlertThreshold;
        if (data.occupancyThresholds) occupancyLimitsRef.current = data.occupancyThresholds;
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/global'));

    // Listen to real alerts from the database
    const alertQuery = query(collection(db, 'alerts'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribeAlerts = onSnapshot(alertQuery, (snapshot) => {
       const fetchedAlerts: AIAlert[] = [];
       snapshot.forEach(doc => {
          const data = doc.data();
          fetchedAlerts.push({
             id: doc.id,
             type: data.type,
             message: data.message,
             timestamp: data.timestamp?.toDate() || new Date(),
             resolved: data.resolved
          });
       });
       setAlerts(fetchedAlerts);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'alerts'));
    
    // Listen to floor plans to generate zones based on devices placed
    const floorplansQuery = query(collection(db, 'floorplans'));
    const unsubscribeFloorplans = onSnapshot(floorplansQuery, (snapshot) => {
       const newZones: Record<string, {x:number, y:number, width:number, height:number}> = { ...ZONES };
       snapshot.forEach(doc => {
          const plan = doc.data();
          if (plan.devices && Array.isArray(plan.devices)) {
             plan.devices.forEach((dev: any) => {
                newZones[dev.name] = {
                   x: dev.x - 10,
                   y: dev.y - 10,
                   width: 20,
                   height: 20
                };
             });
          }
       });
       setDynamicZones(newZones);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'floorplans'));
    
    const registeredQuery = query(collection(db, 'registered_people'));
    const unsubscribeRegistered = onSnapshot(registeredQuery, (snapshot) => {
       const mapped: Record<string, {name: string, role: string}> = {};
       snapshot.forEach(doc => {
          mapped[doc.id] = { name: doc.data().name, role: doc.data().role || 'Employee' };
       });
       registeredPeopleRef.current = mapped;
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'registered_people'));
    
    // Listen to Assets from Firebase in real mode
    const assetsQuery = collection(db, 'assets');
    const unsubscribeAssets = onSnapshot(assetsQuery, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      if (mode === 'real') setAssets(items);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'assets'));

    // Listen to Vehicles from Firebase in real mode
    const vehiclesQuery = collection(db, 'vehicles');
    const unsubscribeVehicles = onSnapshot(vehiclesQuery, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      if (mode === 'real') setVehicles(items);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'vehicles'));

    return () => {
       unsubscribeSettings();
       unsubscribeAlerts();
       unsubscribeFloorplans();
       unsubscribeRegistered();
       unsubscribeAssets();
       unsubscribeVehicles();
    };
  }, [mode]);

  useEffect(() => {
    if (!mode) return;
    
    let isMounted = true;
    let interval: NodeJS.Timeout;

    if (mode === 'real') {
       setIsLoading(false);
       
       const syncRealtime = async () => {
         if (!isMounted) return;
         try {
           const liveTags = await gaoApi.getTagsInRealtime();
           
           const latestTagInfo: Record<string, any> = {};
           liveTags.forEach(tag => {
              if (tag.TagID) {
                latestTagInfo[tag.TagID] = tag;
              }
           });

           setPeople((prev) => {
             const nextPeople = [...prev];

             if (Object.keys(latestTagInfo).length === 0) return nextPeople;

             Object.values(latestTagInfo).forEach(tag => {
                let p = nextPeople.find(x => x.id === tag.TagID);
                let targetZone = normalizeZoneName(tag.Location, activeProjectId);
                const rect = getZoneRect(targetZone, activeProjectId, dynamicZones);
                
                const registered = registeredPeopleRef.current[tag.TagID];
                const pName = registered ? registered.name : `Tag ${tag.TagID.substring(0, 6).toUpperCase()}`;
                const pRole = registered ? registered.role : 'Visitor';

                if (!p) {
                    p = {
                      id: tag.TagID,
                      name: pName,
                      role: pRole,
                      currentZone: targetZone,
                      presenceState: 'IDLE',
                      dwellTime: 0,
                      x: rect.x + rect.width / 2,
                      y: rect.y + rect.height / 2,
                      lastSeen: new Date(tag.Timestamp + "Z"),
                      trail: []
                    };
                    nextPeople.push(p);

                    addDoc(collection(db, 'alerts'), {
                        type: 'info',
                        message: `System tracked new tag: ${tag.TagID.substring(0, 8)} at ${tag.Location}`,
                        timestamp: new Date()
                    }).catch(error => handleFirestoreError(error, OperationType.WRITE, 'alerts'));

                    // Store real history log
                    addDoc(collection(db, 'tag_history'), {
                        TagID: p.id,
                        name: p.name,
                        role: p.role,
                        fromZone: null,
                        toZone: targetZone,
                        timestamp: new Date()
                    }).catch(() => {});

                } else {
                    p.lastSeen = new Date(tag.Timestamp + "Z");
                    p.name = pName;
                    p.role = pRole;
                    if (p.currentZone !== targetZone) {
                        const oldZone = p.currentZone;
                        p.currentZone = targetZone;
                        p.dwellTime = 0;
                        p.presenceState = 'MOVING';
                        
                        p.x = rect.x + rect.width / 2;
                        p.y = rect.y + rect.height / 2;
                        
                        addDoc(collection(db, 'tag_history'), {
                            TagID: p.id,
                            name: p.name,
                            role: p.role,
                            fromZone: oldZone,
                            toZone: targetZone,
                            timestamp: new Date()
                        }).catch(() => {});
                    }
                }
             });

             // Calculate occupancy bounds 
             const currentOccupancy: Record<string, number> = {};
             nextPeople.forEach(p => {
                const registered = registeredPeopleRef.current[p.id];
                if (registered) {
                   p.name = registered.name;
                   p.role = registered.role;
                }
                currentOccupancy[p.currentZone] = (currentOccupancy[p.currentZone] || 0) + 1;
             });

             Object.entries(currentOccupancy).forEach(([zone, count]) => {
                const limit = occupancyLimitsRef.current[zone];
                if (limit && count > limit) {
                   const now = Date.now();
                   const lastAlerted = alertedZonesRef.current[zone] || 0;
                   if (now - lastAlerted > 60000) {
                      alertedZonesRef.current[zone] = now;
                      addDoc(collection(db, 'alerts'), {
                        type: 'warning',
                        message: `OVERCAPACITY: ${zone} exceeded max occupancy of ${limit}. Currently ${count}.`,
                        timestamp: new Date()
                      }).catch(error => handleFirestoreError(error, OperationType.WRITE, 'alerts'));
                   }
                }
             });

             nextPeople.forEach(p => {
               p.dwellTime += 2; 

               p.trail = p.trail || [];
               p.trail.push({ x: p.x, y: p.y });
               if (p.trail.length > 60) p.trail.shift();

               const zoneRect = getZoneRect(p.currentZone, activeProjectId, dynamicZones);
               const targetX = zoneRect.x + Math.random() * zoneRect.width;
               const targetY = zoneRect.y + Math.random() * zoneRect.height;
               
               p.x += (targetX - p.x) * 0.1;
               p.y += (targetY - p.y) * 0.1;

               if (Math.abs(targetX - p.x) < 2 && Math.abs(targetY - p.y) < 2) {
                  p.presenceState = 'IDLE';
               } else {
                  p.presenceState = 'MOVING';
               }
             });

             return nextPeople;
           });
         } catch (e: any) {
           console.warn('Realtime tag sync warning:', e?.message || e);
         }
       };

       interval = setInterval(syncRealtime, 2000);
    } else if (mode === 'demo') {
       setIsLoading(false);
       
       const zones = getZonesForProject(activeProjectId);
       const initialPeople: Person[] = [
          { id: '1', name: 'Marcus Vance', role: 'Site Superintendent', tradeCompany: 'BuildCorp General', ppeStatus: 'COMPLIANT', certifications: ['OSHA 30', 'Site Safety Manager'], hardhatTagId: 'HH-9021', currentZone: zones[0] || 'People Tracking in Construction', presenceState: 'IDLE', dwellTime: 120, x: 20, y: 30, lastSeen: new Date(), trail: [] },
          { id: '2', name: 'Elena Rostova', role: 'Safety Officer (EHS)', tradeCompany: 'BuildCorp Safety', ppeStatus: 'COMPLIANT', certifications: ['EHS Lead', 'First Aid / CPR'], hardhatTagId: 'HH-1044', currentZone: zones[1] || zones[0] || 'People Tracking in Construction', presenceState: 'MOVING', dwellTime: 45, x: 50, y: 40, lastSeen: new Date(), trail: [] },
          { id: '3', name: 'Jake Miller', role: 'Heavy Equipment Operator', tradeCompany: 'Titan Heavy Machinery', ppeStatus: 'COMPLIANT', certifications: ['Crane Operator L3', 'Excavator cert'], hardhatTagId: 'HH-3392', currentZone: zones[2] || zones[0] || 'People Tracking in Construction', presenceState: 'IDLE', dwellTime: 300, x: 75, y: 25, lastSeen: new Date(), trail: [] },
          { id: '4', name: 'David Chen', role: 'Scaffolder / Rigger', tradeCompany: 'Apex Scaffold Solutions', ppeStatus: 'WARNING', certifications: ['Working at Heights', 'Scaffold Erector'], hardhatTagId: 'HH-7721', currentZone: zones[0] || 'People Tracking in Construction', presenceState: 'MOVING', dwellTime: 90, x: 45, y: 60, lastSeen: new Date(), trail: [] },
          { id: '5', name: 'Carlos Mendez', role: 'Electrician (Subcontractor)', tradeCompany: 'VoltCraft Electrical', ppeStatus: 'COMPLIANT', certifications: ['Master Electrician', 'LOTO Certified'], hardhatTagId: 'HH-4011', currentZone: zones[1] || zones[0] || 'People Tracking in Construction', presenceState: 'IDLE', dwellTime: 180, x: 60, y: 70, lastSeen: new Date(), trail: [] },
          { id: '6', name: 'Robert Jackson', role: 'Structural Steelworker', tradeCompany: 'IronClad Steel Corp', ppeStatus: 'NON_COMPLIANT', certifications: ['Welding CWI', 'Fall Protection'], hardhatTagId: 'HH-5509', currentZone: zones[2] || zones[0] || 'People Tracking in Construction', presenceState: 'MOVING', dwellTime: 60, x: 30, y: 80, lastSeen: new Date(), trail: [] },
          { id: '7', name: 'Sven Lindqvist', role: 'Site Inspector / Visitor', tradeCompany: 'City Structural Audit Dept', ppeStatus: 'COMPLIANT', certifications: ['Building Code Inspector'], hardhatTagId: 'HH-8812', currentZone: zones[0] || 'People Tracking in Construction', presenceState: 'MOVING', dwellTime: 10, x: 15, y: 75, lastSeen: new Date(), trail: [] }
       ];
       
       initialPeople.forEach(p => {
          const rect = getZoneRect(p.currentZone, activeProjectId, dynamicZones);
          p.x = rect.x + Math.random() * rect.width;
          p.y = rect.y + Math.random() * rect.height;
       });
       
       setPeople(initialPeople);

       const initialAssets: Asset[] = [
          { id: 'A1', name: 'Welding Machine #04', type: 'Tool', x: 40, y: 40, status: 'Active' },
          { id: 'A2', name: 'Compressor Unit B', type: 'Tool', x: 25, y: 60, status: 'Idle' },
          { id: 'A3', name: 'Scaffold Bundle C', type: 'Material', x: 70, y: 80, status: 'Stored' }
       ];
       setAssets(initialAssets);

       const initialVehicles: Vehicle[] = [
          { id: 'V1', name: 'Tower Crane #01', type: 'Crane', x: 85, y: 25, status: 'Active' },
          { id: 'V2', name: 'Excavator J-80', type: 'Excavator', x: 20, y: 45, status: 'Moving' }
       ];
       setVehicles(initialVehicles);

       const demoTick = () => {
         if (!isMounted) return;

         setPeople((prev) => {
           const nextPeople = [...prev];
           nextPeople.forEach(p => {
             const oldX = p.x;
             const oldY = p.y;
             
             p.dwellTime += 1; 
             p.trail = p.trail || [];
             p.trail.push({ x: p.x, y: p.y });
             if (p.trail.length > 60) p.trail.shift();

             const zoneRect = getZoneRect(p.currentZone, activeProjectId, dynamicZones);

             // Initialize target coordinates if not present
             if (p.targetX === undefined || p.targetY === undefined) {
               p.targetX = Math.max(2, Math.min(98, zoneRect.x + 2 + Math.random() * (zoneRect.width - 4)));
               p.targetY = Math.max(2, Math.min(98, zoneRect.y + 2 + Math.random() * (zoneRect.height - 4)));
               p.idleRemaining = 0;
             }

             // Handle idling phase vs walking phase
             if (p.idleRemaining !== undefined && p.idleRemaining > 0) {
               p.idleRemaining -= 1;
               p.presenceState = 'IDLE';
               // Subtle human sway micro-motions
               p.x += (Math.random() - 0.5) * 0.01;
               p.y += (Math.random() - 0.5) * 0.01;
             } else {
               const dx = p.targetX - p.x;
               const dy = p.targetY - p.y;
               const distance = Math.sqrt(dx * dx + dy * dy);

               if (distance < 1.0) {
                 p.x = p.targetX;
                 p.y = p.targetY;
                 p.presenceState = 'IDLE';
                 p.idleRemaining = Math.floor(Math.random() * 8) + 4; // dwell for 4 to 12 seconds
               } else {
                 const stepSize = 0.6 + Math.random() * 0.5; // realistic walking velocity
                 p.x += (dx / distance) * Math.min(distance, stepSize);
                 p.y += (dy / distance) * Math.min(distance, stepSize);
                 p.presenceState = 'MOVING';
               }
             }

             // Calculate actual physical movement speed (m/s) & direction heading
             const dx2 = p.x - oldX;
             const dy2 = p.y - oldY;
             const distMeters = Math.sqrt(dx2 * dx2 + dy2 * dy2); // 1% map ~ 1 meter on a 100m site
             p.speed = Number((distMeters * 1.2).toFixed(1)); // speed in m/s
             if (distMeters > 0.05) {
                p.heading = Math.round((Math.atan2(dy2, dx2) * 180 / Math.PI + 360) % 360);
             } else {
                p.speed = 0;
             }

             // Calculate RSSI based on distance to center of zone (-35 to -85 dBm)
             const centerX = zoneRect.x + zoneRect.width / 2;
             const centerY = zoneRect.y + zoneRect.height / 2;
             const distToCenter = Math.sqrt(Math.pow(p.x - centerX, 2) + Math.pow(p.y - centerY, 2));
             p.rssi = Math.max(-88, Math.min(-35, Math.round(-40 - distToCenter * 1.5)));
             p.battery = p.battery ?? (90 + Math.floor(Math.random() * 9));

             // Occasional natural zone transition (smoothly walk across the map to a new zone)
             if (Math.random() < 0.015 && (!p.idleRemaining || p.idleRemaining === 0)) {
                const projZones = getZonesForProject(activeProjectId);
                const randomZone = projZones[Math.floor(Math.random() * projZones.length)];
                if (randomZone !== p.currentZone) {
                   p.currentZone = randomZone;
                   const nextRect = getZoneRect(randomZone, activeProjectId, dynamicZones);
                   p.targetX = Math.max(2, Math.min(98, nextRect.x + 2 + Math.random() * (nextRect.width - 4)));
                   p.targetY = Math.max(2, Math.min(98, nextRect.y + 2 + Math.random() * (nextRect.height - 4)));
                   p.dwellTime = 0;
                }
             }
           });
           return nextPeople;
         });

         setAssets((prev) => {
            return prev.map(a => {
               const oldX = a.x;
               const oldY = a.y;
               const newX = Math.max(5, Math.min(95, a.x + (Math.random() - 0.5) * 0.6));
               const newY = Math.max(5, Math.min(95, a.y + (Math.random() - 0.5) * 0.6));
               const dx = newX - oldX;
               const dy = newY - oldY;
               const distMeters = Math.sqrt(dx * dx + dy * dy);
               const speed = Number((distMeters * 0.8).toFixed(1));
               const heading = distMeters > 0.05 ? Math.round((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360) : a.heading;
               
               return {
                  ...a,
                  x: newX,
                  y: newY,
                  speed,
                  heading,
                  rssi: Math.max(-85, Math.min(-38, Math.round(-45 - (newX % 15) * 2))),
                  battery: a.battery || 94
               };
            });
         });

         setVehicles((prev) => {
            return prev.map(v => {
               const oldX = v.x;
               const oldY = v.y;
               const isCrane = v.type.toLowerCase().includes('crane');

               if (isCrane) {
                  // Cranes rotate jib smoothly and stay stationary
                  const rotationSpeed = (Math.random() - 0.5) * 8; // degrees
                  const nextHeading = Math.round(((v.heading || 0) + rotationSpeed + 360) % 360);
                  return {
                     ...v,
                     heading: nextHeading,
                     speed: 0,
                     status: 'Active (Lifting)',
                     rssi: -42 + Math.round((Math.random() - 0.5) * 3)
                  };
               }

               // Vehicles (excavators, loaders) travel towards destination targets and work
               if (v.targetX === undefined || v.targetY === undefined) {
                  v.targetX = Math.max(10, Math.min(90, v.x + (Math.random() - 0.5) * 30));
                  v.targetY = Math.max(10, Math.min(90, v.y + (Math.random() - 0.5) * 30));
                  v.idleRemaining = 0;
               }

               let nextX = v.x;
               let nextY = v.y;
               let isMoving = false;

               if (v.idleRemaining !== undefined && v.idleRemaining > 0) {
                  v.idleRemaining -= 1;
                  v.status = v.type === 'Excavator' ? 'Active (Excavating)' : 'Idle';
               } else {
                  const dx = v.targetX - v.x;
                  const dy = v.targetY - v.y;
                  const distance = Math.sqrt(dx * dx + dy * dy);

                  if (distance < 2.0) {
                     nextX = v.targetX;
                     nextY = v.targetY;
                     v.idleRemaining = Math.floor(Math.random() * 15) + 8; // Dwell for 8 to 23 seconds
                     v.status = v.type === 'Excavator' ? 'Active (Excavating)' : 'Idle';
                  } else {
                     const speedPercent = 0.8 + Math.random() * 0.6;
                     nextX += (dx / distance) * speedPercent;
                     nextY += (dy / distance) * speedPercent;
                     v.status = 'Moving';
                     isMoving = true;
                  }
               }

               const dx = nextX - oldX;
               const dy = nextY - oldY;
               const distMeters = Math.sqrt(dx * dx + dy * dy);
               const speedKmh = isMoving ? Number((distMeters * 3.6 * 1.5).toFixed(1)) : 0;
               const nextHeading = distMeters > 0.1 ? Math.round((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360) : v.heading;

               // Occasional destination route changes
               if (Math.random() < 0.02 && (!v.idleRemaining || v.idleRemaining === 0)) {
                  v.targetX = Math.max(10, Math.min(90, Math.random() * 100));
                  v.targetY = Math.max(10, Math.min(90, Math.random() * 100));
               }

               const updatedTrail = v.trail ? [...v.trail] : [];
               updatedTrail.push({ x: nextX, y: nextY });
               if (updatedTrail.length > 60) updatedTrail.shift();

               return {
                  ...v,
                  x: nextX,
                  y: nextY,
                  speed: speedKmh,
                  heading: nextHeading,
                  trail: updatedTrail,
                  rssi: Math.max(-80, Math.min(-32, Math.round(-38 - (nextX % 20)))),
                  fuel: Math.max(10, (v.fuel || 85) - 0.02)
               };
            });
         });
       };
       interval = setInterval(demoTick, 1000);
    }

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
  }, [mode, activeProjectId, dynamicZones]);

  return { people, assets, vehicles, alerts, ZONES: dynamicZones, isLoading };
}

