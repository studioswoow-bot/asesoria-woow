"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Image from 'next/image';

// Use local proxy instead of direct URL to bypass CORS
const API_URL = '/api/monitoring/cbhours';
const REFRESH_INTERVAL_MS = 60000;
const STORAGE_KEY = 'trackedModelsList';

interface ModelStats {
  room_status: string;
  viewers?: number;
  followers?: number;
  rank?: number;
  grank?: number;
}

interface ApiData {
  [key: string]: ModelStats;
}

export default function RealTimeMonitor() {
  const [usernamesText, setUsernamesText] = useState("");
  const [apiData, setApiData] = useState<ApiData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [timeAgo, setTimeAgo] = useState(0);
  const [sortOrder, setSortOrder] = useState<'status' | 'name' | 'rank' | 'grank'>('status');
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const refreshRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-start helper
  const startMonitoring = useCallback((initialNames?: string) => {
    const namesSource = initialNames !== undefined ? initialNames : usernamesText;
    if (!namesSource.trim()) return;

    localStorage.setItem(STORAGE_KEY, namesSource);
    fetchData(namesSource);
    
    if (refreshRef.current) clearInterval(refreshRef.current);
    refreshRef.current = setInterval(() => fetchData(namesSource), REFRESH_INTERVAL_MS);
    
    setIsCollapsed(false);
  }, [usernamesText]);

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setUsernamesText(saved);
      // Auto-start if saved names exist, matching original HTML behavior
      if (saved.trim()) {
        setTimeout(() => startMonitoring(saved), 100);
      }
    }
  }, []);

  const fetchData = useCallback(async (names: string) => {
    const list = names
      .replace(/\n/g, ',')
      .split(',')
      .map(name => name.trim())
      .filter(name => name);
    
    if (list.length === 0) {
      setApiData({});
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Calling our proxy route
      const response = await fetch(`${API_URL}?action=get_live&usernames=${encodeURIComponent(list.join(','))}`);
      const result = await response.json();

      if (!response.ok || result.status === 'error') {
        throw new Error(result.message || 'Error de conexión con el monitor');
      }

      setApiData(result.data || {});
      setLastUpdated(Date.now());
    } catch (err: any) {
      console.error("Error fetching monitoring data:", err);
      setError(err.message || "Error al sincronizar datos");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleStartMonitor = () => {
    startMonitoring();
  };

  useEffect(() => {
    if (lastUpdated) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeAgo(Math.floor((Date.now() - lastUpdated) / 1000));
      }, 1000);
      setTimeAgo(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lastUpdated]);

  useEffect(() => {
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, []);

  const sortedData = useMemo(() => {
    const list = usernamesText
      .replace(/\n/g, ',')
      .split(',')
      .map(name => name.trim())
      .filter(name => name);

    const statusPriority: Record<string, number> = { 'Online': 0, 'Offline': 1, 'Missing Trophy': 2, 'Not Found': 3 };

    const data = list.map(name => {
      const apiEntryKey = Object.keys(apiData).find(k => k.toLowerCase() === name.toLowerCase());
      if (apiEntryKey) {
        return { name: apiEntryKey, stats: apiData[apiEntryKey] };
      } else {
        return { name, stats: { room_status: 'Not Found' } };
      }
    });

    return data.sort((a, b) => {
      // Prioritize Global Name sort if selected
      if (sortOrder === 'name') {
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      }

      // Default Status priority
      const pA = statusPriority[a.stats.room_status] ?? 99;
      const pB = statusPriority[b.stats.room_status] ?? 99;
      
      if (pA !== pB) return pA - pB;

      // Within same status (especially Online)
      if (a.stats.room_status === 'Online' && b.stats.room_status === 'Online') {
        if (sortOrder === 'rank') {
          const rA = a.stats.rank || 999999;
          const rB = b.stats.rank || 999999;
          if (rA !== rB) return rA - rB;
        }
        if (sortOrder === 'grank') {
          const gA = a.stats.grank || 999999;
          const gB = b.stats.grank || 999999;
          if (gA !== gB) return gA - gB;
        }
      }

      // Final fallback to name
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  }, [usernamesText, apiData, sortOrder]);

  if (!isMounted) return null;

  return (
    <div className="w-full space-y-4">
      {/* Header Bar */}
      <div className="bg-panel-dark border border-text-main/5 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative h-10 w-24 md:w-32">
            <Image 
              src="/logo-studio.webp" 
              alt="WooW Estudios" 
              fill 
              className="object-contain"
            />
          </div>
          <div className="h-8 w-px bg-text-main/10 hidden md:block"></div>
          <div>
            <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
              Monitoreo en Vivo
              <span className="flex h-2 w-2 rounded-full bg-pink-500 animate-pulse"></span>
            </h3>
            <p className="text-[10px] text-text-muted uppercase font-black tracking-widest">Chaturbate Real-Time Stats</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {lastUpdated && !isCollapsed && (
            <div className="px-3 py-1.5 bg-background-page rounded-lg border border-text-main/5 flex items-center gap-2">
              {loading ? (
                <div className="size-3 border-2 border-pink-500/20 border-t-pink-500 rounded-full animate-spin"></div>
              ) : (
                <span className="material-symbols-outlined text-emerald-500 text-[14px]">sync</span>
              )}
              <span className="text-[10px] font-bold text-text-muted uppercase">Hace {timeAgo}s</span>
            </div>
          )}
          
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-text-main/5 hover:bg-text-main/10 text-text-main rounded-xl border border-text-main/5 text-xs font-bold transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">
              {isCollapsed ? 'expand_more' : 'expand_less'}
            </span>
            {isCollapsed ? 'Abrir Monitoreo' : 'Contraer'}
          </button>
        </div>
      </div>

      {/* Main Content (Collapsible) */}
      {!isCollapsed && (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
          {/* Config Area */}
          <div className="bg-panel-dark/50 backdrop-blur-md border border-text-main/10 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Modelos a monitorear</label>
                <textarea 
                  value={usernamesText}
                  onChange={(e) => setUsernamesText(e.target.value)}
                  placeholder="nombres separadas por comas..."
                  className="w-full bg-background-page/50 border border-text-main/10 rounded-xl p-3 text-sm text-text-main focus:ring-1 focus:ring-pink-500 outline-none min-h-[80px] transition-all resize-none"
                />
              </div>
              <div className="flex flex-col justify-end">
                <button 
                  onClick={handleStartMonitor}
                  disabled={loading}
                  className="px-6 py-3 bg-gradient-to-tr from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400 text-white font-bold rounded-xl shadow-lg shadow-pink-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[20px]">bolt</span>
                  Sincronizar
                </button>
              </div>
            </div>
            
            {/* Error Message */}
            {error && (
              <div className="mt-4 p-3 bg-red-900/20 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-400 text-xs font-bold animate-in fade-in duration-300">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                <span>{error}</span>
              </div>
            )}

            {/* Sorting */}
            {usernamesText.trim() && (
              <div className="mt-6 flex flex-wrap items-center gap-3 pt-6 border-t border-text-main/5">
                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Ordenar por:</span>
                <div className="flex gap-2 p-1 bg-background-page rounded-lg border border-text-main/5">
                  {(['status', 'name', 'rank', 'grank'] as const).map((o) => (
                    <button
                      key={o}
                      onClick={() => setSortOrder(o)}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${
                        sortOrder === o 
                          ? 'bg-pink-600 text-white shadow-md' 
                          : 'text-text-muted hover:text-text-main'
                      }`}
                    >
                      {o === 'status' ? 'Estado' : o === 'name' ? 'Nombre' : o.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Grid de Resultados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {sortedData.length === 0 ? (
              <div className="col-span-full py-20 text-center border-2 border-dashed border-text-main/10 rounded-3xl bg-panel-dark/20 text-text-muted font-medium italic">
                No hay modelos configuradas para monitoreo
              </div>
            ) : (
              sortedData.map(({ name, stats }) => (
                <ModelCard key={name} name={name} stats={stats} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ModelCard({ name, stats }: { name: string, stats: ModelStats }) {
  const isOnline = stats.room_status === 'Online';
  const isNotFound = stats.room_status === 'Not Found';
  const isMissingTrophy = stats.room_status === 'Missing Trophy';

  const getStatusColor = () => {
    if (isOnline) return "emerald";
    if (isNotFound) return "slate";
    if (isMissingTrophy) return "red";
    return "orange";
  };

  const statusColor = getStatusColor();
  const statusLabels: Record<string, string> = {
    'Online': 'En Línea',
    'Offline': 'Desconectada',
    'Missing Trophy': 'Sin Trofeo',
    'Not Found': 'No Encontrada'
  };

  return (
    <div className={`group bg-panel-dark border border-text-main/5 p-4 rounded-2xl shadow-lg transition-all hover:border-${statusColor}-500/50 hover:shadow-${statusColor}-500/5 relative overflow-hidden`}>
      {/* Status Bar */}
      <div className={`absolute top-0 left-0 w-full h-1 bg-${statusColor}-500/20`}>
        <div className={`h-full bg-${statusColor}-500 ${isOnline ? 'w-full animate-pulse' : 'w-1/3'}`}></div>
      </div>

      <div className="flex justify-between items-start mb-4">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-text-main truncate pr-2 group-hover:text-pink-500 transition-colors" title={name}>
            {name}
          </h4>
          <span className={`text-[9px] font-black uppercase tracking-widest text-${statusColor}-500`}>
            {statusLabels[stats.room_status] || stats.room_status}
          </span>
        </div>
        <div className={`size-2 rounded-full bg-${statusColor}-500 ${isOnline ? 'animate-ping' : ''}`}></div>
      </div>

      {isOnline ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-background-page/50 rounded-lg p-2 border border-text-main/5">
            <span className="text-[8px] text-text-muted uppercase font-black block mb-0.5">Viewers</span>
            <span className="text-xs font-bold text-text-main">{stats.viewers?.toLocaleString() || 0}</span>
          </div>
          <div className="bg-background-page/50 rounded-lg p-2 border border-text-main/5">
            <span className="text-[8px] text-text-muted uppercase font-black block mb-0.5">Followers</span>
            <span className="text-xs font-bold text-text-main">{stats.followers?.toLocaleString() || 0}</span>
          </div>
          <div className="bg-background-page/50 rounded-lg p-2 border border-text-main/5 border-pink-500/10">
            <span className="text-[8px] text-pink-500 uppercase font-black block mb-0.5">Rank</span>
            <span className="text-xs font-bold text-pink-500">#{stats.rank || 'N/A'}</span>
          </div>
          <div className="bg-background-page/50 rounded-lg p-2 border border-text-main/5 border-pink-500/10">
            <span className="text-[8px] text-pink-500 uppercase font-black block mb-0.5">G-Rank</span>
            <span className="text-xs font-bold text-pink-500">#{stats.grank || 'N/A'}</span>
          </div>
        </div>
      ) : isNotFound ? (
        <div className="h-16 flex flex-col items-center justify-center border border-dashed border-text-main/10 rounded-xl bg-background-page/20">
          <span className="text-[10px] text-text-muted italic">No indexada</span>
        </div>
      ) : (
        <div className="h-16 flex items-center justify-center rounded-xl bg-background-page/20 border border-text-main/5">
          <span className="text-[10px] text-text-muted italic tracking-widest uppercase">Desconectada</span>
        </div>
      )}
    </div>
  );
}
