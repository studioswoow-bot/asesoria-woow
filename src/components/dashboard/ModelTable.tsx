"use client";

import React from "react";
import Link from "next/link";
import LoadingScreen from "@/components/common/LoadingScreen";

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

interface ModelTableProps {
  models: Model[];
  loading?: boolean;
}

export default function ModelTable({ models, loading }: ModelTableProps) {
  const getStatusStyles = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "activa" || s === "active" || s === "activo" || s === "online") return "bg-green-500/10 text-green-500 border-green-500/20";
    if (s === "pendiente" || s === "pending" || s === "en proceso" || s === "en revisión" || s === "review" || s === "revision") return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    return "bg-slate-500/10 text-slate-500 border-slate-500/20";
  };

  const getStatusDot = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "activa" || s === "active" || s === "activo" || s === "online") return "bg-green-500";
    if (s === "pendiente" || s === "pending" || s === "en proceso" || s === "en revisión" || s === "review" || s === "revision") return "bg-amber-500";
    return "bg-slate-500";
  };

  if (loading) {
    return (
      <div className="bg-sidebar-dark/50 rounded-2xl border border-primary/20 overflow-hidden">
        <LoadingScreen message="Sincronizando modelos..." />
      </div>
    );
  }

  return (
    <div className="bg-sidebar-dark/50 rounded-2xl border border-primary/20 shadow-xl shadow-black/20 overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-primary/5 border-b border-primary/10">
            <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Perfil</th>
            <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado</th>
            <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Categoría</th>
            <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Progreso</th>
            <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Última Actividad</th>
            <th className="py-4 px-6 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-primary/5">
          {models.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-10 text-center text-slate-500 text-sm italic">
                No se encontraron modelos registradas.
              </td>
            </tr>
          ) : (
            models.map((model) => (
              <tr key={model.id} className="hover:bg-primary/5 transition-colors group">
                <td className="py-4 px-6">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold border border-primary/30 shrink-0 uppercase">
                      {typeof model.name === 'string' ? model.name.split(" ").map(n => n[0]).join("").substring(0, 2) : "M"}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white group-hover:text-primary transition-colors">{String(model.name || "Sin nombre")}</p>
                      <p className="text-[10px] text-slate-500">@{String(model.nickname || "sin_apodo")}</p>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${getStatusStyles(String(model.status))}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${getStatusDot(String(model.status))}`}></span>
                    {String(model.status || "Sin estado")}
                  </span>
                </td>
                <td className="py-4 px-6">
                  <div className="flex gap-1">
                    <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded text-[9px] font-bold uppercase tracking-wider">{String(model.category || "General")}</span>
                  </div>
                </td>
                <td className="py-4 px-6 min-w-[140px]">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-primary/10 rounded-full overflow-hidden border border-primary/5">
                      <div 
                        className={`h-full transition-all duration-1000 ${
                          (model.progress || 0) === 100 ? 'bg-emerald-500' : 
                          (model.progress || 0) > 50 ? 'bg-blue-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${model.progress || 0}%` }}
                      ></div>
                    </div>
                    <span className={`text-[10px] font-black w-8 ${
                      (model.progress || 0) === 100 ? 'text-emerald-500' : 'text-slate-400'
                    }`}>
                      {model.progress || 0}%
                    </span>
                  </div>
                </td>
                <td className="py-4 px-6 text-xs text-slate-400">{model.lastActive ? String(model.lastActive) : "Desconocido"}</td>
                <td className="py-4 px-6 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Link href={`/models/analytics?id=${model.id}`} className="p-2 text-slate-400 hover:text-accent-gold hover:bg-accent-gold/10 rounded-lg transition-all" title="Insights & Análisis">
                      <span className="material-symbols-outlined text-[18px]">monitoring</span>
                    </Link>
                    <Link href={`/models/profile?id=${model.id}`} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Ver Perfil">
                      <span className="material-symbols-outlined text-[18px]">visibility</span>
                    </Link>
                    <Link href={`/models/edit?id=${model.id}`} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all" title="Editar">
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </Link>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      
      <div className="px-6 py-4 border-t border-primary/10 flex items-center justify-between bg-primary/5">
        <p className="text-xs text-slate-500">Mostrando {models.length} modelos en tiempo real</p>
      </div>
    </div>
  );
}
