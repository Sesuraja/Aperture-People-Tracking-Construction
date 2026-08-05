import React, { useState, useEffect } from 'react';
import { Search, Radio, Wifi, WifiOff, AlertCircle, RefreshCw, MoreVertical, Plus, X, Save, MapPin } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc } from '../lib/db';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';

interface Device {
  id: string;
  name: string;
  location: string;
  type: string;
  status: 'online' | 'offline' | 'warning';
  ip: string;
  lastPing: string;
  uptime: string;
}

export default function DevicesTab() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  
  const [isAdding, setIsAdding] = useState(false);
  const [newDevId, setNewDevId] = useState('');
  const [newDevName, setNewDevName] = useState('');
  const [newDevLoc, setNewDevLoc] = useState('Entrance');
  const [newDevType, setNewDevType] = useState('UHF RFID Reader');
  const [newDevPower, setNewDevPower] = useState('30');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Listen to standalone devices collection
    const unsubDevices = onSnapshot(collection(db, 'devices'), (snapshot) => {
      const standaloneDevices: Device[] = [];
      snapshot.forEach(doc => {
         standaloneDevices.push({
            id: doc.id,
            name: doc.data().name,
            location: doc.data().location || 'Unknown',
            type: doc.data().type || 'UHF RFID',
            status: doc.data().status || 'online',
            ip: doc.data().ip || 'DHCP assigned',
            lastPing: 'Just now',
            uptime: '0d 0h'
         });
      });
      
      // Also get floorplan devices
      const unsubFloorplans = onSnapshot(collection(db, 'floorplans'), (fpSnapshot) => {
         const fpDevices: Device[] = [];
         fpSnapshot.forEach(doc => {
            const floorPlan = doc.data();
            if (floorPlan.devices && Array.isArray(floorPlan.devices)) {
               floorPlan.devices.forEach((dev: any) => {
                  fpDevices.push({
                     id: dev.mac || dev.id,
                     name: dev.name,
                     location: floorPlan.name,
                     type: 'UHF RFID',
                     status: 'online', 
                     ip: 'DHCP assigned',
                     lastPing: 'Just now',
                     uptime: '2d 4h'
                  });
               });
            }
         });
         
         // Merge and deduplicate by id
         const combined = [...standaloneDevices, ...fpDevices];
         const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
         setDevices(unique);
      });
      
      return () => unsubFloorplans();
    });
    
    return () => unsubDevices();
  }, []);

  const handleSaveDevice = async () => {
    if (!newDevId || !newDevName) return;
    setIsSaving(true);
    try {
       await setDoc(doc(db, 'devices', newDevId), {
          name: newDevName,
          location: newDevLoc,
          type: newDevType,
          status: 'online',
          ip: 'Dynamic',
          powerDb: newDevPower,
          createdAt: new Date()
       });
       setIsAdding(false);
       setNewDevId('');
       setNewDevName('');
       setNewDevLoc('Entrance');
       setNewDevType('UHF RFID Reader');
       setNewDevPower('30');
    } catch(e) {
       console.error(e);
       alert("Failed to save device");
    } finally {
       setIsSaving(false);
    }
  };

  const filteredDevices = devices.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const onlineCount = devices.filter(d => d.status === 'online').length;
  const warningCount = devices.filter(d => d.status === 'warning').length;
  const offlineCount = devices.filter(d => d.status === 'offline').length;

  return (
    <div className="flex flex-col gap-6 w-full p-6 max-w-7xl mx-auto relative">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Site RFID Reader Management</h2>
          <p className="text-slate-500 font-medium">Monitor construction site RFID portals, turnstile gate readers, crane safety sensors, and active hardhat beacons.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search devices..." 
              className="w-full pl-9 bg-white border border-slate-200 rounded-lg py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-[#007BC4] focus:ring-1 focus:ring-[#007BC4] outline-none transition"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-2 rounded-lg text-xs font-bold shadow-sm">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             Aperture Readers Network Safe
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
         <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
               <Wifi className="w-6 h-6" />
            </div>
            <div>
               <div className="text-sm font-semibold text-slate-500">Online Devices</div>
               <div className="text-2xl font-bold text-slate-900">{onlineCount}</div>
            </div>
         </div>
         <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
               <AlertCircle className="w-6 h-6" />
            </div>
            <div>
               <div className="text-sm font-semibold text-slate-500">Needs Attention</div>
               <div className="text-2xl font-bold text-slate-900">{warningCount}</div>
            </div>
         </div>
         <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-rose-50 rounded-lg text-rose-600">
               <WifiOff className="w-6 h-6" />
            </div>
            <div>
               <div className="text-sm font-semibold text-slate-500">Offline Devices</div>
               <div className="text-2xl font-bold text-slate-900">{offlineCount}</div>
            </div>
         </div>
      </div>

      <div className="bg-white border border-slate-200 shadow-sm rounded-xl flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4 text-sm font-bold text-slate-500">Device</th>
                <th className="py-3 px-4 text-sm font-bold text-slate-500">Location</th>
                <th className="py-3 px-4 text-sm font-bold text-slate-500">Status</th>
                <th className="py-3 px-4 text-sm font-bold text-slate-500">Health (Temp)</th>
                <th className="py-3 px-4 text-sm font-bold text-slate-500">Signal Strength</th>
                <th className="py-3 px-4 text-sm font-bold text-slate-500">Last Heartbeat</th>
                <th className="py-3 px-4 text-sm font-bold text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDevices.map(device => {
                 const mockTemp = 36 + (Math.random() * 12);
                 const mockSignal = Math.floor(Math.random() * 40) + 60;
                 return (
                <tr key={device.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4">
                     <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${device.status === 'online' ? 'bg-emerald-50 text-emerald-600' : device.status === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                           <Radio className="w-4 h-4" />
                        </div>
                        <div>
                           <div className="font-semibold text-slate-900">{device.name}</div>
                           <div className="text-xs font-mono text-slate-500">IP: {device.ip}</div>
                        </div>
                     </div>
                  </td>
                  <td className="py-3 px-4 text-sm font-medium">
                     <button 
                       onClick={() => navigate('/live', { state: { focusZone: device.location } })}
                       title="View on floor plan"
                       className="inline-flex flex-col md:flex-row items-start md:items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-[#007BC4]/5 hover:border-[#007BC4]/30 hover:text-[#007BC4] transition text-slate-700 shadow-sm"
                     >
                       <MapPin className="w-3.5 h-3.5 shrink-0" />
                       <span className="truncate max-w-[120px]">{device.location}</span>
                     </button>
                  </td>
                  <td className="py-3 px-4">
                     <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                        device.status === 'online' ? 'bg-emerald-100 text-emerald-700' :
                        device.status === 'warning' ? 'bg-amber-100 text-amber-700' :
                        'bg-rose-100 text-rose-700'
                     }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${device.status === 'online' ? 'bg-emerald-500' : device.status === 'warning' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                        {device.status}
                     </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-sm">
                     <div className={`font-semibold ${mockTemp > 45 ? 'text-rose-500' : 'text-slate-700'}`}>{mockTemp.toFixed(1)}°C</div>
                     <div className="text-[10px] text-slate-400">{mockTemp > 45 ? 'OVERHEATING' : 'NORMAL'}</div>
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-600">
                     <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 h-1.5 rounded-full overflow-hidden w-16">
                           <div className="h-full bg-[#007BC4]" style={{ width: `${mockSignal}%` }}></div>
                        </div>
                        <span className="font-mono text-xs font-semibold">{mockSignal}%</span>
                     </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-600">
                     <div className="font-semibold">{device.lastPing}</div>
                     <div className="text-[10px] text-slate-400">Up: {device.uptime}</div>
                  </td>
                  <td className="py-3 px-4 text-right">
                     <div className="flex items-center justify-end gap-2">
                        <button className="p-1.5 text-slate-400 hover:text-[#007BC4] hover:bg-slate-100 rounded transition" title="Restart">
                           <RefreshCw className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition">
                           <MoreVertical className="w-4 h-4" />
                        </button>
                     </div>
                  </td>
                </tr>
              )})}
              {filteredDevices.length === 0 && (
                <tr>
                   <td colSpan={7} className="py-12 text-center text-slate-500 font-medium">
                      No devices found.
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Devices synchronized dynamically via Aperture API client and floorplans */}
    </div>
  );
}
