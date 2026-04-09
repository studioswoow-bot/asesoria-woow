"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, getDocs, query } from "firebase/firestore";
import LoadingScreen from "@/components/common/LoadingScreen";
import { calculateProfileProgress } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

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

export default function ModelsPage() {
  const { user } = useAuth();
  const [realModels, setRealModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");


  useEffect(() => {
    async function fetchRealModels() {
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
          const progress = calculateProfileProgress(pData);

          return {
            id: doc.id,
            name: mData.name || "Sin nombre",
            status: mData.status || "Inactiva",
            platforms: mData.platforms || [],
            category: mData.category || "General",
            progress: progress,
            lastActive: mData.lastActive || "Desconocido",
            nickname: mData.nickname || "",
            isOnline: mData.is_online || false,
            syncStatus: mData.stream_stats?.last_sync_status || "offline"
          };
        });

        // Mostramos todos los modelos pero ordenados por relevancia (activos primero)
        const sortedModels = modelList.sort((a, b) => {
          const statusA = (a.status || "").toLowerCase();
          const statusB = (b.status || "").toLowerCase();
          const isActiveA = ["active", "activa", "activo", "online"].includes(statusA);
          const isActiveB = ["active", "activa", "activo", "online"].includes(statusB);
          if (isActiveA && !isActiveB) return -1;
          if (!isActiveA && isActiveB) return 1;
          return 0;
        });

        setRealModels(sortedModels);
      } catch (error) {
        console.error("Error fetching real models:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchRealModels();
  }, []);

  const filteredModels = realModels.filter(model => {
    const searchLower = searchQuery.toLowerCase();
    return (
      model.name.toLowerCase().includes(searchLower) || 
      (model.nickname && model.nickname.toLowerCase().includes(searchLower)) ||
      model.id.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-display font-bold text-text-main mb-2">Catálogo de Modelos</h2>
          <p className="text-text-muted">Datos sincronizados en tiempo real con la base de datos central de Estudios WooW.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            href="/models/register"
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all font-sans"
          >
            <span className="material-symbols-outlined text-[20px]">assignment_turned_in</span>
            <span>Perfilamiento</span>
          </Link>
        </div>
      </div>

      <div className="bg-panel-dark rounded-2xl border border-text-main/10 overflow-hidden shadow-xl">
        <div className="p-6 border-b border-text-main/10 flex items-center justify-between bg-text-main/5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">search</span>
              <input 
                type="text" 
                placeholder="Buscar modelos por nombre o apodo..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-text-main/5 border border-text-main/10 rounded-lg pl-10 pr-4 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary w-64 transition-all"
              />
            </div>
          </div>
          <div className="flex gap-2 text-xs text-text-muted items-center">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-green-500 animate-pulse"></span>
              Conexión Segura (Solo Lectura)
            </span>
          </div>
        </div>

        {loading ? (
          <div className="bg-panel-dark">
            <LoadingScreen message="Recuperando catálogo desde Firebase..." />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-text-muted border-b border-text-main/10">
                <th className="px-6 py-4 font-black">Nombre de la modelo</th>
                <th className="px-6 py-4 font-black">Plataformas</th>
                <th className="px-6 py-4 font-black">Categoría</th>
                <th className="px-6 py-4 font-black">Progreso Perfil</th>
                <th className="px-6 py-4 font-black">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-text-main/5">
              {filteredModels.map((model) => (
                <tr key={model.id} className="hover:bg-text-main/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold overflow-hidden uppercase">
                        {model.name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                      </div>
                    <div className="flex flex-col">
                      <div className="text-sm font-bold text-text-main group-hover:text-primary transition-colors flex items-center gap-2">
                        {model.name} ({model.nickname || "sin_apodo"})
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase ${
                          ["active", "activa", "activo", "online"].includes((model.status || "").toLowerCase()) 
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                          : "bg-red-500/10 text-red-500 border border-red-500/20"
                        }`}>
                          {model.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-text-muted">@{model.nickname || "sin_apodo"}</div>
                    </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1 flex-wrap">
                      {model.platforms?.map(p => (
                        <span key={p} className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-text-muted">{model.category}</td>
                  <td className="px-6 py-4 text-xs text-text-muted">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-background-dark rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${model.progress || 0}%` }}></div>
                      </div>
                      <span className="w-8 text-[10px] font-bold">{model.progress || 0}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <Link href={`/models/analytics?id=${model.id}`} className="p-2 hover:bg-accent-gold/20 rounded-lg text-text-muted hover:text-accent-gold transition-all" title="Análisis en tiempo real">
                        <span className="material-symbols-outlined text-sm">monitoring</span>
                      </Link>
                      <Link href={`/models/profile?id=${model.id}`} className="p-2 hover:bg-primary/20 rounded-lg text-text-muted hover:text-primary transition-all" title="Ver Perfil Premium">
                        <span className="material-symbols-outlined text-sm">visibility</span>
                      </Link>
                      <Link href={`/models/${model.id}/edit`} className="p-2 hover:bg-primary/20 rounded-lg text-text-muted hover:text-primary transition-all" title="Editar Perfilamiento">
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        
        <div className="p-6 border-t border-text-main/10 flex items-center justify-between text-xs text-text-muted">
          <div>Mostrando {realModels.length} modelos sincronizadas</div>
        </div>
      </div>
    </div>
  );
}
