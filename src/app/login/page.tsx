"use client";

import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (err: any) {
      console.error(err);
      setError("Error al iniciar sesión. Verifica tus credenciales.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-dark p-4">
      <div className="w-full max-w-md bg-sidebar-dark/50 p-10 rounded-3xl border border-primary/20 shadow-2xl backdrop-blur-xl">
        <div className="text-center mb-10">
          <img src="/logo-studio.webp" alt="WooW Studio Logo" className="h-20 w-auto mx-auto mb-6" />
          <h1 className="text-3xl font-display font-black text-white mb-2">Bienvenido</h1>
          <p className="text-slate-400">Ingresa a tu cuenta de Studio Manager</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Email</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">mail</span>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-background-dark border border-white/5 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="tu@email.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Contraseña</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">lock</span>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-background-dark border border-white/5 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-400 text-sm">
              <span className="material-symbols-outlined text-red-500">error</span>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl transition-all shadow-xl shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
          >
            {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
          </button>
        </form>

        <div className="mt-10 text-center">
            <p className="text-sm text-slate-500">
                ¿Problemas para acceder? <br />
                <span className="text-primary font-bold">Contacta a soporte técnico</span>
            </p>
        </div>
      </div>
    </div>
  );
}
