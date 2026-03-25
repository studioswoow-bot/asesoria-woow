"use client";

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import LoadingScreen from "@/components/common/LoadingScreen";

interface ModelData {
  name: string;
  nickname?: string;
  status: string;
  category?: string;
  age?: string;
  experience?: string;
}

function ProfileContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [model, setModel] = useState<ModelData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchModel() {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, "models", id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as ModelData;
          // Verificar que la modelo esté activa (7288e)
          const s = (data.status || "").toLowerCase();
          const isActive = s === "active" || s === "activa" || s === "activo" || s === "online";
          
          if (isActive) {
            setModel(data);
          } else {
            console.warn("La modelo existe pero no está activa en el estudio.");
            setModel(null);
          }
        }
      } catch (error) {
        console.error("Error fetching model:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchModel();
  }, [id]);

  if (loading) {
    return <LoadingScreen message="Cargando perfil premium..." />;
  }

  if (!id || !model) {
    return (
      <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-3xl text-center">
        <h2 className="text-xl font-bold text-red-500">Modelo no encontrada</h2>
        <p className="text-slate-400 mt-2">El ID especificado no existe o no se proporcionó.</p>
        <Link href="/" className="inline-block mt-6 px-6 py-2 bg-primary text-white rounded-xl font-bold">Volver al Dashboard</Link>
      </div>
    );
  }

  const initials = model.name.split(" ").map(n => n[0]).join("").substring(0, 2);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Premium Header */}
      <div className="relative overflow-hidden bg-sidebar-dark rounded-[2.5rem] border border-primary/20 p-10 shadow-2xl">
        <div className="absolute top-0 right-0 p-8">
            <Link href={`/models/edit?id=${id}`} className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 hover:border-primary/50 text-white rounded-2xl text-sm font-bold transition-all">
                <span className="material-symbols-outlined text-sm text-primary">edit</span>
                Editar Perfil
            </Link>
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
          <div className="relative">
            <div className="size-40 rounded-full bg-gradient-to-tr from-primary via-accent-gold to-amber-200 p-1 shadow-2xl shadow-primary/20">
              <div className="size-full rounded-full bg-sidebar-dark flex items-center justify-center text-5xl font-black text-primary border-4 border-sidebar-dark overflow-hidden">
                {initials}
              </div>
            </div>
            <div className="absolute -bottom-2 right-4 px-4 py-1.5 bg-green-500 text-white text-[10px] font-black rounded-full border-4 border-sidebar-dark shadow-xl">
              ACTIVA
            </div>
          </div>

          <div className="text-center md:text-left space-y-4">
            <div>
                <span className="text-[10px] font-black text-primary bg-primary/10 px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">PERFIL VERIFICADO</span>
                <h1 className="text-5xl font-black text-white leading-tight">
                    {model.name}
                </h1>
                <p className="text-slate-400 text-xl font-medium mt-1 italic">
                    @{model.nickname || "sin_apodo"}
                </p>
            </div>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
                <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-0.5">Categoría</p>
                    <p className="text-sm text-white font-bold">{model.category || "General"}</p>
                </div>
                <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-0.5">ID Sistema</p>
                    <p className="text-sm text-white font-mono">{id.substring(0, 8)}</p>
                </div>
                <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-0.5">Ubicación</p>
                    <p className="text-sm text-white font-bold">Estudio Principal</p>
                </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
            <div className="bg-sidebar-dark/40 rounded-3xl border border-primary/10 p-8">
                <h3 className="text-white font-bold text-xl mb-6">Información de transmisión</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10">
                        <span className="material-symbols-outlined text-primary mb-3">schedule</span>
                        <p className="text-slate-500 text-xs font-bold uppercase">Turno Actual</p>
                        <p className="text-white font-bold">Tarde (2pm - 10pm)</p>
                    </div>
                    <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10">
                        <span className="material-symbols-outlined text-primary mb-3">star</span>
                        <p className="text-slate-500 text-xs font-bold uppercase">Calificación AI</p>
                        <p className="text-white font-bold">4.8 / 5.0</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <Link href={`/models/analytics?id=${id}`} className="bg-gradient-to-br from-primary to-accent-gold p-8 rounded-3xl group hover:scale-[1.01] transition-all shadow-xl shadow-primary/10 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="size-16 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md group-hover:rotate-6 transition-transform">
                            <span className="material-symbols-outlined text-white text-3xl">monitoring</span>
                        </div>
                        <div>
                            <h4 className="text-white font-black text-2xl">Analytics & Insights</h4>
                            <p className="text-white/70 text-sm font-bold uppercase tracking-wider">Ver métricas de rendimiento en vivo</p>
                        </div>
                    </div>
                    <span className="material-symbols-outlined text-white text-4xl opacity-50 group-hover:translate-x-2 transition-transform">chevron_right</span>
                </Link>
            </div>
        </div>

        <div className="space-y-8">
             <div className="bg-sidebar-dark/80 rounded-3xl border border-primary/20 p-8 shadow-xl">
                <h4 className="text-primary font-black text-xs uppercase tracking-widest mb-6">Próximo Plan de Acción</h4>
                <div className="space-y-4">
                    <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20">
                        <p className="text-white text-sm font-bold">Optimización de Tips</p>
                        <p className="text-xs text-slate-400 mt-1">Meta: +20% ingresos en semana 1</p>
                    </div>
                    <Link href="/action-plans" className="block text-center py-3 bg-primary/20 hover:bg-primary/30 text-primary rounded-xl text-xs font-black uppercase transition-all">
                        Gestión de planes
                    </Link>
                </div>
             </div>
        </div>
      </div>
    </div>
  );
}

export default function ModelProfile() {
  return (
    <Suspense fallback={<LoadingScreen message="Iniciando interfaz..." />}>
      <ProfileContent />
    </Suspense>
  );
}
