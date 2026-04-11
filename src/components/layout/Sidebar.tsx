"use client";

import Link from "next/link";
import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, profile } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <aside className="w-72 bg-sidebar-dark text-text-main flex flex-col h-full shrink-0 border-r border-text-main/5">
      <div className="flex flex-col h-full">
        {/* Logo Section */}
        <div className="p-8 flex items-center justify-center">
          <img src="/logo-studio.webp" alt="WooW Studio Logo" className="h-16 w-auto drop-shadow-2xl" />
        </div>

        {/* Profile Summary (Quick View) */}
        {profile && (
          <div className="mx-6 mb-8 p-4 bg-text-main/5 rounded-2xl border border-text-main/5 flex items-center gap-4 animate-in slide-in-from-left duration-500">
             <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black uppercase text-sm border border-primary/20 shadow-lg shadow-primary/5">
                {profile.displayName?.charAt(0) || profile.email?.charAt(0) || "U"}
             </div>
             <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-bold truncate text-text-main">{profile.displayName || "Usuario"}</span>
                <span className="text-[9px] font-black uppercase text-accent-gold tracking-[0.2em]">{profile.role}</span>
             </div>
          </div>
        )}

        {/* Navigation Section */}
        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto custom-scrollbar">
          {profile?.role === 'model' ? (
            // VISTA DE MODELO
            <div className="space-y-6">
              <div className="pb-2">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest px-4 mb-2">Mi Espacio</p>
                <Link href={`/models/profile?id=${profile.modelId}`} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${pathname === "/models/profile" ? "bg-primary/20 text-accent-gold border border-primary/30 shadow-lg shadow-primary/5" : "text-text-muted hover:bg-text-main/5 hover:text-text-main"}`}>
                  <span className="material-symbols-outlined text-[20px]">person</span>
                  <span className="font-bold text-sm">Mi Perfil</span>
                </Link>
                <Link href={`/models/analytics?id=${profile.modelId}`} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${pathname === "/models/analytics" ? "bg-primary/20 text-accent-gold border border-primary/30 shadow-lg shadow-primary/5" : "text-text-muted hover:bg-text-main/5 hover:text-text-main"}`}>
                  <span className="material-symbols-outlined text-[20px]">monitoring</span>
                  <span className="font-bold text-sm">Mis Estadísticas</span>
                </Link>
                <Link href={`/action-plans?modelId=${profile.modelId}`} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${pathname === "/action-plans" ? "bg-primary/20 text-accent-gold border border-primary/30 shadow-lg shadow-primary/5" : "text-text-muted hover:bg-text-main/5 hover:text-text-main"}`}>
                  <span className="material-symbols-outlined text-[20px]">event_note</span>
                  <span className="font-bold text-sm">Mis Planes</span>
                </Link>
              </div>
            </div>
          ) : (
            // VISTA DE STAFF (ADMIN/MONITOR)
            <>
              <div className="pb-2">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest px-4 mb-2">Principal</p>
                <Link href="/" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${pathname === "/" ? "bg-primary/20 text-accent-gold border border-primary/30 shadow-lg shadow-primary/5" : "text-text-muted hover:bg-text-main/5 hover:text-text-main"}`}>
                  <span className="material-symbols-outlined text-[20px]">dashboard</span>
                  <span className="font-bold text-sm">Dashboard</span>
                </Link>
                <Link href="/models" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${pathname.startsWith("/models") && pathname !== "/models/register" ? "bg-primary/20 text-accent-gold border border-primary/30 shadow-lg shadow-primary/5" : "text-text-muted hover:bg-text-main/5 hover:text-text-main"}`}>
                  <span className="material-symbols-outlined text-[20px]">group</span>
                  <span className="font-bold text-sm">Modelos</span>
                </Link>
              </div>

              {/* Tools Area */}
              <div className="pt-4 pb-2">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest px-4 mb-2">Herramientas</p>
                <Link href="/action-plans" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${pathname.startsWith("/action-plans") ? "bg-primary/20 text-accent-gold border border-primary/30 shadow-lg shadow-primary/5" : "text-text-muted hover:bg-text-main/5 hover:text-text-main"}`}>
                  <span className="material-symbols-outlined text-[20px]">event_note</span>
                  <span className="font-bold text-sm">Planes de Acción</span>
                </Link>
              </div>

              {/* Configuration Area */}
              <div className="pt-4 pb-2">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest px-4 mb-2">Administración</p>
                {profile?.role === 'admin' && (
                  <Link href="/users" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${pathname === "/users" ? "bg-primary/20 text-accent-gold border border-primary/30 shadow-lg shadow-primary/5" : "text-text-muted hover:bg-text-main/5 hover:text-text-main"}`}>
                    <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                    <span className="font-bold text-sm">Usuarios</span>
                  </Link>
                )}
                <Link href="/users/mapping" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${pathname === "/users/mapping" ? "bg-primary/20 text-accent-gold border border-primary/30 shadow-lg shadow-primary/5" : "text-text-muted hover:bg-text-main/5 hover:text-text-main"}`}>
                  <span className="material-symbols-outlined text-[20px]">link</span>
                  <span className="font-bold text-sm">Mapeo de Plataformas</span>
                </Link>
                {profile?.role === 'admin' && (
                  <>
                    <Link href="/integrations" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${pathname.startsWith("/integrations") ? "bg-primary/20 text-accent-gold border border-primary/30 shadow-lg shadow-primary/5" : "text-text-muted hover:bg-text-main/5 hover:text-text-main"}`}>
                      <span className="material-symbols-outlined text-[20px]">api</span>
                      <span className="font-bold text-sm">Integraciones</span>
                    </Link>
                    <Link href="/settings" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${pathname.startsWith("/settings") ? "bg-primary/20 text-accent-gold border border-primary/30 shadow-lg shadow-primary/5" : "text-text-muted hover:bg-text-main/5 hover:text-text-main"}`}>
                      <span className="material-symbols-outlined text-[20px]">settings</span>
                      <span className="font-bold text-sm">Ajustes</span>
                    </Link>
                  </>
                )}
              </div>
              
              <div className="pt-6 px-2">
                <Link href="/models/register" className="w-full flex items-center justify-center gap-2 py-4 bg-primary hover:bg-primary/90 text-white font-black rounded-xl transition-all shadow-xl shadow-primary/20 border border-primary/10">
                  <span className="material-symbols-outlined text-[18px]">person_add</span>
                  <span className="text-xs uppercase tracking-tighter text-white">Registrar modelo</span>
                </Link>
              </div>
            </>
          )}
        </nav>

        {/* Footer Section */}
        <div className="p-6 border-t border-text-main/5">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-text-muted hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all group"
          >
            <span className="material-symbols-outlined group-hover:rotate-180 transition-transform duration-500">logout</span>
            <span className="font-bold text-sm">Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
