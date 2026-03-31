import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { Save, RotateCcw, Plus, Trash2, Globe, ShieldAlert, Monitor } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings } = useAppStore();
  const [localSettings, setLocalSettings] = useState(settings);
  const [newWhitelistItem, setNewWhitelistItem] = useState('');

  const handleSave = () => {
    updateSettings(localSettings);
  };

  const handleReset = () => {
    setLocalSettings(settings);
  };

  const addWhitelistItem = () => {
    if (newWhitelistItem.trim() && !localSettings.whitelist.includes(newWhitelistItem.trim())) {
      setLocalSettings({
        ...localSettings,
        whitelist: [...localSettings.whitelist, newWhitelistItem.trim()]
      });
      setNewWhitelistItem('');
    }
  };

  const removeWhitelistItem = (item: string) => {
    setLocalSettings({
      ...localSettings,
      whitelist: localSettings.whitelist.filter(i => i !== item)
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-[#03050a] overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#081225] via-[#03050a] to-[#03050a] p-8">
      <div className="max-w-5xl mx-auto w-full space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent tracking-tight">
              Control Center
            </h1>
            <p className="text-gray-400 text-sm mt-1">Configure S.H.I.E.L.D. behavioral engine and connectivity.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleReset}
              className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2 text-sm font-medium"
            >
              <RotateCcw size={16} /> Reset
            </button>
            <button 
              onClick={handleSave}
              className="px-6 py-2 rounded-xl bg-neon-cyan text-black font-bold hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] transition-all flex items-center gap-2 text-sm"
            >
              <Save size={16} /> Save Changes
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* AI Thresholds */}
          <div className="bg-white/[0.02] backdrop-blur-xl rounded-3xl border border-white/5 p-7 space-y-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <ShieldAlert className="text-neon-amber" size={20} />
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-200">Security Thresholds</h2>
            </div>
            
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-xs text-gray-400 uppercase tracking-widest">Suspicious Sensitivity</label>
                  <span className="text-lg font-mono text-neon-amber font-bold">{localSettings.thresholds.suspicious.toFixed(2)}</span>
                </div>
                <input 
                  type="range" 
                  min="0.1" 
                  max="0.6" 
                  step="0.05"
                  value={localSettings.thresholds.suspicious}
                  onChange={(e) => setLocalSettings({
                    ...localSettings,
                    thresholds: { ...localSettings.thresholds, suspicious: parseFloat(e.target.value) }
                  })}
                  className="w-full accent-neon-amber"
                />
                <p className="text-[10px] text-gray-500 italic">Score required to trigger early-warning monitoring.</p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-xs text-gray-400 uppercase tracking-widest">Critical Enforcement</label>
                  <span className="text-lg font-mono text-red-500 font-bold">{localSettings.thresholds.critical.toFixed(2)}</span>
                </div>
                <input 
                  type="range" 
                  min="0.6" 
                  max="0.95" 
                  step="0.05"
                  value={localSettings.thresholds.critical}
                  onChange={(e) => setLocalSettings({
                    ...localSettings,
                    thresholds: { ...localSettings.thresholds, critical: parseFloat(e.target.value) }
                  })}
                  className="w-full accent-red-500"
                />
                <p className="text-[10px] text-gray-500 italic">Score required to initiate automated process neutralization.</p>
              </div>
            </div>
          </div>

          {/* Connection Settings */}
          <div className="bg-white/[0.02] backdrop-blur-xl rounded-3xl border border-white/5 p-7 space-y-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <Globe className="text-neon-cyan" size={20} />
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-200">Network & Bridge</h2>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs text-gray-400 uppercase tracking-widest">WS Bridge Endpoint (Tailscale/Local)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={localSettings.remoteIp}
                    onChange={(e) => setLocalSettings({ ...localSettings, remoteIp: e.target.value })}
                    placeholder="100.x.x.x"
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-neon-cyan font-mono text-sm focus:border-neon-cyan/50 outline-none transition-all"
                  />
                  <input 
                    type="number" 
                    value={localSettings.remotePort}
                    onChange={(e) => setLocalSettings({ ...localSettings, remotePort: parseInt(e.target.value) })}
                    className="w-24 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:border-neon-cyan/50 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-400 uppercase tracking-widest">Telemetry Buffer Limit</label>
                <select 
                  value={localSettings.historyLimit}
                  onChange={(e) => setLocalSettings({ ...localSettings, historyLimit: parseInt(e.target.value) })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-gray-200 text-sm outline-none"
                >
                  <option value={30}>30 Points (2.5 Minutes)</option>
                  <option value={60}>60 Points (5 Minutes)</option>
                  <option value={120}>120 Points (10 Minutes)</option>
                  <option value={300}>300 Points (25 Minutes)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Whitelist / Exclusions */}
          <div className="md:col-span-2 bg-white/[0.02] backdrop-blur-xl rounded-3xl border border-white/5 p-7 space-y-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <Monitor className="text-gray-400" size={20} />
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-200">Process Exclusion List (Hardened)</h2>
            </div>
            
            <p className="text-xs text-gray-500 max-w-2xl">
              Processes in this list will be ignored by the behavioral engine. Use this for trusted backup agents, 
              legitimate heavy I/O tools, or system maintenance workers to reduce False Positives.
            </p>

            <div className="flex gap-3">
              <input 
                type="text" 
                value={newWhitelistItem}
                onChange={(e) => setNewWhitelistItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addWhitelistItem()}
                placeholder="Enter process name (e.g. tar, rsync, tailscaled)"
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-neon-cyan/30 outline-none"
              />
              <button 
                onClick={addWhitelistItem}
                className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all flex items-center gap-2 text-sm"
              >
                <Plus size={18} /> Add
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {localSettings.whitelist.map((item) => (
                <div 
                  key={item}
                  className="flex items-center gap-2 bg-neon-cyan/5 border border-neon-cyan/20 rounded-lg px-3 py-1.5 text-xs text-neon-cyan font-mono group hover:bg-neon-cyan/10 transition-all"
                >
                  {item}
                  <button 
                    onClick={() => removeWhitelistItem(item)}
                    className="text-gray-500 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
