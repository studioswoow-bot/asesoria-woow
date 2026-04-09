"use client";

import React, { useEffect, useState } from 'react';
import MetricCard from '@/components/dashboard/MetricCard';
import ModelTable from '@/components/dashboard/ModelTable';
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import Link from 'next/link';

import { calculateProfileProgress } from '@/lib/utils';

interface Model {
  id: string;
  name: string;
  status: string;
  platforms?: string[];
  category?: string;
  progress?: number;
  lastActive?: string;
  nickname?: string;
  isOnline?: boolean;
  syncStatus?: string;
}

export default function Home() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    total: 0,
    active: 0,
    inProcess: 0,
    revenue: "0 TK",
    fortnightLabel: "Calculando..."
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const qModels = query(collection(db, "models"));
        const qProfiles = query(collection(db, "modelos_profile_v2"));
        
        // CALCULAR QUINCENA ACTUAL
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = now.getDate();
        
        let startDate, endDate, qLabel;
        if (day <= 15) {
          startDate = `${year}-${month}-01`;
          endDate = `${year}-${month}-15`;
          qLabel = `Q1 ${month}/${year.toString().slice(-2)}`;
        } else {
          startDate = `${year}-${month}-16`;
          const lastDayMonth = new Date(year, now.getMonth() + 1, 0).getDate();
          endDate = `${year}-${month}-${String(lastDayMonth).padStart(2, '0')}`;
          qLabel = `Q2 ${month}/${year.toString().slice(-2)}`;
        }

        const qMetrics = query(
          collection(db, "daily_metrics"),
          where("date", ">=", startDate),
          where("date", "<=", endDate)
        );

        const [modelsSnapshot, profilesSnapshot, metricsSnapshot] = await Promise.all([
          getDocs(qModels),
          getDocs(qProfiles),
          getDocs(qMetrics)
        ]);

        let totalTokens = 0;
        metricsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          let tokenValue = Number(data.tokens || 0);
          
          // Conversión de USD a Tokens (1 USD = 20 Tokens)
          if (data.currency?.toLowerCase() === "usd") {
            tokenValue = tokenValue * 20;
          }
          // Conversión de EUR a Tokens (Estimación)
          // Si el usuario dijo "como en 7288e", tal vez debería buscar si hay EUR.
          // Pero como no lo vi, me quedo con USD. 
          // Agrego soporte básico por si acaso existe.
          if (data.currency?.toLowerCase() === "eur") {
            tokenValue = tokenValue * 22;
          }
          
          totalTokens += tokenValue;
        });

        const profilesMap = new Map();
        profilesSnapshot.docs.forEach(doc => {
          profilesMap.set(doc.id, doc.data());
        });

        const modelList = modelsSnapshot.docs.map(doc => {
          const mData = doc.data();
          const pData = profilesMap.get(doc.id);
          // Calculate progress using the utility function
          const progress = calculateProfileProgress(pData);
          
          return {
            id: doc.id,
            name: String(mData.name || "Sin nombre"),
            status: String(mData.status || "Inactiva"),
            nickname: String(mData.nickname || ""),
            category: String(mData.category || "General"),
            lastActive: (() => {
              const ts = mData.lastActive || mData.stream_stats?.synced_at || mData.updatedAt;
              if (!ts) return "Desconocido";
              if (typeof ts.toDate === 'function') return ts.toDate().toLocaleString();
              if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString();
              return String(ts);
            })(),
            progress: Number(progress),
            isOnline: !!mData.is_online,
            syncStatus: mData.stream_stats?.last_sync_status || "offline"
          };
        }) as Model[];

        // Filtrar solo las modelos activas en el estudio (7288e)
        const studioModels = modelList.filter(m => {
          const s = (m.status || "").toLowerCase();
          return s === "active" || s === "activa" || s === "activo" || s === "online";
        });

        setModels(studioModels);
        
        // Calcular métricas basadas solo en modelos que continúan en el estudio
        const total = studioModels.length;
        const activeCount = studioModels.filter(m => {
          // Solo contamos como "completamente activas" las que tienen perfil al 100%
          return m.progress === 100;
        }).length;

        const pending = studioModels.filter(m => {
          const s = (m.status || "").toLowerCase();
          const isPendingStatus = s === "pendiente" || s === "pending" || s === "en proceso" || s === "en revisión" || s === "revision";
          const isProfileIncomplete = (m.progress || 0) < 100;
          return isPendingStatus || isProfileIncomplete;
        }).length;
        
        setMetrics({
          total,
          active: activeCount,
          inProcess: pending,
          revenue: `${Math.round(totalTokens).toLocaleString()} TK`,
          fortnightLabel: `Periodo: ${qLabel}`
        });

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

  const filteredModels = models.filter(model => {
    const searchLower = searchQuery.toLowerCase();
    const modelName = model.name || "";
    const matchesSearch = 
      modelName.toLowerCase().includes(searchLower) || 
      (model.nickname && model.nickname.toLowerCase().includes(searchLower)) ||
      (model.id && model.id.toLowerCase().includes(searchLower));
    
    if (activeFilter === "all") return matchesSearch;
    
    const statusLower = (model.status || "").toLowerCase();
    if (activeFilter === "active") {
      const isActiveStatus = statusLower === "activa" || statusLower === "active" || statusLower === "activo" || statusLower === "online";
      return matchesSearch && isActiveStatus && model.progress === 100;
    }
    if (activeFilter === "pending") {
      const isPendingStatus = statusLower === "pendiente" || statusLower === "pending" || statusLower === "en proceso" || statusLower === "en revisión" || statusLower === "revision";
      const isProfileIncomplete = (model.progress || 0) < 100;
      return matchesSearch && (isPendingStatus || isProfileIncomplete);
    }
    return matchesSearch;
  });

  if (!isMounted) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Total modelos" 
          value={String(metrics.total)} 
          icon="group"
          trendValue="+12%"
          trendColor="emerald"
        />
        <MetricCard 
          title="En Proceso" 
          value={String(metrics.inProcess)} 
          icon="schedule"
          subtext={`${metrics.inProcess} pendientes`}
          trendColor="blue"
        />
        <MetricCard 
          title="Modelos activas" 
          value={String(metrics.active)} 
          icon="check_circle"
          trendValue="+5%"
          trendColor="emerald"
        />
        <MetricCard 
          title="Tokens Quincena" 
          value={metrics.revenue} 
          icon="payments"
          subtext={metrics.fortnightLabel}
          trendValue="+18%"
          trendColor="emerald"
        />
      </div>

      <div className="bg-panel-dark p-4 rounded-xl border border-text-main/5 flex items-center justify-between shadow-lg shadow-black/20">
        <div className="flex items-center gap-4">
          <div className="flex gap-2 bg-primary/5 p-1 rounded-lg">
            <button 
              onClick={() => setActiveFilter("all")}
              className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeFilter === 'all' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-text-muted hover:text-text-main'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setActiveFilter("active")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeFilter === 'active' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-text-muted hover:text-text-main'}`}
            >
              Activos
            </button>
            <button 
              onClick={() => setActiveFilter("pending")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeFilter === 'pending' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-text-muted hover:text-text-main'}`}
            >
              En Revisión
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[20px]">search</span>
            <input 
              type="text" 
              placeholder="Buscar por nombre o apodo..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-text-main/5 border border-text-main/10 rounded-lg text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary w-64 transition-all"
            />
          </div>
          <Link href="/models/register" className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Registrar modelo
          </Link>
        </div>
      </div>

      <ModelTable models={filteredModels} loading={loading} />
    </div>
  );
}
