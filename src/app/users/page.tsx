"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

interface UserRecord {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
  lastLogin?: string;
}

export default function UsersPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    } else if (!authLoading && user && profile && profile.role !== "admin") {
      setError("Acceso denegado: Solo los Administradores pueden consultar el listado de usuarios.");
    }
  }, [user, profile, authLoading, router]);

  useEffect(() => {
    if (user && profile?.role === "admin") {
      fetchUsers();
    }
  }, [user, profile]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = await user!.getIdToken();
      const res = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUsers(data);
    } catch (err: any) {
      setError("Error al cargar usuarios: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return <div className="p-8 text-center text-slate-400">Cargando sesión...</div>;
  if (!user) return null;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-display font-black text-text-main mb-2">Consulta de Staff</h2>
          <p className="text-text-muted flex items-center gap-2">
            Listado de perfiles compartidos con el proyecto <strong>7288e</strong>.
          </p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-3 rounded-xl flex items-center gap-3 text-amber-500 text-xs font-bold max-w-xs">
          <span className="material-symbols-outlined">shield_lock</span>
          Esta vista es de solo lectura. Para gestionar usuarios, usa el Panel Central de Estudios WooW.
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-300 text-sm">
          <span className="material-symbols-outlined text-red-500">warning</span>
          {error}
        </div>
      )}

      {/* Grid of Roles to remind permissions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-sidebar-dark/40 border border-primary/20 p-6 rounded-2xl backdrop-blur-sm group hover:border-primary/40 transition-all">
          <div className="flex items-center gap-4 mb-4">
            <div className="size-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-main">Administrador</h3>
              <p className="text-xs text-text-muted">Permisos totales en el sistema central.</p>
            </div>
          </div>
        </div>
        <div className="bg-sidebar-dark/40 border border-accent-gold/20 p-6 rounded-2xl backdrop-blur-sm group hover:border-accent-gold/40 transition-all">
          <div className="flex items-center gap-4 mb-4">
            <div className="size-12 rounded-xl bg-accent-gold/20 flex items-center justify-center text-accent-gold group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-3xl">monitoring</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-main">Monitor</h3>
              <p className="text-xs text-text-muted">Personal operativo de supervisión.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-panel-dark border border-text-main/10 rounded-3xl overflow-hidden shadow-2xl transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-text-main/5 border-b border-text-main/10 uppercase tracking-widest text-[10px] font-black text-text-muted">
                <th className="px-8 py-5">UID</th>
                <th className="px-8 py-5">Usuario/Email</th>
                <th className="px-8 py-5">Rol</th>
                <th className="px-8 py-5">Creado</th>
                <th className="px-8 py-5">Último Acceso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                   <td colSpan={5} className="px-8 py-20 text-center text-slate-500 italic">Sincronizando con base de datos central...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                   <td colSpan={5} className="px-8 py-20 text-center text-slate-500 italic">No hay registros visibles o sincronizados.</td>
                </tr>
              ) : users.map((u) => (
                <tr key={u.uid} className="hover:bg-white/5 transition-colors group">
                  <td className="px-8 py-5 font-mono text-[11px] text-slate-500">{u.uid.slice(0, 8)}...</td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-text-main font-bold">{u.displayName}</span>
                      <span className="text-text-muted text-xs">{u.email}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      u.role === "admin" ? "bg-primary/20 text-primary border border-primary/20" : 
                      u.role === "monitor" ? "bg-accent-gold/20 text-accent-gold border border-accent-gold/20" : 
                      "bg-white/10 text-slate-400"
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-text-muted text-sm">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-8 py-5 text-text-muted text-sm">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : "Nunca"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <p className="text-[10px] text-center text-text-muted">
        Los cambios en esta base de datos afectan directamente a la operatividad de Estudios WooW (Proyecto 7288e).
      </p>
    </div>
  );
}
