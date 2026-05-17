"use client";

import React, { useState, useEffect } from 'react';
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

interface QuincenaComparisonProps {
  modelId: string;
  modelName?: string;
  currentQuincena?: {
    start: string;
    end: string;
  };
}

interface QuincenaData {
  label: string;
  period: string;
  metrics: {
    tph: number;
    icj: number;
    icr: number;
    totalHours: number;
    totalTokens: number;
    bestRank: number;
    bestGrank: number;
    followers: number;
    followerGrowth: number;
  };
  loading: boolean;
}

export default function QuincenaComparison({ modelId, modelName }: QuincenaComparisonProps) {
  const { user } = useAuth();
  const [quincenas, setQuincenas] = useState<QuincenaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCount, setSelectedCount] = useState(6);

  // Generar quincenas de los últimos N meses
  const generateQuincenas = (count: number) => {
    const list: QuincenaData[] = [];
    const today = new Date();
    
    for (let i = 0; i < count; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      d.setMonth(today.getMonth() - Math.floor(i / 2));
      
      const isFirstHalf = i % 2 === 1; // 0 is current (Q2 or Q1), 1 is previous, etc.
      // Wait, let's do it simpler.
      // Today is May 16. Q2 May is current.
      // i=0: Q2 May
      // i=1: Q1 May
      // i=2: Q2 April
      // i=3: Q1 April
    }
    // Let's use a more robust way
  };

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      const periods = [];
      const today = new Date();
      
      for (let i = 0; i < selectedCount; i++) {
        const date = new Date(today.getFullYear(), today.getMonth(), 1);
        date.setMonth(today.getMonth() - Math.floor(i / 2));
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(year, date.getMonth() + 1, 0).getDate();
        
        let label, start, end;
        if (i % 2 === 0) {
          // Si hoy es <= 15, la quincena actual (i=0) es Q1. Pero el usuario suele querer la quincena cerrada.
          // Vamos a basarnos en la fecha actual para determinar si estamos en Q1 o Q2.
          const currentDay = today.getDate();
          const isCurrentQ2 = currentDay > 15;
          
          const adjustedI = isCurrentQ2 ? i : i + 1;
          
          const targetDate = new Date(today.getFullYear(), today.getMonth(), 1);
          targetDate.setMonth(today.getMonth() - Math.floor(adjustedI / 2));
          const tYear = targetDate.getFullYear();
          const tMonth = String(targetDate.getMonth() + 1).padStart(2, '0');
          const tLastDay = new Date(tYear, targetDate.getMonth() + 1, 0).getDate();
          
          if (adjustedI % 2 === 0) {
            label = `Q2 ${tMonth}/${tYear}`;
            start = `${tYear}-${tMonth}-16`;
            end = `${tYear}-${tMonth}-${String(tLastDay).padStart(2, '0')}`;
          } else {
            label = `Q1 ${tMonth}/${tYear}`;
            start = `${tYear}-${tMonth}-01`;
            end = `${tYear}-${tMonth}-15`;
          }
        } else {
           // handled by adjustedI logic above
        }
        // Simplified generation for now to match the user's expected "Q1 Jan, Q2 Jan..."
      }
      
      // Let's just generate the last N quincenas strictly
      const quincenaList = [];
      let currYear = today.getFullYear();
      let currMonth = today.getMonth(); // 0-indexed
      let isQ2 = today.getDate() > 15;

      for (let i = 0; i < selectedCount; i++) {
        const monthStr = String(currMonth + 1).padStart(2, '0');
        const lastDay = new Date(currYear, currMonth + 1, 0).getDate();
        
        if (isQ2) {
          quincenaList.push({
            label: `Q2 ${monthStr}/${currYear}`,
            period: `${currYear}-${monthStr}-16_to_${currYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`,
            start: `${currYear}-${monthStr}-16`,
            end: `${currYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`
          });
          isQ2 = false;
        } else {
          quincenaList.push({
            label: `Q1 ${monthStr}/${currYear}`,
            period: `${currYear}-${monthStr}-01_to_${currYear}-${monthStr}-15`,
            start: `${currYear}-${monthStr}-01`,
            end: `${currYear}-${monthStr}-15`
          });
          isQ2 = true;
          currMonth--;
          if (currMonth < 0) {
            currMonth = 11;
            currYear--;
          }
        }
      }

      const results = await Promise.all(quincenaList.map(async (q) => {
        try {
          const token = await user?.getIdToken();
          // 1. Fetch Global Metrics from API
          const res = await fetch(`/api/action-plans/metrics?modelId=${modelId}&start=${q.start}&end=${q.end}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const json = await res.json();
          const global = json.globalMetrics || {};

          // 2. Fetch Cache Data from Firestore (Combined platforms)
          const cacheCbId = `${modelId}_${q.period}_Chaturbate`;
          const cacheScId = `${modelId}_${q.period}_Stripchat`;
          
          const [cbSnap, scSnap] = await Promise.all([
            getDoc(doc(db, "modelos_analytics_cache_v2", cacheCbId)),
            getDoc(doc(db, "modelos_analytics_cache_v2", cacheScId))
          ]);

          const cbData = cbSnap.exists() ? cbSnap.data() : null;
          const scData = scSnap.exists() ? scSnap.data() : null;

          const rankCands = [cbData?.best_rank, scData?.best_rank].filter(r => r != null && r > 0 && isFinite(r));
          const bestRank = rankCands.length > 0 ? Math.min(...rankCands) : 0;
          const grankCands = [cbData?.best_grank, scData?.best_grank].filter(r => r != null && r > 0 && isFinite(r));
          const bestGrank = grankCands.length > 0 ? Math.min(...grankCands) : 0;
          const followers = Math.max(cbData?.followers_current || 0, scData?.followers_current || 0);
          // follower_growth: use stored field first, fallback to history delta
          let followerGrowth = (cbData?.follower_growth || 0) + (scData?.follower_growth || 0);
          if (followerGrowth === 0) {
            const cbHist = (cbData?.history || []).sort((a: any, b: any) => a.date.localeCompare(b.date));
            const scHist = (scData?.history || []).sort((a: any, b: any) => a.date.localeCompare(b.date));
            const cbDelta = cbHist.length >= 2 ? Math.max(0, (cbHist[cbHist.length-1]?.followers || 0) - (cbHist[0]?.followers || 0)) : 0;
            const scDelta = scHist.length >= 2 ? Math.max(0, (scHist[scHist.length-1]?.followers || 0) - (scHist[0]?.followers || 0)) : 0;
            followerGrowth = cbDelta + scDelta;
          }

          return {
            label: q.label,
            period: q.period,
            metrics: {
              tph: Number(global.tph) || 0,
              icj: Number(global.icj) || 0,
              icr: Number(global.icr) || 0,
              totalHours: Number(global.totalHours) || 0,
              totalTokens: Number(global.totalTokens) || 0,
              bestRank,
              bestGrank,
              followers,
              followerGrowth
            },
            loading: false
          };
        } catch (err) {
          console.error(`Error fetching data for ${q.label}:`, err);
          return {
            label: q.label,
            period: q.period,
            metrics: { tph: 0, icj: 0, icr: 0, totalHours: 0, totalTokens: 0, bestRank: 0, bestGrank: 0, followers: 0, followerGrowth: 0 },
            loading: false
          };
        }
      }));

      setQuincenas(results.reverse()); // Show chronological order
      setLoading(false);
    };

    if (user && modelId) {
      fetchAllData();
    }
  }, [user, modelId, selectedCount]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Analizando historial de quincenas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">compare_arrows</span>
          Comparativa Evolutiva
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase">Mostrar:</span>
          <select 
            value={selectedCount} 
            onChange={(e) => setSelectedCount(Number(e.target.value))}
            className="bg-white dark:bg-sidebar-dark border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1 text-xs font-bold outline-none"
          >
            <option value={4}>Últimas 4 quincenas</option>
            <option value={6}>Últimas 6 quincenas</option>
            <option value={12}>Último semestre</option>
            <option value={24}>Último año</option>
          </select>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="bg-white dark:bg-sidebar-dark/40 rounded-3xl border border-slate-200 dark:border-primary/10 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-primary/5 border-b border-slate-100 dark:border-white/5">
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Métrica / Quincena</th>
                {quincenas.map(q => (
                  <th key={q.label} className="p-6 text-[10px] font-black text-primary uppercase tracking-widest text-center min-w-[120px]">
                    {q.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
              {/* TPH */}
              <tr className="hover:bg-slate-50 dark:hover:bg-primary/5 transition-colors">
                <td className="p-6 font-bold text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-indigo-500 text-lg">speed</span>
                    TPH (Tokens/Hora)
                  </div>
                </td>
                {quincenas.map((q, i) => {
                  const prev = quincenas[i-1]?.metrics.tph;
                  const diff = prev ? q.metrics.tph - prev : 0;
                  return (
                    <td key={q.label} className="p-6 text-center">
                      <p className="font-black text-slate-900 dark:text-white">{q.metrics.tph.toFixed(2)}</p>
                      {prev && (
                        <p className={`text-[10px] font-bold ${diff >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {diff >= 0 ? '↑' : '↓'} {Math.abs(diff).toFixed(2)}
                        </p>
                      )}
                    </td>
                  );
                })}
              </tr>
              {/* ICJ */}
              <tr className="hover:bg-slate-50 dark:hover:bg-primary/5 transition-colors">
                <td className="p-6 font-bold text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500 text-lg">event_available</span>
                    ICJ (% Disciplina)
                  </div>
                </td>
                {quincenas.map((q, i) => {
                  const prev = quincenas[i-1]?.metrics.icj;
                  const diff = prev ? q.metrics.icj - prev : 0;
                  return (
                    <td key={q.label} className="p-6 text-center">
                      <p className="font-black text-slate-900 dark:text-white">{q.metrics.icj.toFixed(1)}%</p>
                      {prev && (
                        <p className={`text-[10px] font-bold ${diff >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {diff >= 0 ? '↑' : '↓'} {Math.abs(diff).toFixed(1)}%
                        </p>
                      )}
                    </td>
                  );
                })}
              </tr>
              {/* ICR */}
              <tr className="hover:bg-slate-50 dark:hover:bg-primary/5 transition-colors">
                <td className="p-6 font-bold text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-500 text-lg">model_training</span>
                    ICR (Conversión)
                  </div>
                </td>
                {quincenas.map((q, i) => {
                  const prev = quincenas[i-1]?.metrics.icr;
                  const diff = prev ? q.metrics.icr - prev : 0;
                  return (
                    <td key={q.label} className="p-6 text-center">
                      <p className="font-black text-slate-900 dark:text-white">{q.metrics.icr.toFixed(2)}</p>
                      {prev && (
                        <p className={`text-[10px] font-bold ${diff >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {diff >= 0 ? '↑' : '↓'} {Math.abs(diff).toFixed(2)}
                        </p>
                      )}
                    </td>
                  );
                })}
              </tr>
              {/* Total Hours */}
              <tr className="hover:bg-slate-50 dark:hover:bg-primary/5 transition-colors">
                <td className="p-6 font-bold text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400 text-lg">schedule</span>
                    Horas Totales
                  </div>
                </td>
                {quincenas.map(q => (
                  <td key={q.label} className="p-6 text-center">
                    <p className="font-black text-slate-900 dark:text-white">{q.metrics.totalHours.toFixed(1)}h</p>
                  </td>
                ))}
              </tr>
              {/* Total Tokens */}
              <tr className="hover:bg-slate-50 dark:hover:bg-primary/5 transition-colors">
                <td className="p-6 font-bold text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">payments</span>
                    Tokens Totales
                  </div>
                </td>
                {quincenas.map(q => (
                  <td key={q.label} className="p-6 text-center">
                    <p className="font-black text-primary">{q.metrics.totalTokens.toLocaleString()}</p>
                  </td>
                ))}
              </tr>
              {/* Ranks */}
              <tr className="hover:bg-slate-50 dark:hover:bg-primary/5 transition-colors">
                <td className="p-6 font-bold text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-accent-gold text-lg">trophy</span>
                    Mejor Rank (Best)
                  </div>
                </td>
                {quincenas.map(q => (
                  <td key={q.label} className="p-6 text-center">
                    <p className="font-black text-slate-900 dark:text-white">{(q.metrics.bestRank > 0 && isFinite(q.metrics.bestRank)) ? `#${q.metrics.bestRank}` : '--'}</p>
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50 dark:hover:bg-primary/5 transition-colors">
                <td className="p-6 font-bold text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-500 text-lg">public</span>
                    Mejor Global Rank
                  </div>
                </td>
                {quincenas.map(q => (
                  <td key={q.label} className="p-6 text-center">
                    <p className="font-black text-slate-900 dark:text-white">{(q.metrics.bestGrank > 0 && isFinite(q.metrics.bestGrank)) ? `#${q.metrics.bestGrank}` : '--'}</p>
                  </td>
                ))}
              </tr>
              {/* Followers */}
              <tr className="hover:bg-slate-50 dark:hover:bg-primary/5 transition-colors">
                <td className="p-6 font-bold text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-purple-500 text-lg">group_add</span>
                    Nuevos Seguidores
                  </div>
                </td>
                {quincenas.map(q => (
                  <td key={q.label} className="p-6 text-center">
                    <p className="font-black text-emerald-500">+{q.metrics.followerGrowth.toLocaleString()}</p>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Visual Trends */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-sidebar-dark/40 p-8 rounded-3xl border border-slate-200 dark:border-primary/10 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 uppercase tracking-tighter">Tendencia de Eficiencia (TPH)</h3>
          <div className="h-48 flex items-end gap-2 relative">
             {quincenas.map((q, i) => {
               const maxTph = Math.max(...quincenas.map(x => x.metrics.tph), 0.01);
               const height = Math.max((q.metrics.tph / maxTph) * 100, q.metrics.tph > 0 ? 4 : 0);
               return (
                 <div key={i} className="flex-1 flex flex-col items-end justify-end group h-full">
                   <div className="relative w-full" style={{ height: `${height}%`, minHeight: q.metrics.tph > 0 ? '6px' : '0' }}>
                     <div className="w-full h-full bg-indigo-500/30 rounded-t-lg group-hover:bg-indigo-500 transition-colors" />
                     <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] px-2 py-1 rounded-lg font-black whitespace-nowrap z-10">
                       {q.metrics.tph > 0 ? q.metrics.tph.toFixed(1) : 'Sin datos'}
                     </div>
                   </div>
                   <span className="text-[9px] font-black text-slate-400 uppercase text-center mt-2 leading-tight">
                     {q.label.replace(' 2026', '').replace(' 2025', '')}
                   </span>
                 </div>
               );
             })}
          </div>
        </div>

        <div className="bg-white dark:bg-sidebar-dark/40 p-8 rounded-3xl border border-slate-200 dark:border-primary/10 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 uppercase tracking-tighter">Cumplimiento (ICJ %)</h3>
          <div className="h-48 flex items-end gap-2 relative">
             {quincenas.map((q, i) => {
               const height = Math.min(Math.max(q.metrics.icj, q.metrics.icj > 0 ? 4 : 0), 100);
               return (
                 <div key={i} className="flex-1 flex flex-col items-end justify-end group h-full">
                   <div className="relative w-full" style={{ height: `${height}%`, minHeight: q.metrics.icj > 0 ? '6px' : '0' }}>
                     <div className="w-full h-full bg-emerald-500/30 rounded-t-lg group-hover:bg-emerald-500 transition-colors" />
                     <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] px-2 py-1 rounded-lg font-black whitespace-nowrap z-10">
                       {q.metrics.icj > 0 ? `${q.metrics.icj.toFixed(0)}%` : 'Sin datos'}
                     </div>
                   </div>
                   <span className="text-[9px] font-black text-slate-400 uppercase text-center mt-2 leading-tight">
                     {q.label.replace(' 2026', '').replace(' 2025', '')}
                   </span>
                 </div>
               );
             })}
          </div>
        </div>
      </div>
      
      <div className="p-8 bg-slate-900 rounded-3xl border border-white/10 shadow-2xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="size-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined">auto_graph</span>
          </div>
          <div>
            <h3 className="text-white font-bold uppercase tracking-widest text-sm">Resumen Ejecutivo de Gestión</h3>
            <p className="text-slate-400 text-xs mt-1">Análisis de evolución histórica de {modelName || 'la modelo'}</p>
          </div>
        </div>

        {/* Glosario de términos */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">TPH — Tokens por Hora</p>
            <p className="text-[10px] text-slate-400 leading-relaxed">Mide la eficiencia productiva: cuántos tokens genera la modelo por cada hora transmitida. Más alto = mejor rendimiento.</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">ICJ % — Índice de Cumplimiento de Jornada</p>
            <p className="text-[10px] text-slate-400 leading-relaxed">Porcentaje de horas trabajadas sobre las horas obligatorias del periodo (6h/día hábil). 100% = cumplimiento total.</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">ICR — Índice de Conversión Real</p>
            <p className="text-[10px] text-slate-400 leading-relaxed">Combina eficiencia (TPH) y disciplina (ICJ): TPH × ICJ/100. Refleja el rendimiento real considerando asistencia.</p>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Rank / G-Rank</p>
            <p className="text-[10px] text-slate-400 leading-relaxed">Posición en el ranking de la plataforma. <b className="text-white">Rank</b>: categoría. <b className="text-white">G-Rank</b>: posición global entre todas las modelos.</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-[10px] uppercase font-black text-slate-500 mb-2">Pico de Ingresos</p>
            <p className="text-white font-bold text-lg">
              {quincenas.reduce((max, q) => q.metrics.totalTokens > max.val ? { label: q.label, val: q.metrics.totalTokens } : max, { label: '', val: 0 }).label || '--'}
            </p>
            <p className="text-primary font-black text-xl">
              {quincenas.reduce((max, q) => Math.max(max, q.metrics.totalTokens), 0).toLocaleString()} TK
            </p>
          </div>
          
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-[10px] uppercase font-black text-slate-500 mb-2">Mejor Eficiencia (TPH)</p>
            <p className="text-white font-bold text-lg">
              {quincenas.reduce((max, q) => q.metrics.tph > max.val ? { label: q.label, val: q.metrics.tph } : max, { label: '', val: 0 }).label || '--'}
            </p>
            <p className="text-indigo-400 font-black text-xl">
              {quincenas.reduce((max, q) => Math.max(max, q.metrics.tph), 0).toFixed(2)} TPH
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-[10px] uppercase font-black text-slate-500 mb-2">Mayor Crecimiento de Audiencia</p>
            <p className="text-white font-bold text-lg">
              {quincenas.reduce((max, q) => q.metrics.followerGrowth > max.val ? { label: q.label, val: q.metrics.followerGrowth } : max, { label: '', val: 0 }).label || '--'}
            </p>
            <p className="text-emerald-500 font-black text-xl">
              +{quincenas.reduce((max, q) => Math.max(max, q.metrics.followerGrowth), 0).toLocaleString()} Seguidores
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
