import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import {
  Save, RotateCcw, Plus, Trash2, Globe, ShieldAlert, Monitor,
  Archive, RefreshCw, DownloadCloud, Folder, Clock, File,
  ToggleLeft, ToggleRight, AlertTriangle, CheckCircle2
} from 'lucide-react';
import type { VaultSnapshot } from '../types/vault';

// ─── Rollback Control Panel ───────────────────────────────────────────────────
const RollbackControlPanel: React.FC = () => {
  const {
    vaultStatus, lastVaultOp, queryVault,
    restoreSnapshot, deleteSnapshot, snapshotNow, clearVault, setVaultPaths
  } = useAppStore();

  const [sandboxPath, setSandboxPath] = useState('scripts/shield_sandbox');
  const [vaultPath, setVaultPath] = useState('.shield_vault');
  const [autoSnapshot, setAutoSnapshot] = useState(true);
  const [snapshotFrequency, setSnapshotFrequency] = useState(0);
  const [retentionLimit, setRetentionLimit] = useState(10);
  const [opFeedback, setOpFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // v8.1 — Sync policy to daemon on state change
  useEffect(() => {
    const { socket } = useAppStore.getState();
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ 
        type: 'vault_set_policy', 
        autoSnapshot, 
        snapshotFrequency 
      }));
    }
  }, [autoSnapshot, snapshotFrequency]);

  // Load vault on mount & auto-refresh every 10s
  useEffect(() => {
    queryVault();
    const timer = setInterval(queryVault, 10000);
    return () => clearInterval(timer);
  }, []);

  // Show op result toast
  useEffect(() => {
    if (lastVaultOp) {
      setOpFeedback({ ok: lastVaultOp.success, msg: lastVaultOp.message });
      const t = setTimeout(() => setOpFeedback(null), 4000);
      return () => clearTimeout(t);
    }
  }, [lastVaultOp]);

  const handleRestore = (snap: VaultSnapshot) => {
    const ok = window.confirm(`⚠️ Restore "${snap.key}" ?\n\nThis will OVERWRITE the current sandbox with the snapshot taken at ${new Date(snap.timestamp).toLocaleString()}.`);
    if (ok) restoreSnapshot(snap.key);
  };

  const handleDelete = (snap: VaultSnapshot) => {
    const ok = window.confirm(`Delete snapshot "${snap.key}"? This cannot be undone.`);
    if (ok) deleteSnapshot(snap.key);
  };

  const handleClearAll = () => {
    const ok = window.confirm('⚠️ WARNING: This will permanently delete ALL snapshots in the vault. Proceed?');
    if (ok) clearVault();
  };

  const handleSavePaths = () => {
    setVaultPaths(sandboxPath, vaultPath);
    setOpFeedback({ ok: true, msg: 'Paths updated successfully.' });
    setTimeout(() => setOpFeedback(null), 3000);
  };

  const formatBytes = (b: number) => {
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1048576).toFixed(1)} MB`;
  };

  const levelColor = (level: string) =>
    level === 'HIGH' ? 'text-red-400 border-red-500/30 bg-red-500/10'
    : level === 'MANUAL' ? 'text-neon-cyan border-neon-cyan/30 bg-neon-cyan/10'
    : 'text-amber-400 border-amber-500/30 bg-amber-500/10';

  const vaultHealth = !vaultStatus ? 'UNKNOWN'
    : vaultStatus.totalSnapshots === 0 ? 'EMPTY'
    : 'READY';
  const healthColor = vaultHealth === 'READY' ? '#22c55e' : vaultHealth === 'EMPTY' ? '#eab308' : '#6b7280';

  return (
    <div className="md:col-span-2 space-y-6">

      {/* Op Feedback Toast */}
      {opFeedback && (
        <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl border text-sm font-medium transition-all ${
          opFeedback.ok
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          {opFeedback.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {opFeedback.msg}
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white/[0.02] backdrop-blur-xl rounded-3xl border border-white/5 p-7 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Archive className="text-neon-amber" size={20} />
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-200">Rollback Control Panel</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => queryVault()}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 text-gray-400 hover:text-neon-cyan hover:border-neon-cyan/30 transition-all text-xs"
            >
              <RefreshCw size={12} /> Refresh
            </button>
            <button
              onClick={snapshotNow}
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/20 transition-all text-xs font-bold"
            >
              <DownloadCloud size={12} /> Snapshot Now
            </button>
            <button
              onClick={handleClearAll}
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all text-xs font-bold"
            >
              <Trash2 size={12} /> Clear All
            </button>
          </div>
        </div>

        {/* Vault Health Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: 'Vault Status', value: vaultHealth,
              color: healthColor, icon: <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: healthColor, boxShadow: `0 0 8px ${healthColor}` }} />
            },
            {
              label: 'Total Snapshots', value: vaultStatus?.totalSnapshots ?? '—',
              color: '#06b6d4', icon: <Archive size={14} className="text-neon-cyan" />
            },
            {
              label: 'Vault Size', value: vaultStatus ? formatBytes(vaultStatus.totalSizeBytes) : '—',
              color: '#a78bfa', icon: <Folder size={14} className="text-purple-400" />
            },
            {
              label: 'Last Snapshot', value: vaultStatus?.lastSnapshotTime
                ? new Date(vaultStatus.lastSnapshotTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : 'Never',
              color: '#f59e0b', icon: <Clock size={14} className="text-amber-400" />
            },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-black/20 rounded-2xl border border-white/5 p-4">
              <div className="flex items-center gap-2 mb-2">{icon}<span className="text-[10px] text-gray-500 uppercase tracking-widest">{label}</span></div>
              <span className="text-lg font-bold font-mono text-white">{value}</span>
            </div>
          ))}
        </div>

        {/* Last 5 Files Added */}
        {vaultStatus?.recentFiles && vaultStatus.recentFiles.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <File size={11} /> Last 5 Files Added to Vault
            </p>
            <div className="flex flex-wrap gap-2">
              {vaultStatus.recentFiles.map((f, i) => (
                <span key={i} className="text-[11px] font-mono bg-black/30 border border-white/5 text-gray-300 rounded-lg px-3 py-1">
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Snapshots Table */}
        <div className="rounded-2xl border border-white/5 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#0e1628] border-b border-dark-700/50">
              <tr>
                {['Snapshot Key', 'Process', 'Level', 'Timestamp', 'Size', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {(!vaultStatus || vaultStatus.snapshots.length === 0) ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-600 text-xs font-mono">
                    NO SNAPSHOTS IN VAULT — RUN MOCK_RANSOMWARE.PY OR CLICK "SNAPSHOT NOW"
                  </td>
                </tr>
              ) : (
                vaultStatus.snapshots.map(snap => (
                  <tr key={snap.key} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-4 py-3 font-mono text-xs text-gray-300">{snap.key}</td>
                    <td className="px-4 py-3 text-sm font-bold text-white">{snap.processName}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${levelColor(snap.level)}`}>
                        {snap.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                      {snap.timestamp > 0 ? new Date(snap.timestamp).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{formatBytes(snap.sizeBytes)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleRestore(snap)}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-neon-amber/10 border border-neon-amber/30 text-neon-amber hover:bg-neon-amber/20 transition-all text-[11px] font-bold"
                        >
                          <DownloadCloud size={11} /> Restore
                        </button>
                        <button
                          onClick={() => handleDelete(snap)}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all text-[11px]"
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Path Config & Policy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Path Configuration */}
        <div className="bg-white/[0.02] backdrop-blur-xl rounded-3xl border border-white/5 p-7 shadow-2xl space-y-5">
          <div className="flex items-center gap-3">
            <Folder className="text-purple-400" size={18} />
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-200">Path Configuration</h3>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] text-gray-400 uppercase tracking-widest">Protected Sandbox Path</label>
              <input
                type="text"
                value={sandboxPath}
                onChange={e => setSandboxPath(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-neon-cyan font-mono text-sm focus:border-neon-cyan/50 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-gray-400 uppercase tracking-widest">Vault Storage Path</label>
              <input
                type="text"
                value={vaultPath}
                onChange={e => setVaultPath(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-purple-300 font-mono text-sm focus:border-purple-400/50 outline-none transition-all"
              />
            </div>
            <button
              onClick={handleSavePaths}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all text-sm font-medium flex items-center justify-center gap-2"
            >
              <Save size={14} /> Apply Paths
            </button>
          </div>
        </div>

        {/* Snapshot Policy */}
        <div className="bg-white/[0.02] backdrop-blur-xl rounded-3xl border border-white/5 p-7 shadow-2xl space-y-5">
          <div className="flex items-center gap-3">
            <Clock className="text-neon-cyan" size={18} />
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-200">Snapshot Policy</h3>
          </div>
          <div className="space-y-6">
            {/* Snapshot Frequency Selector */}
            <div className="space-y-3 pt-2 border-t border-white/5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-gray-400 uppercase tracking-widest">Capture Frequency</label>
                <div className="flex items-center gap-2">
                  <Clock size={12} className="text-neon-cyan" />
                  <span className="text-xs font-bold text-neon-cyan">
                    {snapshotFrequency === 0 ? 'On Threat' : `${snapshotFrequency} Min`}
                  </span>
                </div>
              </div>
              <select 
                value={snapshotFrequency}
                onChange={(e) => setSnapshotFrequency(parseInt(e.target.value))}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-gray-200 text-sm outline-none focus:border-neon-cyan/30 transition-all appearance-none cursor-pointer"
              >
                <option value={0}>Reactive (On-Threat Only)</option>
                <option value={1}>Every 1 Minute (Extreme)</option>
                <option value={5}>Every 5 Minutes (Standard)</option>
                <option value={15}>Every 15 Minutes (Routine)</option>
                <option value={60}>Every 60 Minutes (Archive)</option>
              </select>
              <p className="text-[10px] text-gray-500 italic">Determines how often a scheduled capture is taken automatically.</p>
            </div>

            {/* Retention Policy */}
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <label className="text-[10px] text-gray-400 uppercase tracking-widest">Retention Limit</label>
                <span className="text-lg font-mono font-bold text-neon-cyan">{retentionLimit}</span>
              </div>
              <input
                type="range" min={3} max={50} step={1}
                value={retentionLimit}
                onChange={e => setRetentionLimit(parseInt(e.target.value))}
                className="w-full accent-neon-cyan"
              />
              <p className="text-[10px] text-gray-500 italic">
                Keep only the {retentionLimit} most recent snapshots. Oldest are auto-deleted.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Settings Page ───────────────────────────────────────────────────────
export const SettingsPage: React.FC = () => {
  const { settings, updateSettings } = useAppStore();
  const [localSettings, setLocalSettings] = useState(settings);
  const [newWhitelistItem, setNewWhitelistItem] = useState('');

  const handleSave = () => updateSettings(localSettings);
  const handleReset = () => setLocalSettings(settings);

  const addWhitelistItem = () => {
    if (newWhitelistItem.trim() && !localSettings.whitelist.includes(newWhitelistItem.trim())) {
      setLocalSettings({ ...localSettings, whitelist: [...localSettings.whitelist, newWhitelistItem.trim()] });
      setNewWhitelistItem('');
    }
  };

  const removeWhitelistItem = (item: string) =>
    setLocalSettings({ ...localSettings, whitelist: localSettings.whitelist.filter(i => i !== item) });

  return (
    <div className="flex-1 flex flex-col bg-[#03050a] overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#081225] via-[#03050a] to-[#03050a] p-8">
      <div className="max-w-5xl mx-auto w-full space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent tracking-tight">
              Control Center
            </h1>
            <p className="text-gray-400 text-sm mt-1">Configure S.H.I.E.L.D. behavioral engine, connectivity and vault recovery.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleReset} className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2 text-sm font-medium">
              <RotateCcw size={16} /> Reset
            </button>
            <button onClick={handleSave} className="px-6 py-2 rounded-xl bg-neon-cyan text-black font-bold hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] transition-all flex items-center gap-2 text-sm">
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
                <input type="range" min="0.1" max="0.6" step="0.05" value={localSettings.thresholds.suspicious}
                  onChange={(e) => setLocalSettings({ ...localSettings, thresholds: { ...localSettings.thresholds, suspicious: parseFloat(e.target.value) } })}
                  className="w-full accent-neon-amber" />
                <p className="text-[10px] text-gray-500 italic">Score required to trigger early-warning monitoring.</p>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-xs text-gray-400 uppercase tracking-widest">Critical Enforcement</label>
                  <span className="text-lg font-mono text-red-500 font-bold">{localSettings.thresholds.critical.toFixed(2)}</span>
                </div>
                <input type="range" min="0.6" max="0.95" step="0.05" value={localSettings.thresholds.critical}
                  onChange={(e) => setLocalSettings({ ...localSettings, thresholds: { ...localSettings.thresholds, critical: parseFloat(e.target.value) } })}
                  className="w-full accent-red-500" />
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
                <label className="text-xs text-gray-400 uppercase tracking-widest">WS Bridge Endpoint</label>
                <div className="flex gap-2">
                  <input type="text" value={localSettings.remoteIp}
                    onChange={(e) => setLocalSettings({ ...localSettings, remoteIp: e.target.value })}
                    placeholder="100.x.x.x"
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-neon-cyan font-mono text-sm focus:border-neon-cyan/50 outline-none transition-all" />
                  <input type="number" value={localSettings.remotePort}
                    onChange={(e) => setLocalSettings({ ...localSettings, remotePort: parseInt(e.target.value) })}
                    className="w-24 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:border-neon-cyan/50 outline-none transition-all" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400 uppercase tracking-widest">Telemetry Buffer Limit</label>
                <select value={localSettings.historyLimit}
                  onChange={(e) => setLocalSettings({ ...localSettings, historyLimit: parseInt(e.target.value) })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-gray-200 text-sm outline-none">
                  <option value={30}>30 Points (2.5 Minutes)</option>
                  <option value={60}>60 Points (5 Minutes)</option>
                  <option value={120}>120 Points (10 Minutes)</option>
                  <option value={300}>300 Points (25 Minutes)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Known-Process Registry */}
          <div className="md:col-span-2 bg-white/[0.02] backdrop-blur-xl rounded-3xl border border-white/5 p-7 space-y-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <Monitor className="text-neon-cyan" size={20} />
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-200">Known-Process Registry (LSM Throttling)</h2>
            </div>
            <p className="text-xs text-gray-500 max-w-2xl">
              Processes here operate under a Zero Trust model. S.H.I.E.L.D. will continue to score their behavior,
              but will override termination (SIGKILL) with kernel-level I/O Throttling to preserve system stability.
            </p>
            <div className="flex gap-3">
              <input type="text" value={newWhitelistItem}
                onChange={(e) => setNewWhitelistItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addWhitelistItem()}
                placeholder="Enter process name (e.g. tar, rsync)"
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-neon-cyan/30 outline-none" />
              <button onClick={addWhitelistItem}
                className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all flex items-center gap-2 text-sm">
                <Plus size={18} /> Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {localSettings.whitelist.map((item) => (
                <div key={item} className="flex items-center gap-2 bg-neon-cyan/5 border border-neon-cyan/20 rounded-lg px-3 py-1.5 text-xs text-neon-cyan font-mono group hover:bg-neon-cyan/10 transition-all">
                  {item}
                  <button onClick={() => removeWhitelistItem(item)} className="text-gray-500 hover:text-red-500 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Rollback Control Panel */}
          <RollbackControlPanel />

        </div>
      </div>
    </div>
  );
};
