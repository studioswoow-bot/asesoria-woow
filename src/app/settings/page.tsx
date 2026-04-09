"use client";

import React from "react";
import { usePlatforms } from "@/context/PlatformContext";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";

export default function SettingsPage() {
  const { platforms, addPlatform, removePlatform } = usePlatforms();
  const { theme, toggleTheme } = useTheme();
  const { profile, loading } = useAuth();
  const [newPlatform, setNewPlatform] = React.useState("");

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
        <h2 className="text-3xl font-display font-bold text-text-main mb-2">Configuración</h2>
        <p className="text-text-muted">Personaliza el portal y gestiona los parámetros generales del estudio.</p>
      </div>

      <div className="max-w-4xl space-y-8">
        {/* Gestión de Plataformas */}
        <div className="bg-panel-dark border border-primary/20 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-primary/20 bg-primary/5 flex items-center justify-between">
                <div>
                    <h3 className="font-bold text-text-main text-lg">Plataformas de Transmisión</h3>
                    <p className="text-xs text-text-muted">Agrega o elimina plataformas disponibles para las modelos.</p>
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
                        className="flex-1 bg-background-dark border border-primary/20 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-slate-400"
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

        <div className="bg-panel-dark border border-primary/20 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-6 border-b border-primary/10 bg-primary/5">
                <h3 className="font-bold text-slate-900 dark:text-white">General</h3>
            </div>
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-text-main">Modo Oscuro</p>
                        <p className="text-xs text-text-muted">Alternar tema visual del portal (Claro/Oscuro)</p>
                    </div>
                    <button 
                        onClick={toggleTheme}
                        className={`w-14 h-7 rounded-full transition-all relative flex items-center px-1 ${theme === 'dark' ? 'bg-primary' : 'bg-slate-300'}`}
                    >
                        <div className={`size-5 bg-white rounded-full shadow-md transition-all flex items-center justify-center ${theme === 'dark' ? 'ml-auto' : 'ml-0'}`}>
                            <span className="material-symbols-outlined text-[12px] text-slate-700">
                                {theme === 'dark' ? 'dark_mode' : 'light_mode'}
                            </span>
                        </div>
                    </button>
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-text-main">Idioma</p>
                        <p className="text-xs text-text-muted">Preferencia de lenguaje del sistema</p>
                    </div>
                    <select className="bg-background-page border border-primary/20 rounded-lg px-3 py-1 text-xs text-text-main outline-none">
                        <option>Español</option>
                        <option>Inglés</option>
                    </select>
                </div>
            </div>
        </div>

        {/* Zona de Peligro deshabilitada para proteger proyecto 7288e */}
      </div>
    </div>
  );
}
