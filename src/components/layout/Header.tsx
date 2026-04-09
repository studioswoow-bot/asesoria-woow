"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

export default function Header() {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="bg-panel-dark border-b border-text-main/5 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shrink-0">
      <div>
        <h2 className="text-xl font-bold text-text-main tracking-tight">Bienvenido, {profile?.displayName?.split(' ')[0] || "Manager"}</h2>
        <p className="text-xs text-text-muted mt-0.5">Gestión de Agencia WooW Estudios</p>
      </div>
      
      <div className="flex items-center gap-6">
        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-text-main/5 text-text-muted hover:text-primary transition-all border border-text-main/5 flex items-center justify-center"
          title={theme === 'dark' ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        >
          <span className="material-symbols-outlined text-[20px]">
            {theme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        <div className="relative group cursor-pointer">
          <div className="p-2 rounded-lg hover:bg-text-main/5 transition-colors">
            <span className="material-symbols-outlined text-text-muted group-hover:text-primary transition-colors text-[24px]">notifications</span>
            <span className="absolute top-2 right-2 h-2 w-2 bg-primary rounded-full border-2 border-panel-dark"></span>
          </div>
        </div>
        
        <div className="h-8 w-px bg-text-main/10"></div>
        
        <div className="flex items-center gap-3 cursor-pointer group px-3 py-1.5 rounded-xl hover:bg-text-main/5 transition-all">
          <div className="text-right hidden md:block">
            <p className="text-xs font-bold text-text-main group-hover:text-primary transition-colors">{profile?.displayName || "Usuario"}</p>
            <p className="text-[10px] text-text-muted uppercase font-black">{profile?.role || "Personal"}</p>
          </div>
          <div className="h-9 w-9 bg-primary/20 rounded-lg border border-primary/30 flex items-center justify-center text-primary font-black text-sm">
            {profile?.displayName?.charAt(0) || profile?.email?.charAt(0) || "U"}
          </div>
        </div>
      </div>
    </header>
  );
}
