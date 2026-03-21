"use client";

import React from "react";
import { usePlatforms } from "@/context/PlatformContext";

export default function SettingsPage() {
  const { platforms, addPlatform, removePlatform } = usePlatforms();
  const [newPlatform, setNewPlatform] = React.useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPlatform.trim()) {
      addPlatform(newPlatform.trim());
      setNewPlatform("");
    }
  };

  return (
    <div className="p-8">
      <div className="mb-10">
        <h2 className="text-3xl font-display font-bold text-white mb-2">Configuración</h2>
        <p className="text-slate-400">Personaliza el portal y gestiona los parámetros generales del estudio.</p>
      </div>

      <div className="max-w-4xl space-y-8">
        {/* Gestión de Plataformas */}
        <div className="bg-sidebar-dark/50 border border-primary/20 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-primary/20 bg-primary/5 flex items-center justify-between">
                <div>
                    <h3 className="font-bold text-white text-lg">Plataformas de Transmisión</h3>
                    <p className="text-xs text-slate-500">Agrega o elimina plataformas disponibles para las modelos.</p>
                </div>
                <span className="material-symbols-outlined text-primary">stream</span>
            </div>
            <div className="p-8 space-y-6">
                <form onSubmit={handleAdd} className="flex gap-4">
                    <input 
                        type="text" 
                        value={newPlatform}
                        onChange={(e) => setNewPlatform(e.target.value)}
                        placeholder="Nombre de la nueva plataforma..." 
                        className="flex-1 bg-background-dark border border-primary/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    />
                    <button 
                        type="submit"
                        className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/20"
                    >
                        <span className="material-symbols-outlined">add</span>
                        Agregar
                    </button>
                </form>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-4">
                    {platforms.map(p => (
                        <div key={p} className="group relative flex items-center justify-between bg-primary/10 border border-primary/20 px-4 py-3 rounded-xl">
                            <span className="text-sm font-medium text-slate-200">{p}</span>
                            <button 
                                onClick={() => removePlatform(p)}
                                className="size-6 rounded-md hover:bg-red-500/20 text-slate-500 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center"
                            >
                                <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div className="bg-sidebar-dark/50 border border-primary/20 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-primary/10">
                <h3 className="font-bold text-white">General</h3>
            </div>
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-300">Modo Oscuro</p>
                        <p className="text-xs text-slate-500">Alternar tema visual del portal</p>
                    </div>
                    <div className="w-12 h-6 bg-primary rounded-full relative flex items-center px-1">
                        <div className="size-4 bg-white rounded-full ml-auto"></div>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-300">Idioma</p>
                        <p className="text-xs text-slate-500">Preferencia de lenguaje del sistema</p>
                    </div>
                    <select className="bg-background-dark border border-primary/20 rounded-lg px-3 py-1 text-xs text-white">
                        <option>Español</option>
                        <option>Inglés</option>
                    </select>
                </div>
            </div>
        </div>

        <div className="bg-sidebar-dark/50 border border-primary/20 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-primary/10 text-red-400">
                <h3 className="font-bold">Zona de Peligro</h3>
            </div>
            <div className="p-6">
                <button className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg text-xs font-bold transition-all">
                    Resetear Datos del Portal
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}
