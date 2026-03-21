import React from "react";

export default function Header() {
  return (
    <header className="bg-panel-dark border-b border-white/5 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shrink-0">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Bienvenido, Manager</h2>
        <p className="text-xs text-slate-400 mt-0.5">Gestión de Agencia WooW Estudios</p>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="relative group cursor-pointer">
          <div className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors text-[24px]">notifications</span>
            <span className="absolute top-2 right-2 h-2 w-2 bg-primary rounded-full border-2 border-panel-dark"></span>
          </div>
        </div>
        
        <div className="h-8 w-px bg-white/10"></div>
        
        <div className="flex items-center gap-3 cursor-pointer group px-3 py-1.5 rounded-xl hover:bg-white/5 transition-all">
          <div className="text-right hidden md:block">
            <p className="text-xs font-bold text-white group-hover:text-primary transition-colors">Admin Usuario</p>
            <p className="text-[10px] text-slate-500 uppercase font-black">Administrador</p>
          </div>
          <div className="h-9 w-9 bg-primary/20 rounded-lg border border-primary/30 flex items-center justify-center text-primary font-black text-sm">
            AU
          </div>
          <span className="material-symbols-outlined text-slate-500 text-[18px]">expand_more</span>
        </div>
      </div>
    </header>
  );
}
