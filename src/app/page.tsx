"use client";

import React, { useEffect, useState } from 'react';
import MetricCard from '@/components/dashboard/MetricCard';
import ModelTable from '@/components/dashboard/ModelTable';
import { db } from "@/lib/firebase";
import { collection, getDocs, query } from "firebase/firestore";
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
}

export default function Home() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    total: 0,
    active: 0,
    inProcess: 0,
    revenue: "$0.00" // Placeholder for now
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const qModels = query(collection(db, "models"));
        const qProfiles = query(collection(db, "modelos_profile_v2"));
        
        const [modelsSnapshot, profilesSnapshot] = await Promise.all([
          getDocs(qModels),
          getDocs(qProfiles)
        ]);

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
            name: mData.name || "Sin nombre",
            status: mData.status || "Inactiva",
            nickname: mData.nickname || "",
            ...mData,
            progress: progress
          };
        }) as Model[];

        setModels(modelList);
        
        // Calcular métricas
        const total = modelList.length;
        const active = modelList.filter(m => {
          const s = (m.status || "").toLowerCase();
          // Solo contamos como activas las que tienen estado activo Y perfil al 100%?
          // El usuario pidió que las de <100% se sumen a "en proceso".
          return (s === "activa" || s === "active" || s === "activo" || s === "online") && (m.progress === 100);
        }).length;

        const pending = modelList.filter(m => {
          const s = (m.status || "").toLowerCase();
          const isPendingStatus = s === "pendiente" || s === "pending" || s === "en proceso" || s === "en revisión" || s === "review" || s === "revision";
          const isProfileIncomplete = (m.progress || 0) < 100;
          return isPendingStatus || isProfileIncomplete;
        }).length;
        
        setMetrics({
          total,
          active,
          inProcess: pending,
          revenue: "$45,200" // Mocking revenue as it's not in the models collection
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
    const matchesSearch = 
      model.name.toLowerCase().includes(searchLower) || 
      (model.nickname && model.nickname.toLowerCase().includes(searchLower)) ||
      model.id.toLowerCase().includes(searchLower);
    
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Total modelos" 
          value={metrics.total.toString()} 
          icon="group"
          trendValue="+12%"
          trendColor="emerald"
        />
        <MetricCard 
          title="En Proceso" 
          value={metrics.inProcess.toString()} 
          icon="schedule"
          subtext={`${metrics.inProcess} pendientes`}
          trendColor="blue"
        />
        <MetricCard 
          title="Modelos activas" 
          value={metrics.active.toString()} 
          icon="check_circle"
          trendValue="+5%"
          trendColor="emerald"
        />
        <MetricCard 
          title="Ingresos Mes" 
          value={metrics.revenue} 
          icon="payments"
          trendValue="+18%"
          trendColor="emerald"
        />
      </div>

      <div className="bg-sidebar-dark/50 p-4 rounded-xl border border-primary/20 flex items-center justify-between shadow-lg shadow-black/20">
        <div className="flex items-center gap-4">
          <div className="flex gap-2 bg-primary/5 p-1 rounded-lg">
            <button 
              onClick={() => setActiveFilter("all")}
              className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeFilter === 'all' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setActiveFilter("active")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeFilter === 'active' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white'}`}
            >
              Activos
            </button>
            <button 
              onClick={() => setActiveFilter("pending")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeFilter === 'pending' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white'}`}
            >
              En Revisión
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
            <input 
              type="text" 
              placeholder="Buscar por nombre o apodo..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-background-dark border border-primary/20 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary w-64 transition-all"
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
