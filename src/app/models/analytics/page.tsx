"use client";

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import LoadingScreen from "@/components/common/LoadingScreen";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

function AnalyticsContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [timeRange, setTimeRange] = useState('24h');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [modelData, setModelData] = useState<any>(null);
  const [dailyMetrics, setDailyMetrics] = useState<any>(null);

  const fetchData = async (idParam: string) => {
    try {
      const modelRef = doc(db, "models", idParam);
      const modelSnap = await getDoc(modelRef);
      if (modelSnap.exists()) {
        setModelData(modelSnap.data());
      }

      const dateStr = new Date().toISOString().split("T")[0];
      const qMetrics = query(
        collection(db, "daily_metrics"),
        where("model_id", "==", idParam),
        where("date", "==", dateStr)
      );
      const metricsSnap = await getDocs(qMetrics);
      if (!metricsSnap.empty) {
        setDailyMetrics(metricsSnap.docs[0].data());
      }
    } catch (error) {
      console.error("Error fetching analytics data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchData(id);
    } else {
      setLoading(false);
    }
  }, [id]);

  const handleManualSync = async () => {
    if (!user || !id) return;
    setSyncing(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/sync-chaturbate', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        await fetchData(id);
      }
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <LoadingScreen message="Extrayendo datos reales desde la API..." />;

  const isOnline = modelData?.is_online || false;
  const currentTokens = dailyMetrics?.tokens || 0;
  const currentViewers = modelData?.stream_stats?.current_viewers || 0;
  const currentPrivateUser = modelData?.stream_stats?.current_private_user || null;
  const topFan = currentPrivateUser || dailyMetrics?.top_fan_name || "N/A";
  const topFanTokens = dailyMetrics?.top_fan_tokens || 0;

  const metrics = [
    { title: 'Tokens del Día', value: `${currentTokens}`, trend: isOnline ? 'En Vivo' : 'Finalizado', icon: 'payments', color: 'emerald' },
    { title: 'Espectadores', value: `${currentViewers}`, trend: isOnline ? '+10%' : 'Offline', icon: 'group', color: 'blue' },
    { title: 'Mejor Usuario', value: topFan, trend: currentPrivateUser ? 'EN PRIVADO' : (topFan !== 'N/A' ? `${topFanTokens} tk` : 'Sin datos'), icon: 'volunteer_activism', color: 'amber' },
    { title: 'Estado', value: isOnline ? (currentPrivateUser ? 'PRIVADO' : 'ONLINE') : 'OFFLINE', trend: modelData?.stream_stats?.last_sync_status || '-', icon: 'sensors', color: isOnline ? 'emerald' : 'slate' },
  ];

  const topUsers = dailyMetrics?.tippers ? 
    Object.entries(dailyMetrics.tippers)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([name, tokens]) => ({ name, tokens: tokens as number, avatar: `https://i.pravatar.cc/150?u=${name}` }))
    : [
      { name: topFan !== "N/A" ? topFan : 'Buscando...', tokens: topFanTokens, avatar: 'https://i.pravatar.cc/150?u=1' },
    ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-sidebar-dark/40 p-8 rounded-3xl border border-slate-200 dark:border-primary/10 shadow-xl shadow-primary/5">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className={`size-20 rounded-2xl bg-gradient-to-br ${isOnline ? 'from-emerald-500 to-teal-500' : 'from-slate-600 to-slate-800'} p-1 shadow-lg shadow-primary/20`}>
              <div className="size-full bg-sidebar-dark rounded-xl flex items-center justify-center text-white font-black text-2xl uppercase">
                {modelData?.name?.[0] || modelData?.nickname?.[0] || '?'}
              </div>
            </div>
            {isOnline && (
              <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded-full border-4 border-white dark:border-sidebar-dark animate-pulse">
                EN VIVO
              </div>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              {modelData?.name || modelData?.nickname || 'Analítica de Modelo'}
              <span className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-primary/10 px-2 py-1 rounded-lg border border-slate-200 dark:border-primary/20 uppercase tracking-widest">{id?.substring(0, 8) || '...'}</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 uppercase text-xs tracking-tighter">
              Metricas extraídas de Chaturbate API • <span className={isOnline ? "text-emerald-500 font-bold" : "text-slate-500 font-bold"}>Estado: {isOnline ? 'En Línea' : 'Offline'}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-4">
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
             {syncing ? 'Sincronizando...' : 'Actualizar ahora'}
           </button>
           <Link href="/models" className="px-6 py-2 rounded-xl text-xs font-black bg-slate-100 dark:bg-primary/5 text-slate-500 dark:text-slate-300 hover:bg-primary hover:text-white transition-all">
             Volver a Galería
           </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m) => (
          <div key={m.title} className="bg-white dark:bg-sidebar-dark/40 p-6 rounded-3xl border border-slate-200 dark:border-primary/10 shadow-sm group hover:border-primary/30 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className={`size-12 rounded-2xl bg-${m.color}-500/10 flex items-center justify-center text-${m.color}-500 shadow-inner`}>
                <span className="material-symbols-outlined text-[24px]">{m.icon}</span>
              </div>
              <span className={`text-[10px] font-black ${m.color === 'emerald' ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-400 bg-slate-100 dark:bg-primary/10'} px-2 py-1 rounded-lg`}>{m.trend}</span>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{m.title}</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white group-hover:scale-105 transition-transform origin-left">{m.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-sidebar-dark/40 p-8 rounded-3xl border border-slate-200 dark:border-primary/10 shadow-sm min-h-[400px]">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Top Generadores de Ingresos</h3>
              <p className="text-xs text-slate-500 uppercase font-black tracking-tighter">Usuarios con más propinas hoy</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {topUsers.map((u, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-primary/5 rounded-2xl border border-transparent hover:border-primary/20 transition-all">
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                    {u.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{u.name}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Usuario Verificado</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-primary">{u.tokens} TK</p>
                  <p className="text-[10px] text-emerald-500 font-bold uppercase">+{Math.round(u.tokens/currentTokens * 100) || 0}% del total</p>
                </div>
              </div>
            ))}
            {topUsers.length === 0 && (
              <div className="text-center py-20 text-slate-500">
                <span className="material-symbols-outlined text-4xl block mb-2">sentiment_dissatisfied</span>
                No hay datos de propinas para hoy.
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-3xl border border-white/5 shadow-2xl flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-10 rounded-full bg-accent-gold flex items-center justify-center text-background-dark shadow-lg shadow-accent-gold/20">
              <span className="material-symbols-outlined text-[20px]">star</span>
            </div>
            <h3 className="font-bold text-white uppercase tracking-tighter text-sm">Resumen de Gestión</h3>
          </div>
          <div className="space-y-4 flex-1">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <h4 className="text-accent-gold text-xs font-bold mb-1">Mejor Fan de la Sesión</h4>
              <p className="text-2xl font-black text-white">{topFan}</p>
              <p className="text-[10px] text-slate-400 mt-1">Ha contribuido con {topFanTokens} tokens hoy.</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <h4 className="text-primary text-xs font-bold mb-1">Última Sincronización</h4>
              <p className="text-sm text-white font-mono uppercase">
                {modelData?.stream_stats?.synced_at ? 
                  new Date(modelData.stream_stats.synced_at.seconds * 1000).toLocaleString() : 
                  'Nunca'}
              </p>
            </div>
            <div className="p-6 mt-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent-gold/10 border border-primary/20">
              <p className="text-[10px] text-slate-400 uppercase font-black mb-2 text-center">Progreso de Perfil</p>
              <div className="h-2 bg-black/40 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-primary" style={{ width: `${modelData?.progress || 0}%` }}></div>
              </div>
              <p className="text-center font-black text-white">{modelData?.progress || 0}%</p>
            </div>
          </div>
        </div>
      </div>
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
