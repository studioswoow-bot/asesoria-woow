"use client";

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import LoadingScreen from "@/components/common/LoadingScreen";
import { db } from "@/lib/firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

function AnalyticsContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  
  // Generar fechas rápidas (Quincenas de los últimos 3 meses)
  const generateQuickDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 3; i++) {
       const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
       const year = d.getFullYear();
       const month = String(d.getMonth() + 1).padStart(2, '0');
       const lastDay = new Date(year, d.getMonth() + 1, 0).getDate();
       
       dates.push({
         label: `Q2 ${month}/${year}`,
         value: `${year}-${month}-16_to_${year}-${month}-${String(lastDay).padStart(2, '0')}`
       });
       dates.push({
         label: `Q1 ${month}/${year}`,
         value: `${year}-${month}-01_to_${year}-${month}-15`
       });
    }
    return dates;
  };

  const quickDates = generateQuickDates();
  
  // Custom Date Range State
  const [startDate, setStartDate] = useState(quickDates[0].value.split('_to_')[0]);
  const [endDate, setEndDate] = useState(quickDates[0].value.split('_to_')[1]);

  const period = `${startDate}_to_${endDate}`;
  
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [modelData, setModelData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"Chaturbate" | "Stripchat" | "Combined">("Chaturbate");

  const [cbMetrics, setCbMetrics] = useState<any>(null);
  const [scMetrics, setScMetrics] = useState<any>(null);

  const [globalMetrics, setGlobalMetrics] = useState<any>(null);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [selectedTipper, setSelectedTipper] = useState<any>(null);

  useEffect(() => {
    if (!id) {
       setLoading(false);
       return;
    }

    // Cargar perfil básico
    const fetchModel = async () => {
       const modelRef = doc(db, "models", id);
       const modelSnap = await getDoc(modelRef);
       if (modelSnap.exists()) {
          setModelData(modelSnap.data());
       }
       setLoading(false);
    };
    fetchModel();
  }, [id]);

  // Cargar métricas globales de 7288e (Métricas base de facturación total de todas las plataformas)
  useEffect(() => {
    if (!id || !user || !period) return;
    const fetchGlobalMetrics = async () => {
      setLoadingGlobal(true);
      try {
        const token = await user.getIdToken();
        const reqStartDate = startDate;
        const reqEndDate = endDate;

        const res = await fetch(`/api/action-plans/metrics?modelId=${id}&start=${reqStartDate}&end=${reqEndDate}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        
        if (json.globalMetrics) {
           setGlobalMetrics(json.globalMetrics);
        }
      } catch (err) {
        console.error("Error fetching global metrics:", err);
      } finally {
        setLoadingGlobal(false);
      }
    };
    fetchGlobalMetrics();
  }, [id, period, user]);

  // Suscribirse a los datos de la caché para el periodo seleccionado de ambas plataformas
  useEffect(() => {
    if (!id) return;
    const cacheDocCbId = `${id}_${period}_Chaturbate`;
    const cacheDocScId = `${id}_${period}_Stripchat`;

    const unsubCb = onSnapshot(doc(db, "modelos_analytics_cache_v2", cacheDocCbId), (snap) => {
       setCbMetrics(snap.exists() ? snap.data() : null);
    });
    
    const unsubSc = onSnapshot(doc(db, "modelos_analytics_cache_v2", cacheDocScId), (snap) => {
       setScMetrics(snap.exists() ? snap.data() : null);
    });

    return () => {
       unsubCb();
       unsubSc();
    };
  }, [id, period]);

  const getCombinedMetrics = () => {
    if (!cbMetrics && !scMetrics) return null;
    const cb = cbMetrics || { total_tokens: 0, usd_earnings: 0, new_followers: 0, tph: 0, icr: 0, platform_total_hours: 0, history: [] };
    const sc = scMetrics || { total_tokens: 0, usd_earnings: 0, new_followers: 0, tph: 0, icr: 0, platform_total_hours: 0, history: [] };
    
    const tippersMap: any = {};
    const tippersDetailsMap: any = {};
    
    const addSuffix = (name: string, suffix: string) => {
       if (name.includes(' (CB)') || name.includes(' (SC)')) return name;
       return `${name} (${suffix})`;
    };

    [...(cb.top_tippers||[]).map((t:any) => ({...t, name: addSuffix(t.name, "CB")})), 
     ...(sc.top_tippers||[]).map((t:any) => ({...t, name: addSuffix(t.name, "SC")}))].forEach(t => {
       tippersMap[t.name] = (tippersMap[t.name] || 0) + (Number(t.tokens)||0);
       
       if (t.details) {
         if (!tippersDetailsMap[t.name]) {
            tippersDetailsMap[t.name] = { days: new Set(), hoursDistribution: {} };
         }
         t.details.days?.forEach((d:string) => tippersDetailsMap[t.name].days.add(d));
         Object.entries(t.details.hoursDistribution || {}).forEach(([h, tok]) => {
            tippersDetailsMap[t.name].hoursDistribution[h] = (tippersDetailsMap[t.name].hoursDistribution[h] || 0) + Number(tok);
         });
       }
    });

    const top_tippers = Object.entries(tippersMap).map(([name, tokens]) => {
      let details = null;
      if (tippersDetailsMap[name]) {
         let topHour = { hour: "00", tokens: 0 };
         Object.entries(tippersDetailsMap[name].hoursDistribution).forEach(([h, tok]) => {
            if ((tok as number) > topHour.tokens) topHour = { hour: h, tokens: tok as number };
         });
         details = {
           days: Array.from(tippersDetailsMap[name].days).sort(),
           topHour,
           hoursDistribution: tippersDetailsMap[name].hoursDistribution
         };
      }
      return { name, tokens, details };
    }).sort((a:any,b:any) => b.tokens - a.tokens).slice(0,10);
  
    const hourlyMap: any = {};
    [...(cb.hourly_distribution||[]), ...(sc.hourly_distribution||[])].forEach(h => {
       if(!hourlyMap[h.hour]) hourlyMap[h.hour] = { hour: h.hour, tokens: 0, users: 0, avg_viewers: 0 };
       hourlyMap[h.hour].tokens += h.tokens;
       hourlyMap[h.hour].users += h.users; 
       hourlyMap[h.hour].avg_viewers += (h.avg_viewers || 0);
    });
    const hourly_distribution = Object.values(hourlyMap).sort((a:any, b:any) => a.hour.localeCompare(b.hour));
    
    let peak_hour = "00";
    let peak_tokens = 0;
    hourly_distribution.forEach((h:any) => {
      if(h.tokens > peak_tokens) { peak_tokens = h.tokens; peak_hour = h.hour; }
    });
  
    const combinedBestRank = Math.min(...[cb.best_rank, sc.best_rank].filter(r => r > 0)) || 0;
    let combinedRankDetails = null;
    if (combinedBestRank > 0) {
       if (combinedBestRank === cb.best_rank) combinedRankDetails = cb.best_rank_details;
       else combinedRankDetails = sc.best_rank_details;
    }

    const combinedBestGrank = Math.min(...[cb.best_grank, sc.best_grank].filter(r => r > 0)) || 0;
    let combinedGrankDetails = null;
    if (combinedBestGrank > 0) {
       if (combinedBestGrank === cb.best_grank) combinedGrankDetails = cb.best_grank_details;
       else combinedGrankDetails = sc.best_grank_details;
    }

    // Merge history
    const historyMap: Record<string, any> = {};
    const cbHistory = [...(cb.history || [])].sort((a: any, b: any) => a.date.localeCompare(b.date));
    const scHistory = [...(sc.history || [])].sort((a: any, b: any) => a.date.localeCompare(b.date));
    
    const cbWithDelta = cbHistory.map((d: any, index: number, arr: any[]) => ({
       ...d, 
       new_followers: index === 0 ? 0 : Math.max(0, (d.followers || 0) - (arr[index - 1].followers || 0))
    }));
    
    const scWithDelta = scHistory.map((d: any, index: number, arr: any[]) => ({
       ...d, 
       new_followers: index === 0 ? 0 : Math.max(0, (d.followers || 0) - (arr[index - 1].followers || 0))
    }));

    [...cbWithDelta, ...scWithDelta].forEach((entry: any) => {
        if (!historyMap[entry.date]) {
            historyMap[entry.date] = { date: entry.date, followers: 0, new_followers: 0, rank: 999999, grank: 999999 };
        }
        historyMap[entry.date].followers += (entry.followers || 0); // Keep absolute sum mapping just in case
        historyMap[entry.date].new_followers += (entry.new_followers || 0);
        if (entry.rank && entry.rank < historyMap[entry.date].rank) historyMap[entry.date].rank = entry.rank;
        if (entry.grank && entry.grank < historyMap[entry.date].grank) historyMap[entry.date].grank = entry.grank;
    });

    const combinedHistory = Object.values(historyMap)
        .map((h: any) => ({
            ...h,
            rank: h.rank === 999999 ? null : h.rank,
            grank: h.grank === 999999 ? null : h.grank
        }))
        .sort((a: any, b: any) => a.date.localeCompare(b.date));

    const combinedScheduleMatrix = Array.from({length: 7}, (_, dayIndex) => ({
      day: dayIndex,
      hours: Array.from({length: 24}, (_, hIndex) => ({ hour: hIndex, online_snapshots: 0, tokens: 0, average_viewers: 0, viewers_sum: 0 }))
    }));

    const cbSchedule = cb.schedule_matrix || [];
    const scSchedule = sc.schedule_matrix || [];

    for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
            const cbCell = cbSchedule[d]?.hours?.[h] || { online_snapshots: 0, tokens: 0, average_viewers: 0, viewers_sum: 0 };
            const scCell = scSchedule[d]?.hours?.[h] || { online_snapshots: 0, tokens: 0, average_viewers: 0, viewers_sum: 0 };
            combinedScheduleMatrix[d].hours[h] = {
                hour: h,
                online_snapshots: cbCell.online_snapshots + scCell.online_snapshots,
                tokens: cbCell.tokens + scCell.tokens,
                viewers_sum: cbCell.viewers_sum + scCell.viewers_sum,
                average_viewers: 0
            };
            if (combinedScheduleMatrix[d].hours[h].online_snapshots > 0) {
                 combinedScheduleMatrix[d].hours[h].average_viewers = Math.round(combinedScheduleMatrix[d].hours[h].viewers_sum / combinedScheduleMatrix[d].hours[h].online_snapshots);
            }
        }
    }

    const total_tokens = (cb.total_tokens||0) + (sc.total_tokens||0);
    const platform_total_hours = (cb.platform_total_hours||0) + (sc.platform_total_hours||0);
    const expectedHoursMensual = globalMetrics?.expectedHoursMensual || 120; // fallback if globalMetrics not ready
    const tph = platform_total_hours > 0 ? total_tokens / platform_total_hours : 0;
    const icj = expectedHoursMensual > 0 ? (platform_total_hours / expectedHoursMensual) * 100 : 0;
    const icr = tph * (icj / 100);

    return {
      total_tokens,
      platform_total_hours,
      tph: Number(tph.toFixed(2)),
      icj: Number(icj.toFixed(1)),
      icr: Number(icr.toFixed(2)),
      tip_tokens: (cb.tip_tokens||0) + (sc.tip_tokens||0),
      private_tokens: (cb.private_tokens||0) + (sc.private_tokens||0),
      income_concepts: {
        private: (cb.income_concepts?.private||0) + (sc.income_concepts?.private||0),
        spy: (cb.income_concepts?.spy||0) + (sc.income_concepts?.spy||0),
        public: (cb.income_concepts?.public||0) + (sc.income_concepts?.public||0),
        videos: (cb.income_concepts?.videos||0) + (sc.income_concepts?.videos||0),
        photos: (cb.income_concepts?.photos||0) + (sc.income_concepts?.photos||0),
        other: (cb.income_concepts?.other||0) + (sc.income_concepts?.other||0),
      },
      intents: {
        privates: (cb.intents?.privates||0) + (sc.intents?.privates||0),
        requestedVideo: (cb.intents?.requestedVideo||0) + (sc.intents?.requestedVideo||0)
      },
      top_tippers,
      hourly_distribution,
      peak_hour,
      best_rank: combinedBestRank,
      best_rank_details: combinedRankDetails,
      best_grank: combinedBestGrank,
      best_grank_details: combinedGrankDetails,
      follower_growth: (cb.follower_growth||0) + (sc.follower_growth||0),
      followers_current: Math.max(...[cb.followers_current, sc.followers_current].filter(f => f > 0)) || 0,
      history: combinedHistory,
      schedule_matrix: combinedScheduleMatrix,
      synced_at: cb.synced_at || sc.synced_at || new Date().toISOString()
    };
  };

  const metrics = activeTab === "Chaturbate" ? cbMetrics : (activeTab === "Stripchat" ? scMetrics : getCombinedMetrics());
  const evolutionData = metrics?.history || [];

  const handleManualSync = async () => {
    if (!user || !id || !modelData) return;
    setSyncing(true);
    try {
      const token = await user.getIdToken();
      const nickname = modelData.nickname || modelData.name;

      const platformsToSync = activeTab === "Combined" ? ["Chaturbate", "Stripchat"] : [activeTab];

      for (const platform of platformsToSync) {
        const response = await fetch('/api/analytics/sync-drive', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify({
             modelId: id,
             nickname: nickname,
             period: period,
             platform: platform
          })
        });
        const data = await response.json();
        if (!data.success) {
           const detailedError = data.message || data.error || "Error desconocido";
           alert(`Error de sincronización (${platform}): ${detailedError}`);
        }
      }
    } catch (error) {
      console.error("Sync error:", error);
      alert("Hubo un error de conexión al sincronizar.");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <LoadingScreen message="Cargando perfil..." />;

  // Filter study internal users from the top tippers
  const EXCLUDED_STUDIO_USERS = ["woow_studies", "woow_admin", "woow_monitor", "estudioswoow", "woow_estudios", "woow_estudio"];
  
  const rawTopUsers = (metrics?.top_tippers || []);
  const topUsers = rawTopUsers
    .map((u: any) => {
      if (u.name?.includes(' (CB)') || u.name?.includes(' (SC)')) return u;
      const suffix = activeTab === "Chaturbate" ? "(CB)" : (activeTab === "Stripchat" ? "(SC)" : "");
      return { ...u, name: suffix ? `${u.name} ${suffix}` : u.name };
    })
    .filter((u: any) => {
      const cleanName = u.name?.toLowerCase().split(' (')[0];
      return !EXCLUDED_STUDIO_USERS.includes(cleanName);
    });

  // Recalculate total income excluding specific studio accounts if they are in the top list
  // This provides a more accurate view of real external revenue
  const excludedTokens = rawTopUsers
    .filter((u: any) => {
      const name = u.name?.toLowerCase().split(' (')[0];
      return EXCLUDED_STUDIO_USERS.includes(name);
    })
    .reduce((acc: number, u: any) => acc + (Number(u.tokens) || 0), 0);
  
  const totalIncome = Math.max(0, (metrics?.total_tokens || 0) - excludedTokens);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-sidebar-dark/40 p-8 rounded-3xl border border-slate-200 dark:border-primary/10 shadow-xl shadow-primary/5">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className={`size-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 p-1 shadow-lg shadow-primary/20`}>
              <div className="size-full bg-sidebar-dark rounded-xl flex items-center justify-center text-white font-black text-2xl uppercase">
                {modelData?.name?.[0] || modelData?.nickname?.[0] || '?'}
              </div>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              {modelData?.name} ({modelData?.nickname || "sin_apodo"})
              <span className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-primary/10 px-2 py-1 rounded-lg border border-slate-200 dark:border-primary/20 uppercase tracking-widest">{id?.substring(0, 8) || '...'}</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 uppercase text-xs tracking-tighter">
              Datos Extraídos mediante Archivos Drive
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
           <div className="flex flex-col sm:flex-row gap-2 items-center">
             <select 
                value={quickDates.find(q => q.value === period)?.value || ""}
                onChange={(e) => {
                  if(e.target.value) {
                    const [s, eDate] = e.target.value.split('_to_');
                    setStartDate(s);
                    setEndDate(eDate);
                  }
                }}
                className="bg-slate-100 dark:bg-sidebar-dark border border-slate-200 dark:border-white/10 text-sm font-bold rounded-xl px-4 py-2 outline-none text-slate-700 dark:text-slate-300"
             >
                <option value="" disabled>Selección rápida...</option>
                {quickDates.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
             </select>
             
             <div className="flex items-center gap-2 bg-slate-100 dark:bg-sidebar-dark border border-slate-200 dark:border-white/10 rounded-xl px-2 py-1">
               <input 
                 type="date" 
                 value={startDate} 
                 onChange={(e) => setStartDate(e.target.value)}
                 className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-300 outline-none w-32"
               />
               <span className="text-slate-400 font-bold text-xs">A</span>
               <input 
                 type="date" 
                 value={endDate} 
                 onChange={(e) => setEndDate(e.target.value)}
                 className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-300 outline-none w-32"
               />
             </div>
           </div>

           <button 
             onClick={handleManualSync}
             disabled={syncing}
             className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black transition-all ${
               syncing ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105'
             }`}
           >
             <span className={`material-symbols-outlined text-[18px] ${syncing ? 'animate-spin' : ''}`}>
               sync
             </span>
             {syncing ? 'Procesando...' : 'Sincronizar desde Drive'}
           </button>
           <Link href="/models" className="px-6 py-2 rounded-xl text-xs font-black bg-slate-100 dark:bg-primary/5 text-slate-500 dark:text-slate-300 hover:bg-primary hover:text-white transition-all">
             Volver a Galería
           </Link>
        </div>
      </div>

       {/* Tabs Navigator */}
       <div className="flex justify-center border-b border-slate-200 dark:border-white/10 mt-8">
          <button
             onClick={() => setActiveTab("Chaturbate")}
             className={`px-8 py-4 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${activeTab === "Chaturbate" ? "text-primary border-primary" : "text-slate-500 border-transparent hover:text-primary"}`}
          >
             <span className="material-symbols-outlined text-[18px]">videocam</span> Chaturbate
          </button>
          <button
             onClick={() => setActiveTab("Stripchat")}
             className={`px-8 py-4 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${activeTab === "Stripchat" ? "text-rose-500 border-rose-500" : "text-slate-500 border-transparent hover:text-rose-500"}`}
          >
             <span className="material-symbols-outlined text-[18px]">favorite</span> Stripchat
          </button>
          <button
             onClick={() => setActiveTab("Combined")}
             className={`px-8 py-4 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${activeTab === "Combined" ? "text-indigo-500 border-indigo-500" : "text-slate-500 border-transparent hover:text-indigo-500"}`}
          >
             <span className="material-symbols-outlined text-[18px]">donut_large</span> Combinado (Ambas)
          </button>
       </div>


      {loadingGlobal ? (
         <div className="py-20 text-center bg-white dark:bg-sidebar-dark/40 rounded-3xl border border-dashed border-slate-300 dark:border-white/10">
            <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4 inline-block animate-spin">refresh</span>
            <h2 className="text-xl font-bold text-slate-700 dark:text-white mb-2">Calculando Métricas Globales...</h2>
            <p className="text-slate-500">Extrayendo datos de 7288e para el periodo {period}</p>
         </div>
      ) : globalMetrics && (
      <>
        {/* KPI Cards (Métricas Globales 7288e) */}
        <div className="mb-8">
           <h2 className="text-lg font-black text-slate-800 dark:text-white mb-4 uppercase flex items-center gap-2">
             <span className="material-symbols-outlined text-primary">public</span>
             Rendimiento Global ({startDate} al {endDate})
           </h2>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               {/* TPH Global */}
               <div className="bg-white dark:bg-sidebar-dark/40 p-6 rounded-3xl border border-slate-200 dark:border-primary/10 shadow-sm group hover:border-primary/30 transition-all relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-5">
                    <span className="material-symbols-outlined text-6xl">speed</span>
                 </div>
                 <div className="flex items-center justify-between mb-4 relative z-10">
                   <div className={`size-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shadow-inner`}>
                     <span className="material-symbols-outlined text-[24px]">speed</span>
                   </div>
                   <span className={`text-[10px] font-black text-indigo-500 bg-indigo-500/10 px-2 py-1 rounded-lg`}>Global V1</span>
                 </div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">TPH Promedio</p>
                 <h3 className="text-3xl font-black text-slate-900 dark:text-white relative z-10">{globalMetrics.tph}</h3>
                 <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase relative z-10">
                    Calculado sobre {globalMetrics.totalHours} hs Reales
                 </p>
               </div>

               {/* ICJ */}
               <div className="bg-white dark:bg-sidebar-dark/40 p-6 rounded-3xl border border-slate-200 dark:border-primary/10 shadow-sm group hover:border-primary/30 transition-all relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-5">
                    <span className="material-symbols-outlined text-6xl">event_available</span>
                 </div>
                 <div className="flex items-center justify-between mb-4 relative z-10">
                   <div className={`size-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-inner`}>
                     <span className="material-symbols-outlined text-[24px]">event_available</span>
                   </div>
                   <span className={`text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg`}>Disciplina</span>
                 </div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">ICJ % Cumplimiento</p>
                 <h3 className="text-3xl font-black text-slate-900 dark:text-white relative z-10">{globalMetrics.icj}%</h3>
                 <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase relative z-10">Proyección sobre {globalMetrics.businessDays} d. hábiles</p>
               </div>

               {/* ICR */}
               <div className="bg-white dark:bg-sidebar-dark/40 p-6 rounded-3xl border border-slate-200 dark:border-primary/10 shadow-sm group hover:border-primary/30 transition-all relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-5">
                    <span className="material-symbols-outlined text-6xl">model_training</span>
                 </div>
                 <div className="flex items-center justify-between mb-4 relative z-10">
                   <div className={`size-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-inner`}>
                     <span className="material-symbols-outlined text-[24px]">model_training</span>
                   </div>
                   <span className={`text-[10px] font-black text-amber-500 bg-amber-500/10 px-2 py-1 rounded-lg`}>Calidad</span>
                 </div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">ICR Conversión</p>
                 <h3 className="text-3xl font-black text-slate-900 dark:text-white relative z-10">{globalMetrics.icr}</h3>
                 <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase relative z-10">TPH × Factor ICJ</p>
               </div>

               {/* Z-Score */}
               <div className="bg-white dark:bg-sidebar-dark/40 p-6 rounded-3xl border border-slate-200 dark:border-primary/10 shadow-sm group hover:border-primary/30 transition-all relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-5">
                    <span className="material-symbols-outlined text-6xl">moving</span>
                 </div>
                 <div className="flex items-center justify-between mb-4 relative z-10">
                   <div className={`size-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 shadow-inner`}>
                     <span className="material-symbols-outlined text-[24px]">moving</span>
                   </div>
                   <span className={`text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-1 rounded-lg`}>Estadística</span>
                 </div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">Z-Score</p>
                 <h3 className="text-3xl font-black text-slate-900 dark:text-white relative z-10">{globalMetrics.zscore}</h3>
                 <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase relative z-10">Respecto a media 1200</p>
               </div>
           </div>
        </div>
      </>
      )}

      {/* MÉTRICAS SUPLEMENTARIAS DRIVE */}
      <h2 className="text-lg font-black text-slate-800 dark:text-white mb-4 uppercase flex items-center gap-2 mt-12">
        <span className="material-symbols-outlined text-accent-gold">folder_managed</span>
        Métricas Complementarias (Drive) - {activeTab}
      </h2>

      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-4 bg-white dark:bg-sidebar-dark/40 border border-slate-200 dark:border-white/10 rounded-3xl flex flex-col justify-start shadow-sm min-h-[120px]">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black mb-1">Mejor Rank</p>
                <div className="flex items-center gap-2 mb-2">
                   <h4 className="text-2xl font-black text-slate-900 dark:text-white leading-none">{metrics.best_rank > 0 ? metrics.best_rank : '--'}</h4>
                   <span className="material-symbols-outlined text-accent-gold text-lg">trophy</span>
                </div>
                {metrics.best_rank_details && (
                  <div className="mt-1 pt-2 border-t border-slate-100 dark:border-white/5 text-[9px] text-slate-500 font-medium">
                     <p className="mb-0.5">Día: <span className="text-slate-700 dark:text-slate-300 font-bold">{metrics.best_rank_details.timestamp?.split('T')[0]}</span> - <span className="text-slate-700 dark:text-slate-300 font-bold">{metrics.best_rank_details.timestamp?.split('T')[1]?.substring(0,5)}hs</span></p>
                     <p>VWs: <span className="text-amber-500 font-bold">{metrics.best_rank_details.viewers}</span> | FW: <span className="text-slate-700 dark:text-slate-300 font-bold">{metrics.best_rank_details.followers}</span></p>
                     <p className="mt-0.5 pt-0.5 border-t border-slate-100/50 dark:border-white/5">Día Tks: <span className="text-emerald-500 font-bold">{metrics.best_rank_details.total_tokens}</span> | Top: <span className="text-blue-500 font-bold">{metrics.best_rank_details.top_user || 'N/A'}</span></p>
                  </div>
                )}
            </div>
            <div className="p-4 bg-white dark:bg-sidebar-dark/40 border border-slate-200 dark:border-white/10 rounded-3xl flex flex-col justify-start shadow-sm min-h-[120px]">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black mb-1">G-Rank</p>
                <div className="flex items-center gap-2 mb-2">
                   <h4 className="text-2xl font-black text-slate-900 dark:text-white leading-none">{metrics.best_grank > 0 ? metrics.best_grank : '--'}</h4>
                   <span className="material-symbols-outlined text-emerald-500 text-lg">public</span>
                </div>
                {metrics.best_grank_details && (
                  <div className="mt-1 pt-2 border-t border-slate-100 dark:border-white/5 text-[9px] text-slate-500 font-medium">
                     <p className="mb-0.5">Día: <span className="text-slate-700 dark:text-slate-300 font-bold">{metrics.best_grank_details.timestamp?.split('T')[0]}</span> - <span className="text-slate-700 dark:text-slate-300 font-bold">{metrics.best_grank_details.timestamp?.split('T')[1]?.substring(0,5)}hs</span></p>
                     <p>VWs: <span className="text-amber-500 font-bold">{metrics.best_grank_details.viewers}</span> | FW: <span className="text-slate-700 dark:text-slate-300 font-bold">{metrics.best_grank_details.followers}</span></p>
                     <p className="mt-0.5 pt-0.5 border-t border-slate-100/50 dark:border-white/5">Día Tks: <span className="text-emerald-500 font-bold">{metrics.best_grank_details.total_tokens}</span> | Top: <span className="text-blue-500 font-bold">{metrics.best_grank_details.top_user || 'N/A'}</span></p>
                  </div>
                )}
            </div>
            <div className="p-4 bg-white dark:bg-sidebar-dark/40 border border-slate-200 dark:border-white/10 rounded-3xl flex flex-col justify-center shadow-sm">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black mb-1">Crecimiento (Periodo)</p>
                <div className="flex items-end gap-2">
                   <h4 className={`text-2xl font-black ${metrics.follower_growth > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {metrics.follower_growth > 0 ? '+' : ''}{metrics.follower_growth || '--'}
                   </h4>
                   <span className={`material-symbols-outlined mb-1 ${metrics.follower_growth > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {metrics.follower_growth > 0 ? 'trending_up' : 'trending_down'}
                   </span>
                </div>
            </div>
            <div className="p-4 bg-white dark:bg-sidebar-dark/40 border border-slate-200 dark:border-white/10 rounded-3xl flex flex-col justify-center shadow-sm">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black mb-1">Seguidores Act.</p>
                <div className="flex items-end gap-2">
                   <h4 className="text-2xl font-black text-slate-900 dark:text-white">{metrics.followers_current > 0 ? metrics.followers_current.toLocaleString() : '--'}</h4>
                   <span className="material-symbols-outlined text-primary mb-1">group</span>
                </div>
            </div>
        </div>
      )}

      {activeTab === "Combined" && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="p-6 bg-primary/5 border border-primary/20 rounded-3xl flex items-center justify-between">
             <div>
                <p className="text-[10px] uppercase tracking-widest text-primary font-black mb-1">Aporte Chaturbate</p>
                <h4 className="text-3xl font-black text-slate-900 dark:text-white">{cbMetrics?.total_tokens?.toLocaleString() || 0} TK</h4>
             </div>
             <div className="size-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined font-bold">videocam</span>
             </div>
          </div>
          <div className="p-6 bg-rose-500/5 border border-rose-500/20 rounded-3xl flex items-center justify-between">
             <div>
                <p className="text-[10px] uppercase tracking-widest text-rose-500 font-black mb-1">Aporte Stripchat</p>
                <h4 className="text-3xl font-black text-slate-900 dark:text-white">{scMetrics?.total_tokens?.toLocaleString() || 0} TK</h4>
             </div>
             <div className="size-12 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-500">
                <span className="material-symbols-outlined font-bold">favorite</span>
             </div>
          </div>
      </div>
      )}

      {!metrics ? (
         <div className="py-20 text-center bg-white dark:bg-sidebar-dark/40 rounded-3xl border border-dashed border-slate-300 dark:border-white/10">
            <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4 inline-block">analytics</span>
            <h2 className="text-xl font-bold text-slate-700 dark:text-white mb-2">Desglose Drive no disponible</h2>
            <p className="text-slate-500">Presiona "Sincronizar desde Drive" para extraer particularidades del periodo (Top Tippers, Horas Pico).</p>
         </div>
      ) : (
      <>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white dark:bg-sidebar-dark/40 p-8 rounded-3xl border border-slate-200 dark:border-primary/10 shadow-sm min-h-[400px]">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Whales & Top Tippers</h3>
                <p className="text-xs text-slate-500 uppercase font-black tracking-tighter">Ranking del periodo</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {topUsers.map((u: any, i: number) => (
                <div 
                  key={i} 
                  onClick={() => u.details ? setSelectedTipper(u) : alert("Sincronizando detalles adicionales espere por favor...")}
                  className={`flex items-center justify-between p-4 bg-slate-50 dark:bg-primary/5 rounded-2xl border border-transparent transition-all group ${u.details ? 'hover:border-primary/40 cursor-pointer shadow-sm hover:shadow-primary/10' : 'opacity-90'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold transition-all group-hover:bg-primary group-hover:text-white group-hover:scale-110">
                      {u.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{u.name}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Aportó {((u.tokens / (totalIncome || 1)) * 100).toFixed(1)}% del total</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-primary">{u.tokens?.toLocaleString()} TK</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 p-8 rounded-3xl border border-white/5 shadow-2xl flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="size-10 rounded-full bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                <span className="material-symbols-outlined text-[20px]">insights</span>
              </div>
              <h3 className="font-bold text-white uppercase tracking-tighter text-sm">Distribución de Ingresos</h3>
            </div>
            <div className="space-y-4 flex-1">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <h4 className="text-primary text-xs font-bold mb-1">Demandas en Sala</h4>
                <div className="mt-3 space-y-2">
                   <div className="flex justify-between text-white text-sm">
                      <span>Menciones Privados (PM):</span>
                      <span className="font-bold">{metrics.intents?.privates || 0} peticiones</span>
                   </div>
                   <div className="flex justify-between text-white text-sm">
                      <span>Peticiones de VDO:</span>
                      <span className="font-bold">{metrics.intents?.requestedVideo || 0} peticiones</span>
                   </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <h4 className="text-emerald-500 text-xs font-bold mb-3">Público vs. Privado</h4>
                
                <div className="flex items-center gap-4 mb-2">
                   <div className="flex-1">
                      <p className="text-slate-400 text-xs mb-1">En Público</p>
                      <p className="text-white font-bold">{metrics.tip_tokens?.toLocaleString()}</p>
                   </div>
                   <div className="flex-1 text-right">
                      <p className="text-slate-400 text-xs mb-1">En Privados</p>
                      <p className="text-white font-bold">{metrics.private_tokens?.toLocaleString()}</p>
                   </div>
                </div>
                
                <div className="h-4 bg-primary rounded-full overflow-hidden flex">
                   <div className="h-full bg-emerald-500" style={{ width: `${(metrics.tip_tokens / (metrics.total_tokens || 1)) * 100}%` }}></div>
                </div>
              </div>

              {metrics.income_concepts && (
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mt-4">
                <h4 className="text-indigo-400 text-xs font-bold mb-3">Tokens por Concepto</h4>
                <div className="space-y-2">
                   <div className="flex justify-between text-white text-sm">
                      <span className="text-slate-400">Público:</span>
                      <span className="font-bold">{(metrics.income_concepts.public || 0).toLocaleString()} TK</span>
                   </div>
                   <div className="flex justify-between text-white text-sm">
                      <span className="text-slate-400">Privado:</span>
                      <span className="font-bold">{(metrics.income_concepts.private || 0).toLocaleString()} TK</span>
                   </div>
                   <div className="flex justify-between text-white text-sm">
                      <span className="text-slate-400">Espía:</span>
                      <span className="font-bold">{(metrics.income_concepts.spy || 0).toLocaleString()} TK</span>
                   </div>
                   <div className="flex justify-between text-white text-sm">
                      <span className="text-slate-400">Venta Videos:</span>
                      <span className="font-bold">{(metrics.income_concepts.videos || 0).toLocaleString()} TK</span>
                   </div>
                   <div className="flex justify-between text-white text-sm">
                      <span className="text-slate-400">Venta Fotos:</span>
                      <span className="font-bold">{(metrics.income_concepts.photos || 0).toLocaleString()} TK</span>
                   </div>
                   {(metrics.income_concepts.other > 0) && (
                     <div className="flex justify-between text-white text-sm">
                        <span className="text-slate-400">Otros:</span>
                        <span className="font-bold">{(metrics.income_concepts.other || 0).toLocaleString()} TK</span>
                     </div>
                   )}
                </div>
              </div>
              )}

              <div className="p-4 mt-4 rounded-2xl border border-dashed border-white/20">
                <p className="text-center font-mono text-xs text-slate-400">
                  Cache Actualizado: <br/>{new Date(metrics.synced_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Hourly Distribution Section */}
        <div className="mt-8 bg-white dark:bg-sidebar-dark/40 p-10 rounded-3xl border border-slate-200 dark:border-primary/10 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 p-10 opacity-5">
            <span className="material-symbols-outlined text-[120px]">schedule</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 relative z-10">
            <div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Peak Performance: Horas más Activas</h3>
              <p className="text-xs text-slate-500 uppercase font-black tracking-widest mt-1">Distribución de tokens y flujo de usuarios por hora (24h)</p>
            </div>
            
            <div className="flex gap-4">
              <div className="px-4 py-2 bg-primary/10 rounded-xl border border-primary/20">
                <p className="text-[9px] font-black text-primary uppercase tracking-widest">Mejor Hora (Tokens)</p>
                <p className="text-lg font-black text-primary">{metrics.peak_hour}:00 HS</p>
              </div>
              <div className="px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Hora Pico (Usuarios)</p>
                <p className="text-lg font-black text-emerald-500">
                  {metrics.hourly_distribution?.sort((a: any, b: any) => b.users - a.users)[0]?.hour || '--'}:00 HS
                </p>
              </div>
            </div>
          </div>

          <div className="relative h-80 flex items-end gap-1 sm:gap-2 pb-8 border-b border-slate-100 dark:border-white/5 relative z-10">
            {(() => {
              const sortedDist = [...(metrics.hourly_distribution || [])].sort((a: any, b: any) => a.hour.localeCompare(b.hour));
              const maxTokens = Math.max(...(sortedDist.map((d: any) => d.tokens) || []), 1);
              const maxUsers = Math.max(...(sortedDist.map((d: any) => d.users) || []), 1);
              const maxViewers = Math.max(...(sortedDist.map((d: any) => d.avg_viewers || 0) || []), 1);
              const peakHour = metrics.peak_hour;
              
              return sortedDist.map((h: any, i: number) => {
                const tokenHeight = (h.tokens / maxTokens) * 100;
                const userHeight = (h.users / maxUsers) * 100;
                const viewerHeight = ((h.avg_viewers || 0) / maxViewers) * 100;
                const isPeak = h.hour === peakHour;
                
                return (
                  <div key={i} className={`flex-1 h-full flex flex-col items-center group relative ${isPeak ? 'z-20' : 'z-10'}`}>
                    {/* Highlight Box for Peak Hour */}
                    {isPeak && (
                      <div className="absolute inset-x-[-4px] -top-4 -bottom-2 bg-primary/5 border border-primary/20 rounded-2xl pointer-events-none animate-pulse"></div>
                    )}

                    {/* Tooltip */}
                    <div className="absolute -top-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-3 rounded-xl text-[10px] opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 whitespace-nowrap border border-white/10 shadow-2xl">
                      <p className="font-black text-primary mb-1">{h.hour}:00 - {parseInt(h.hour)+1}:00</p>
                      <p className="flex items-center gap-1"><span className="size-2 rounded-full bg-primary inline-block"></span> {h.tokens?.toLocaleString()} Tokens</p>
                      <p className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500 inline-block"></span> {h.users} Usuarios Únicos</p>
                      <p className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500 inline-block"></span> {h.avg_viewers > 0 ? Math.round(h.avg_viewers).toLocaleString() : 0} Viewers Promedio</p>
                      {isPeak && <p className="text-[8px] font-black text-primary mt-1 uppercase tracking-tighter">★ HORA MÁXIMA PRODUCTIVIDAD</p>}
                    </div>
                    
                    <div className="w-full flex items-end justify-center gap-[1px] sm:gap-0.5 h-full pt-10">
                      <div 
                        className={`w-1.5 sm:w-2 bg-primary rounded-t-sm transition-all group-hover:brightness-125 ${isPeak ? 'shadow-[0_-4px_12px_rgba(79,70,229,0.4)]' : ''}`}
                        style={{ height: `${Math.max(tokenHeight, 2)}%` }}
                      ></div>
                      <div 
                        className={`w-1.5 sm:w-2 bg-emerald-500/40 rounded-t-sm transition-all group-hover:bg-emerald-500 ${isPeak ? 'shadow-[0_-4px_12px_rgba(16,185,129,0.2)]' : ''}`}
                        style={{ height: `${Math.max(userHeight, 2)}%` }}
                      ></div>
                      <div 
                        className={`w-1.5 sm:w-2 bg-amber-500/40 rounded-t-sm transition-all group-hover:bg-amber-500`}
                        style={{ height: `${Math.max(viewerHeight, 2)}%` }}
                      ></div>
                    </div>
                    
                    <span className={`text-[8px] sm:text-[10px] font-black mt-3 transition-colors ${isPeak ? 'text-primary' : 'text-slate-400 group-hover:text-primary'}`}>
                      {h.hour}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
          
          <div className="mt-8 flex flex-wrap gap-8 justify-center relative z-10">
            <div className="flex items-center gap-3">
              <div className="size-3 rounded-full bg-primary shadow-lg shadow-primary/50"></div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-tighter">Volumen de Tokens</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="size-3 rounded-full bg-emerald-500/40 border border-emerald-500"></div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-tighter">Flujo de Usuarios Únicos</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="size-3 rounded-full bg-amber-500/40 border border-amber-500"></div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-tighter">Viewers Promedio</span>
            </div>
          </div>
        </div>

        {/* Heatmap Section */}
        {metrics?.schedule_matrix && (
        <div className="bg-white dark:bg-sidebar-dark/40 p-8 rounded-3xl border border-slate-200 dark:border-primary/10 shadow-sm mt-12 relative overflow-hidden">
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tighter">Mapa de Calor: Horario Semanal</h3>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">Actividad de transmisión en {activeTab} (Visualización de CBHours)</p>
            </div>
            <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[24px]">calendar_view_week</span>
            </div>
          </div>
          
          <div className="overflow-x-auto pb-4">
            <div className="min-w-[800px]">
              <div className="flex mb-2">
                <div className="w-16"></div>
                {Array.from({length: 24}).map((_, h) => (
                  <div key={h} className="flex-1 text-center text-[10px] font-black text-slate-400 uppercase">
                    {h}h
                  </div>
                ))}
              </div>
              
              {(() => {
                const matrix = metrics.schedule_matrix;
                let cellMax = 0;
                matrix.forEach((row: any) => row.hours?.forEach((c: any) => {
                   const score = c.online_snapshots + (c.tokens > 0 ? 1 : 0);
                   if (score > cellMax) cellMax = score;
                }));
                const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
                
                return matrix.map((dayRow: any, dIndex: number) => (
                  <div key={dIndex} className="flex items-center mt-1">
                    <div className="w-16 text-[10px] font-black text-slate-500 uppercase text-right pr-4">{days[dIndex]}</div>
                    {dayRow.hours?.map((cell: any, hIndex: number) => {
                       const score = cell.online_snapshots + (cell.tokens > 0 ? 1 : 0);
                       const intensity = cellMax > 0 ? score / cellMax : 0;
                       
                       let bgColor = "bg-slate-900";
                       if (intensity > 0.85) bgColor = "bg-[#fde047] shadow-[0_0_10px_rgba(253,224,71,0.5)] z-10";
                       else if (intensity > 0.7) bgColor = "bg-[#f59e0b]";
                       else if (intensity > 0.5) bgColor = "bg-[#f97316]";
                       else if (intensity > 0.3) bgColor = "bg-[#ec4899]";
                       else if (intensity > 0.15) bgColor = "bg-[#8b5cf6]";
                       else if (intensity > 0.05) bgColor = "bg-[#581c87]";
                       else if (intensity > 0) bgColor = "bg-[#2e1065]";

                       return (
                         <div key={hIndex} className="flex-1 p-[2px] group relative">
                            {(score > 0) && (
                               <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 border border-white/10 text-white p-3 rounded-xl text-[10px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-2xl">
                                  <span className="font-black text-primary block text-xs mb-1">{days[dIndex]} a las {hIndex}:00</span>
                                  {cell.tokens > 0 && <span className="block mt-1 flex items-center gap-1"><span className="size-2 rounded-full bg-primary inline-block"></span> {cell.tokens.toLocaleString()} Tokens Totales</span>}
                                  {cell.average_viewers > 0 && <span className="block flex items-center gap-1 mt-1"><span className="size-2 rounded-full bg-amber-500 inline-block"></span> {cell.average_viewers} Viewers Promedio</span>}
                               </div>
                            )}
                            <div className={`w-full aspect-square rounded-[4px] ${bgColor} cursor-crosshair transition-all hover:scale-110`}></div>
                         </div>
                       );
                    })}
                  </div>
                ));
              })()}
            </div>
          </div>
          
          <div className="mt-4 flex items-center justify-end gap-2 text-[10px] font-black text-slate-400">
             <span>Menos Actividad</span>
             <div className="flex gap-1">
                <div className="w-4 h-4 rounded-[4px] bg-slate-900 cursor-pointer hover:scale-110 transition-transform"></div>
                <div className="w-4 h-4 rounded-[4px] bg-[#2e1065] cursor-pointer hover:scale-110 transition-transform"></div>
                <div className="w-4 h-4 rounded-[4px] bg-[#581c87] cursor-pointer hover:scale-110 transition-transform"></div>
                <div className="w-4 h-4 rounded-[4px] bg-[#8b5cf6] cursor-pointer hover:scale-110 transition-transform"></div>
                <div className="w-4 h-4 rounded-[4px] bg-[#ec4899] cursor-pointer hover:scale-110 transition-transform"></div>
                <div className="w-4 h-4 rounded-[4px] bg-[#f97316] cursor-pointer hover:scale-110 transition-transform"></div>
                <div className="w-4 h-4 rounded-[4px] bg-[#f59e0b] cursor-pointer hover:scale-110 transition-transform"></div>
                <div className="w-4 h-4 rounded-[4px] bg-[#fde047] cursor-pointer hover:scale-110 transition-transform shadow-[0_0_10px_rgba(253,224,71,0.5)]"></div>
             </div>
             <span>Más Actividad</span>
          </div>
        </div>
        )}

        {/* Rank & Follower Evolution Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
          {/* Rank Evolution Chart */}
          <div className="bg-white dark:bg-sidebar-dark/40 p-8 rounded-3xl border border-slate-200 dark:border-primary/10 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tighter">Evolución del Rank (G-Rank)</h3>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">Posicionamiento histórico en {activeTab}</p>
              </div>
              <div className="size-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <span className="material-symbols-outlined text-[24px]">workspace_premium</span>
              </div>
            </div>

            <div className="h-64 flex items-end gap-1 relative z-10">
               {evolutionData.length > 0 ? (
                 (() => {
                   const slicedData = evolutionData.slice(-15);
                   const maxRank = Math.max(...slicedData.map((d: any) => d.rank || 0), 1000);
                   return slicedData.map((d: any, i: number) => {
                     const height = d.rank ? (1 - (d.rank / (maxRank * 1.2))) * 100 : 5;
                     return (
                       <div key={i} className="flex-1 group relative h-full flex flex-col justify-end">
                         <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-2 py-1 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                            Rank: #{d.rank || 'N/A'}<br/>{d.date}
                         </div>
                         <div 
                           className="w-full bg-amber-500/40 hover:bg-amber-500 rounded-t-sm transition-all cursor-crosshair"
                           style={{ height: `${height}%` }}
                         ></div>
                         <span className="text-[8px] text-slate-400 mt-2 rotate-45 origin-left">{d.date.split('-').slice(1).join('/')}</span>
                       </div>
                     );
                   });
                 })()
               ) : (
                 <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-2xl">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Sin datos históricos de Rank</p>
                 </div>
               )}
            </div>
          </div>

          {/* Follower Growth Chart */}
          <div className="bg-white dark:bg-sidebar-dark/40 p-8 rounded-3xl border border-slate-200 dark:border-primary/10 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tighter">Crecimiento de Audiencia</h3>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">Seguidores ganados por periodo</p>
              </div>
              <div className="size-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <span className="material-symbols-outlined text-[24px]">group_add</span>
              </div>
            </div>

            <div className="h-64 flex items-end gap-1 relative z-10">
               {evolutionData.length > 0 ? (
                 (() => {
                   const deltaData = evolutionData.map((d: any, index: number, arr: any[]) => {
                     // For first item we cannot know the delta, so assume 0. (or d.followers if we want to show absolute, but 0 is cleaner)
                     const new_followers = d.new_followers !== undefined ? d.new_followers : (index === 0 ? 0 : Math.max(0, (d.followers || 0) - (arr[index - 1].followers || 0)));
                     return { ...d, new_followers };
                   });
                   const slicedData = deltaData.slice(-15);
                   const maxFollowers = Math.max(...slicedData.map((d: any) => d.new_followers || 0), 5);
                   return slicedData.map((d: any, i: number) => {
                     const height = (d.new_followers / maxFollowers) * 100;
                     return (
                       <div key={i} className="flex-1 group relative h-full flex flex-col justify-end">
                         <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-2 py-1 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                            +{d.new_followers || 0} Seguidores<br/>{d.date}
                         </div>
                         <div 
                           className="w-full bg-blue-500/40 hover:bg-blue-500 rounded-t-sm transition-all cursor-crosshair"
                           style={{ height: `${Math.max(height, 5)}%` }}
                         ></div>
                         <span className="text-[8px] text-slate-400 mt-2 rotate-45 origin-left">{d.date.split('-').slice(1).join('/')}</span>
                       </div>
                     );
                   });
                 })()
               ) : (
                 <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-2xl">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Sin datos de seguidores</p>
                 </div>
               )}
            </div>
          </div>
        </div>
      </>
      )}

      {/* MODAL DETALLES DEL USUARIO */}
      {selectedTipper && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl relative border border-slate-200 dark:border-white/10">
              <button onClick={() => setSelectedTipper(null)} className="absolute top-4 right-4 size-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                 <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
              
              <div className="flex items-center gap-4 mb-6 pt-2">
                 <div className="size-16 rounded-3xl bg-primary/20 flex items-center justify-center text-primary font-black text-3xl shadow-inner">
                    {selectedTipper.name[0]?.toUpperCase()}
                 </div>
                 <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-none">{selectedTipper.name}</h2>
                    <p className="text-sm font-bold text-accent-gold mt-1">{selectedTipper.tokens?.toLocaleString()} Tokens en Total</p>
                 </div>
              </div>

              <div className="space-y-6">
                 <div>
                    <h4 className="flex items-center gap-2 text-[10px] font-black tracking-widest text-slate-400 uppercase mb-3">
                       <span className="material-symbols-outlined text-[16px]">schedule</span> Hora Dorada (Mayor Conversión)
                    </h4>
                    <div className="flex items-center justify-between bg-primary/5 border border-primary/20 p-4 rounded-2xl">
                       <span className="text-2xl font-black text-primary">{selectedTipper.details?.topHour?.hour || "N/A"}:00</span>
                       <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl shadow-sm border border-slate-200 dark:border-white/5">{selectedTipper.details?.topHour?.tokens?.toLocaleString()} TK en este horario</span>
                    </div>
                 </div>

                 <div>
                    <h4 className="flex items-center gap-2 text-[10px] font-black tracking-widest text-slate-400 uppercase mb-3">
                       <span className="material-symbols-outlined text-[16px]">calendar_month</span> Días Frecuentados
                    </h4>
                    <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                       {selectedTipper.details?.days?.length > 0 ? (
                          selectedTipper.details.days.map((day: string, idx: number) => (
                             <div key={idx} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/5 shadow-sm">
                                {day}
                             </div>
                          ))
                       ) : (
                          <p className="text-sm text-slate-500 italic">Sin historial de fechas detalladas.</p>
                       )}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

export default function ModelAnalyticsPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Cargando analíticas..." />}>
      <AnalyticsContent />
    </Suspense>
  );
}
