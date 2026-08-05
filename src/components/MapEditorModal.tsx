import React, { useState } from 'react';
import { Edit3, Plus, Trash2, Image, Save, X, Layers, AlertCircle, Check, ArrowUpRight } from 'lucide-react';

export interface ZoneBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  capacity?: number;
  category?: string;
  hazardLevel?: 'normal' | 'warning' | 'critical';
}

interface MapEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  zones: Record<string, ZoneBounds>;
  floorplanUrl: string | null;
  onSaveZones: (updatedZones: Record<string, ZoneBounds>, newFloorplanUrl: string | null) => void;
}

export default function MapEditorModal({
  isOpen,
  onClose,
  zones,
  floorplanUrl,
  onSaveZones
}: MapEditorModalProps) {
  if (!isOpen) return null;

  const [editableZones, setEditableZones] = useState<Record<string, ZoneBounds>>({ ...zones });
  const [activeZoneName, setActiveZoneName] = useState<string>(Object.keys(zones)[0] || '');
  const [customFloorplan, setCustomFloorplan] = useState<string>(floorplanUrl || '');
  const [newZoneTitle, setNewZoneTitle] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const currentZone = editableZones[activeZoneName] || { x: 10, y: 10, width: 25, height: 25 };

  const handleZoneChange = (field: keyof ZoneBounds, value: any) => {
    if (!activeZoneName) return;
    setEditableZones(prev => ({
      ...prev,
      [activeZoneName]: {
        ...prev[activeZoneName],
        [field]: value
      }
    }));
  };

  const handleRenameZone = (newName: string) => {
    if (!activeZoneName || !newName || newName === activeZoneName) return;
    const { [activeZoneName]: targetZone, ...rest } = editableZones;
    setEditableZones({
      ...rest,
      [newName]: targetZone
    });
    setActiveZoneName(newName);
  };

  const handleAddZone = () => {
    const title = newZoneTitle.trim() || `New Sector ${Object.keys(editableZones).length + 1}`;
    if (editableZones[title]) return;

    const newZone: ZoneBounds = {
      x: 35,
      y: 35,
      width: 28,
      height: 22,
      capacity: 15,
      category: 'SITE SECTOR',
      hazardLevel: 'normal'
    };

    setEditableZones(prev => ({ ...prev, [title]: newZone }));
    setActiveZoneName(title);
    setNewZoneTitle('');
  };

  const handleDeleteZone = (nameToDelete: string) => {
    const { [nameToDelete]: removed, ...remaining } = editableZones;
    setEditableZones(remaining);
    setActiveZoneName(Object.keys(remaining)[0] || '');
  };

  const handleSave = () => {
    onSaveZones(editableZones, customFloorplan.trim() || null);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 600);
  };

  const handleResetToDefault = () => {
    const defaultSiteZones: Record<string, ZoneBounds> = {
      'People Tracking in Construction': { x: 5, y: 5, width: 90, height: 90, category: 'PEOPLE TRACKING IN CONSTRUCTION', capacity: 100 }
    };
    setEditableZones(defaultSiteZones);
    setActiveZoneName('People Tracking in Construction');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col my-6 max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#007BC4]/20 border border-[#007BC4]/40 text-[#007BC4] rounded-xl">
              <Edit3 className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-white">Construction Site Map & Sector Layout Editor</h3>
              <p className="text-xs text-slate-400">Configure sector coordinates, boundary dimensions, safety levels & blueprint image</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Layout */}
        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-200">
          
          {/* Left Column: Sector List & Add */}
          <div className="w-full md:w-72 bg-slate-50 p-4 flex flex-col gap-3 shrink-0 overflow-y-auto max-h-[300px] md:max-h-none">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Sectors ({Object.keys(editableZones).length})</span>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="text-[10px] font-bold text-[#007BC4] hover:underline"
              >
                Reset Grid
              </button>
            </div>

            {/* Quick Add Sector */}
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="New Sector Name..."
                value={newZoneTitle}
                onChange={e => setNewZoneTitle(e.target.value)}
                className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#007BC4]"
              />
              <button
                type="button"
                onClick={handleAddZone}
                className="bg-[#007BC4] hover:bg-[#0062a0] text-white p-1.5 rounded-lg transition shrink-0"
                title="Add Sector"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* List of Sectors */}
            <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
              {Object.keys(editableZones).map(zoneName => {
                const isActive = zoneName === activeZoneName;
                return (
                  <div
                    key={zoneName}
                    onClick={() => setActiveZoneName(zoneName)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition ${
                      isActive 
                        ? 'bg-[#007BC4] text-white border-[#007BC4] shadow-sm' 
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate pr-2">{zoneName}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteZone(zoneName);
                      }}
                      className={`p-1 rounded hover:bg-rose-500/20 transition ${isActive ? 'text-white' : 'text-slate-400 hover:text-rose-600'}`}
                      title="Delete Sector"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Zone Parameter Editor & Live Preview */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            
            {activeZoneName && editableZones[activeZoneName] ? (
              <div className="space-y-5">
                
                {/* Sector Rename & Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">Sector Title</label>
                    <input
                      type="text"
                      value={activeZoneName}
                      onChange={e => handleRenameZone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#007BC4] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">Category / Trade Label</label>
                    <input
                      type="text"
                      value={currentZone.category || 'SITE SECTOR'}
                      onChange={e => handleZoneChange('category', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800"
                    />
                  </div>
                </div>

                {/* Coordinates grid (X, Y, Width, Height) */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block">Boundary Dimensions (% of Map)</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">X Position (%)</label>
                      <input
                        type="number"
                        min="1"
                        max="90"
                        value={currentZone.x}
                        onChange={e => handleZoneChange('x', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Y Position (%)</label>
                      <input
                        type="number"
                        min="1"
                        max="90"
                        value={currentZone.y}
                        onChange={e => handleZoneChange('y', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Width (%)</label>
                      <input
                        type="number"
                        min="10"
                        max="95"
                        value={currentZone.width}
                        onChange={e => handleZoneChange('width', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Height (%)</label>
                      <input
                        type="number"
                        min="10"
                        max="95"
                        value={currentZone.height}
                        onChange={e => handleZoneChange('height', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                {/* Capacity & Hazard Level */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">Max Occupancy Capacity</label>
                    <input
                      type="number"
                      value={currentZone.capacity || 20}
                      onChange={e => handleZoneChange('capacity', Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">Hazard Risk Level</label>
                    <select
                      value={currentZone.hazardLevel || 'normal'}
                      onChange={e => handleZoneChange('hazardLevel', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
                    >
                      <option value="normal">Normal Site Sector</option>
                      <option value="warning">Caution / Restricted Access</option>
                      <option value="critical">Critical Hazard / Exclusion Zone</option>
                    </select>
                  </div>
                </div>

                {/* Background Floorplan Overlay Image */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    <Image className="w-4 h-4 text-[#007BC4]" />
                    Custom Site Blueprint / Floorplan Image (URL)
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/site_blueprint.png"
                    value={customFloorplan}
                    onChange={e => setCustomFloorplan(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800"
                  />
                  <p className="text-[10px] text-slate-400">Overlays architectural floorplan graphic beneath the active RFID sector boxes.</p>
                </div>

              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 font-medium border-2 border-dashed border-slate-200 rounded-xl">
                Select or add a sector from the left sidebar to edit parameters.
              </div>
            )}

          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            {saveSuccess ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <Check className="w-4 h-4" /> Map Layout Updated Successfully!
              </span>
            ) : (
              'Save layout to update live tracking boundaries.'
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold rounded-xl text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-[#007BC4] hover:bg-[#0062a0] text-white font-bold rounded-xl text-xs shadow-sm flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Map Configuration
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
