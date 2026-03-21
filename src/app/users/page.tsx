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
  const [showModal, setShowModal] = useState(false);
  
  // Create User form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("monitor");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    } else if (!authLoading && user && profile && profile.role !== "admin") {
      // FIX #12 / Seguridad: Solo admins pueden gestionar usuarios
      setError("Acceso denegado: Solo los Administradores pueden gestionar usuarios.");
    }
  }, [user, profile, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      // FIX #1: Enviar token de autenticación al endpoint protegido
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    // FIX #12: Validación de contraseña en el cliente antes del request
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      setSubmitting(false);
      return;
    }
    
    try {
      // FIX #1: Enviar token de autenticación al endpoint protegido
      const token = await user!.getIdToken();
      const res = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ displayName: name, email, password, role }),
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setShowModal(false);
      setName("");
      setEmail("");
      setPassword("");
      setRole("monitor");
      fetchUsers();
    } catch (err: any) {
      setError("Error al crear usuario: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este usuario? Esta acción no se puede deshacer.")) return;
    
    try {
      // FIX #1: Enviar token de autenticación al endpoint protegido
      const token = await user!.getIdToken();
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uid }),
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      fetchUsers();
    } catch (err: any) {
      setError("Error al eliminar usuario: " + err.message);
    }
  };

  if (authLoading) return <div className="p-8 text-center text-slate-400">Cargando sesión...</div>;
  if (!user) return null;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-display font-black text-white mb-2 bg-gradient-to-r from-primary to-accent-gold bg-clip-text text-transparent">Gestión de Usuarios</h2>
          <p className="text-slate-400 flex items-center gap-2">
            Control de perfiles para administradores y monitores de <strong>WooW Estudios</strong>.
          </p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-4 bg-primary text-white font-black rounded-2xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/20"
        >
          <span className="material-symbols-outlined">person_add</span>
          Crear Nuevo Usuario
        </button>
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
              <h3 className="text-lg font-bold text-white">Administrador</h3>
              <p className="text-xs text-slate-500">Permisos totales y gestión de sistema.</p>
            </div>
          </div>
        </div>
        <div className="bg-sidebar-dark/40 border border-accent-gold/20 p-6 rounded-2xl backdrop-blur-sm group hover:border-accent-gold/40 transition-all">
          <div className="flex items-center gap-4 mb-4">
            <div className="size-12 rounded-xl bg-accent-gold/20 flex items-center justify-center text-accent-gold group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-3xl">monitoring</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Monitor</h3>
              <p className="text-xs text-slate-500">Supervisión operativa y soporte.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-sidebar-dark/30 border border-white/5 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 uppercase tracking-widest text-[10px] font-black text-slate-400">
                <th className="px-8 py-5">UID</th>
                <th className="px-8 py-5">Usuario/Email</th>
                <th className="px-8 py-5">Rol</th>
                <th className="px-8 py-5">Creado</th>
                <th className="px-8 py-5">Último Acceso</th>
                <th className="px-8 py-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                   <td colSpan={6} className="px-8 py-20 text-center text-slate-500 italic">Cargando base de datos de usuarios...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                   <td colSpan={6} className="px-8 py-20 text-center text-slate-500 italic">No hay usuarios registrados.</td>
                </tr>
              ) : users.map((u) => (
                <tr key={u.uid} className="hover:bg-white/5 transition-colors group">
                  <td className="px-8 py-5 font-mono text-[11px] text-slate-500">{u.uid.slice(0, 8)}...</td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-white font-bold">{u.displayName}</span>
                      <span className="text-slate-500 text-xs">{u.email}</span>
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
                  <td className="px-8 py-5 text-slate-400 text-sm">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-8 py-5 text-slate-500 text-sm">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : "Nunca"}</td>
                  <td className="px-8 py-5 text-right">
                    <button 
                      onClick={() => handleDeleteUser(u.uid)}
                      disabled={u.uid === user.uid}
                      className="size-10 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 flex items-center justify-center hover:text-white transition-all disabled:opacity-0"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para Crear Usuario */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background-dark/80 backdrop-blur-md">
          <div className="w-full max-w-xl bg-sidebar-dark border border-white/10 rounded-3xl shadow-2xl p-10 animate-in zoom-in duration-300">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black text-white">Nuevo Integrante</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Completo</label>
                  <input 
                    type="text" 
                    required 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-4 bg-background-dark border border-white/5 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ej: Juan Pérez"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email Corporativo</label>
                  <input 
                    type="email" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-4 bg-background-dark border border-white/5 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="email@estudioswoow.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Contraseña Inicial</label>
                  <input 
                    type="password" 
                    required 
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-4 bg-background-dark border border-white/5 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Mín. 6 caracteres"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Perfil (Rol)</label>
                  <select 
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-4 py-4 bg-background-dark border border-white/5 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
                  >
                    <option value="monitor">Monitor / Operador</option>
                    <option value="admin">Administrador Geral</option>
                    <option value="coordinador">Coordinador de Estudio</option>
                  </select>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full py-5 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all disabled:opacity-50"
                >
                  {submitting ? "Creando Integrante..." : "Confirmar y Dar de Alta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
