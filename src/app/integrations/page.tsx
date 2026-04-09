"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";

export default function IntegrationsPage() {
  const { profile, loading } = useAuth();
  
  if (loading) return null;
  
  if (profile?.role !== 'admin') {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="size-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
          <span className="material-symbols-outlined text-red-500 text-5xl">lock</span>
        </div>
        <h2 className="text-2xl font-bold text-text-main mb-2">Acceso Restringido</h2>
        <p className="text-text-muted max-w-md">Lo sentimos, esta sección es de uso exclusivo para Administradores de WooW Estudios.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-10">
        <h2 className="text-3xl font-display font-bold text-text-main mb-2">Integraciones</h2>
        <p className="text-text-muted">Conecta el estudio con plataformas externas de streaming y herramientas de IA.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { name: "Antigravity Historical", desc: "Datos históricos de facturación", icon: "history", status: "Desconectado" },
          { name: "Gemini Copilot", desc: "Asistente de chat con IA", icon: "smart_toy", status: "Próximamente" },
          { name: "Chaturbate API", desc: "Conexión directa para tokens", icon: "stream", status: "Desconectado" },
          { name: "Stripchat API", desc: "Sincronización de estadísticas", icon: "bar_chart_4_bars", status: "Desconectado" },
          { name: "BongaCams API", desc: "Monitor de actividad", icon: "cell_tower", status: "Desconectado" },
          { name: "Google Drive", desc: "Almacenamiento de archivos", icon: "cloud", status: "Desconectado" },
        ].map((int, i) => (
          <div key={i} className="bg-panel-dark border border-text-main/10 p-6 rounded-2xl flex flex-col items-center text-center transition-colors">
            <div className="size-16 bg-background-dark rounded-full flex items-center justify-center mb-4 border border-text-main/10">
                <span className="material-symbols-outlined text-4xl text-text-muted">{int.icon}</span>
            </div>
            <h3 className="font-bold text-text-main mb-2">{int.name}</h3>
            <p className="text-xs text-text-muted mb-6 flex-1">{int.desc}</p>
            <div className={`text-[10px] font-black uppercase tracking-widest mb-4 px-3 py-1 rounded-full ${
                int.status === "Próximamente" ? "bg-blue-500/10 text-blue-500" : "bg-red-500/10 text-red-500"
            }`}>
                {int.status}
            </div>
            <button className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-xs font-bold transition-all">
                Configurar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
