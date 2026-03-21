"use client";

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import LoadingScreen from "@/components/common/LoadingScreen";

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [timeRange, setTimeRange] = useState('24h');

  // Mock data same as before
  const metrics = [
    { title: 'Ingresos Totales', value: '$1,240.50', trend: '+15%', icon: 'payments', color: 'emerald' },
    { title: 'Propinas (Tips)', value: '$850.20', trend: '+22%', icon: 'volunteer_activism', color: 'amber' },
    { title: 'Usuarios Únicos', value: '3,420', trend: '+8%', icon: 'group', color: 'blue' },
    { title: 'Mensajes Chat', value: '12.5k', trend: '+30%', icon: 'forum', color: 'purple' },
  ];

  const topUsers = [
    { name: 'UltraTipper42', tokens: 15400, avatar: 'https://i.pravatar.cc/150?u=1' },
    { name: 'LoveModel99', tokens: 12100, avatar: 'https://i.pravatar.cc/150?u=2' },
    { name: 'SecretFan_X', tokens: 9800, avatar: 'https://i.pravatar.cc/150?u=3' },
  ];

  const practices = [
    { type: 'good', title: 'Alta reactividad al chat', description: 'Responde al 95% de los mensajes en menos de 10s.', impact: 'Alto' },
    { type: 'good', title: 'Uso de hashtags estratégicos', description: 'Aumento del 40% en tráfico orgánico.', impact: 'Medio' },
    { type: 'bad', title: 'Iluminación inconsistente', description: 'Se detectaron 15 min de subexposición en la última sesión.', impact: 'Crítico' },
    { type: 'bad', title: 'Falta de Call to Action (CTA)', description: 'Pocas peticiones de propinas durante picos de audiencia.', impact: 'Medio' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-sidebar-dark/40 p-8 rounded-3xl border border-slate-200 dark:border-primary/10 shadow-xl shadow-primary/5">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="size-20 rounded-2xl bg-gradient-to-br from-primary to-accent-gold p-1 shadow-lg shadow-primary/20">
              <img src="https://i.pravatar.cc/150?img=32" alt="Avatar" className="size-full object-cover rounded-xl" />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded-full border-4 border-white dark:border-sidebar-dark animate-pulse">
              EN VIVO
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              Análisis de transmisión
              <span className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-primary/10 px-2 py-1 rounded-lg border border-slate-200 dark:border-primary/20 uppercase tracking-widest">{id || 'MOD-001'}</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 uppercase text-xs tracking-tighter">
              Métricas en tiempo real via API • <span className="text-primary font-bold">Estado: En Vivo</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-100 dark:bg-primary/5 p-1.5 rounded-2xl border border-slate-200 dark:border-primary/10 h-fit">
          {['24h', '7d', '30d', 'MTD'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${
                timeRange === range 
                  ? 'bg-white dark:bg-primary text-primary dark:text-white shadow-xl shadow-primary/20 scale-105' 
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m) => (
          <div key={m.title} className="bg-white dark:bg-sidebar-dark/40 p-6 rounded-3xl border border-slate-200 dark:border-primary/10 shadow-sm group hover:border-primary/30 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className={`size-12 rounded-2xl bg-${m.color}-500/10 flex items-center justify-center text-${m.color}-500 shadow-inner`}>
                <span className="material-symbols-outlined text-[24px]">{m.icon}</span>
              </div>
              <span className="text-xs font-black text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg">{m.trend}</span>
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
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Flujo de Transmisión</h3>
              <p className="text-xs text-slate-500 uppercase font-black tracking-tighter">Interacción vs Ingresos</p>
            </div>
          </div>
          <div className="relative h-64 flex items-end gap-2 overflow-hidden">
            {[...Array(24)].map((_, i) => {
              const height1 = Math.floor(Math.random() * 80) + 10;
              const height2 = Math.floor(Math.random() * 60) + 5;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                  <div className="w-full bg-accent-gold/20 rounded-t-sm transition-all group-hover:bg-accent-gold/40" style={{ height: `${height2}%` }}></div>
                  <div className="w-full bg-primary/20 rounded-t-sm transition-all group-hover:bg-primary/40" style={{ height: `${height1}%` }}></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-900 dark:bg-primary/5 p-8 rounded-3xl border border-white/5 dark:border-primary/10 shadow-2xl flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-10 rounded-full bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-[20px]">smart_toy</span>
            </div>
            <h3 className="font-bold text-white uppercase tracking-tighter text-sm">Validación AI</h3>
          </div>
          <div className="space-y-4 flex-1">
            {practices.map((p, i) => (
              <div key={i} className={`p-4 rounded-2xl border ${p.type === 'good' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <h4 className="text-white text-xs font-bold mb-1">{p.title}</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed">{p.description}</p>
              </div>
            ))}
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
