"use client";

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import LoadingScreen from "@/components/common/LoadingScreen";
import { calculateWooWRating, WooWRatingResult } from "@/lib/ratingAlgorithm";
import { ActionPlan } from '@/context/ActionPlanContext';

interface ModelData {
  id: string;
  name: string;
  nickname?: string;
  status: string;
  category?: string;
  age?: string;
  experience?: string;
  shift?: string;
  progress?: number;
  artisticName?: string;
}

function ProfileContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [model, setModel] = useState<ModelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [woowRating, setWoowRating] = useState<WooWRatingResult | null>(null);

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
          const baseData = docSnap.data();
          
          // Buscar perfil extendido V2
          const profileRef = doc(db, "modelos_profile_v2", id);
          const profileSnap = await getDoc(profileRef);
          const profileData = profileSnap.exists() ? profileSnap.data() : {};

          const data = {
            ...baseData,
            ...profileData,
            id: id,
            name: baseData.name, // Asegurar que usamos el nombre real si existe
            artisticName: profileData.generalInfo?.artisticName || baseData.nickname || baseData.name
          } as ModelData;

          // Verificar que la modelo esté activa (7288e)
          const s = (data.status || "").toLowerCase();
          const isActive = s === "active" || s === "activa" || s === "activo" || s === "online";
          
          if (isActive) {
            setModel(data);
          } else {
            console.warn("La modelo existe pero no está activa en el estudio.");
            setModel(data); // Aún así mostrarla pero con aviso? El usuario pidió que funcione.
          }

          // ===== MOTOR DE CALIFICACIÓN WOOW =====
          try {
             // Obtener los 2 últimos planes de acción para calcular evolución y rendimiento
             const qPlans = query(
                collection(db, "modelos_action_plans_v2"), 
                where("modelId", "==", id),
                orderBy("createdAt", "desc"),
                limit(2)
             );
             const snapPlans = await getDocs(qPlans);
             const planes = snapPlans.docs.map(d => ({id: d.id, ...d.data()}) as ActionPlan);
             
             const currentPlan = planes.length > 0 ? planes[0] : undefined;
             const previousPlan = planes.length > 1 ? planes[1] : undefined;

             let maxStudioICR = 0;
             if (currentPlan) {
                // Para el Pilar A Relativo, necesitamos el máximo ICR del estudio en el mismo periodo
                const qGlobal = query(
                  collection(db, "modelos_action_plans_v2"),
                  where("period", "==", currentPlan.period)
                );
                const snapGlobal = await getDocs(qGlobal);
                const globalPlans = snapGlobal.docs.map(d => d.data() as ActionPlan);
                
                globalPlans.forEach(p => {
                  const totalTokens = p.dailyTracking?.reduce((acc, curr) => acc + (curr.tokens || 0), 0) || 0;
                  const totalPlanned = p.dailyTracking?.reduce((acc, curr) => acc + (curr.plannedHours || 0), 0) || 0;
                  if (totalPlanned > 0) {
                    const icr = totalTokens / totalPlanned;
                    if (icr > maxStudioICR) maxStudioICR = icr;
                  }
                });
             }

             const rating = calculateWooWRating(data.progress || 0, currentPlan, previousPlan, maxStudioICR);
             setWoowRating(rating);
          } catch (err) {
             console.error("Error al calcular Calificación WooW:", err);
             // Default pre-cálculo si falla la base de métricas
             setWoowRating(calculateWooWRating(data.progress || 0));
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
        <p className="text-text-muted mt-2">El ID especificado no existe o no se proporcionó.</p>
        <Link href="/" className="inline-block mt-6 px-6 py-2 bg-primary text-white rounded-xl font-bold">Volver al Dashboard</Link>
      </div>
    );
  }

  const initials = model.name.split(" ").map(n => n[0]).join("").substring(0, 2);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Premium Header */}
      <div className="relative overflow-hidden bg-panel-dark rounded-[2.5rem] border border-text-main/10 p-10 shadow-2xl transition-colors duration-300">
        <div className="absolute top-0 right-0 p-8 z-[100]">
            <Link 
              href={`/models/edit?id=${id}`} 
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-primary/20 backdrop-blur-md cursor-pointer z-[100]"
            >
                <span className="material-symbols-outlined text-sm">edit_note</span>
                Completar Perfil
            </Link>
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
          <div className="relative">
            <div className="size-40 rounded-full bg-gradient-to-tr from-primary via-accent-gold to-amber-200 p-1 shadow-2xl shadow-primary/20">
              <div className="size-full rounded-full bg-panel-dark flex items-center justify-center text-5xl font-black text-primary border-4 border-panel-dark overflow-hidden">
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
                <h1 className="text-5xl font-black text-text-main leading-tight">
                    {model.artisticName}
                </h1>
                <p className="text-text-muted text-xl font-medium mt-1 italic">
                    Nombre real: {model.name}
                </p>
            </div>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
                <div className="px-4 py-2 bg-text-main/5 rounded-xl border border-text-main/5">
                    <p className="text-[10px] text-text-muted font-bold uppercase mb-0.5">Categoría</p>
                    <p className="text-sm text-text-main font-bold">{model.category || "General"}</p>
                </div>
                <div className="px-4 py-2 bg-text-main/5 rounded-xl border border-text-main/5">
                    <p className="text-[10px] text-text-muted font-bold uppercase mb-0.5">ID Sistema</p>
                    <p className="text-sm text-text-main font-mono">{id.substring(0, 8)}</p>
                </div>
                <div className="px-4 py-2 bg-text-main/5 rounded-xl border border-text-main/5">
                    <p className="text-[10px] text-text-muted font-bold uppercase mb-0.5">Ubicación</p>
                    <p className="text-sm text-text-main font-bold">Estudio Principal</p>
                </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
            <div className="bg-panel-dark/40 rounded-3xl border border-text-main/10 p-8 shadow-xl">
                <h3 className="text-text-main font-bold text-xl mb-6">Información de transmisión</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10 transition-all hover:bg-primary/10 relative overflow-hidden">
                        <span className="material-symbols-outlined text-primary mb-3">schedule</span>
                        <p className="text-text-muted text-xs font-bold uppercase tracking-widest">Turno Registrado</p>
                        <p className="text-text-main font-black text-xl capitalize mt-1">{model.shift || "No asignado"}</p>
                        <p className="text-[10px] text-text-muted mt-2">Horario base del estudio</p>
                    </div>
                    {woowRating ? (
                      <div className="p-6 bg-gradient-to-br from-primary/10 to-accent-gold/5 rounded-2xl border border-primary/20 transition-all hover:bg-primary/10 relative overflow-hidden group">
                          <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                             <span className="material-symbols-outlined text-9xl">magic_button</span>
                          </div>
                          <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="material-symbols-outlined text-accent-gold">stars</span>
                              <p className="text-accent-gold text-xs font-black uppercase tracking-widest">Calificación WooW</p>
                            </div>
                             <div className="flex items-baseline gap-2">
                                <p className="text-text-main font-black text-4xl">{woowRating.calificacionFinal.toFixed(1)}</p>
                                <p className="text-text-muted font-bold text-sm">/ 5.0</p>
                             </div>
                             <div className="w-full bg-text-main/10 h-1.5 rounded-full mt-3 overflow-hidden">
                                <div className="bg-accent-gold h-full rounded-full" style={{ width: `${woowRating.puntajeTotal}%` }}></div>
                             </div>
                             <p className="text-[10px] text-text-muted mt-2 flex items-center gap-1 font-bold">
                                <span className="text-text-main">{woowRating.puntajeTotal}</span> Pts Totales • Motor AI Evaluador
                             </p>
                          </div>
                      </div>
                    ) : (
                      <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10 transition-all hover:bg-primary/10">
                          <span className="material-symbols-outlined text-accent-gold mb-3">star</span>
                          <p className="text-text-muted text-xs font-bold uppercase tracking-widest">Calificación Pre-WooW</p>
                          <p className="text-text-main font-black text-lg">{(Math.max(1, ((model.progress || 0) / 100) * 5)).toFixed(1)} / 5.0</p>
                      </div>
                    )}
                </div>
            </div>

            {/* SECCIÓN NUEVA: BOLETÍN DE NOTAS ACLARATORIAS */}
            {woowRating && (
               <div className="bg-panel-dark rounded-3xl border border-text-main/10 p-8 shadow-xl animate-in slide-in-from-bottom-4 duration-500 delay-150">
                  <div className="flex items-center gap-3 mb-6">
                     <span className="material-symbols-outlined text-primary text-2xl">analytics</span>
                     <div>
                       <h3 className="text-text-main font-bold text-xl">Boletín de Notas Transparente</h3>
                       <p className="text-text-muted text-xs">Desglose exacto de tu calificación para que sepas dónde mejorar.</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                     <div className="p-4 bg-text-main/5 border border-text-main/10 rounded-xl">
                        <div className="flex justify-between items-start mb-2">
                           <p className="text-[10px] text-text-muted font-black uppercase tracking-widest">Rendimiento ICR</p>
                           <span className="text-primary font-black text-sm">{woowRating.scoreA_ICR} / 40</span>
                        </div>
                        <p className="text-[10px] text-text-muted">Producción Real vs. Meta (TPH + Disciplina)</p>
                     </div>
                     
                     <div className="p-4 bg-text-main/5 border border-text-main/10 rounded-xl">
                        <div className="flex justify-between items-start mb-2">
                           <p className="text-[10px] text-text-muted font-black uppercase tracking-widest">Evolución Estratégica</p>
                           <span className="text-accent-gold font-black text-sm">{woowRating.scoreB_Evolucion} / 30</span>
                        </div>
                        <p className="text-[10px] text-text-muted">Manejo de Planes de Trabajo y Mejora (Δ)</p>
                     </div>

                     <div className="p-4 bg-text-main/5 border border-text-main/10 rounded-xl">
                        <div className="flex justify-between items-start mb-2">
                           <p className="text-[10px] text-text-muted font-black uppercase tracking-widest">Nivel Relativo (Z-Score)</p>
                           <span className="text-emerald-500 font-black text-sm">{woowRating.scoreC_ZScore} / 20</span>
                        </div>
                        <p className="text-[10px] text-text-muted">Tu potencia comparada con el promedio del estudio</p>
                     </div>

                      <Link 
                        href={`/models/edit?id=${id}`}
                        className="p-4 bg-text-main/5 border border-text-main/10 rounded-xl hover:border-blue-500/50 transition-all group/card block"
                      >
                         <div className="flex justify-between items-start mb-2">
                            <p className="text-[10px] text-text-muted font-black uppercase tracking-widest">Vitrina / Perfil</p>
                            <div className="flex items-center gap-2">
                               <span className="text-blue-500 font-black text-sm">{woowRating.scoreD_Perfil} / 10</span>
                               <span className="material-symbols-outlined text-xs text-text-muted group-hover/card:text-blue-400">edit</span>
                            </div>
                         </div>
                         <p className="text-[10px] text-text-muted">Completitud del perfil de modelo (Progress V2)</p>
                      </Link>
                  </div>

                  <div className="p-4 bg-primary/10 border-l-4 border-primary rounded-r-xl">
                     <div className="flex gap-3">
                        <span className="material-symbols-outlined text-primary shrink-0">lightbulb</span>
                        <div>
                           <p className="text-xs text-primary font-black uppercase mb-1">Tip de Mejora WooW</p>
                           <p className="text-sm text-text-main font-medium leading-relaxed">{woowRating.tip}</p>
                        </div>
                     </div>
                  </div>
               </div>
            )}

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
              <div className="bg-panel-dark rounded-3xl border border-text-main/10 p-8 shadow-xl">
                 <h4 className="text-primary font-black text-xs uppercase tracking-widest mb-6">Plan de Trabajo Activo</h4>
                 <div className="space-y-4">
                     <div className="p-5 bg-gradient-to-br from-primary/20 to-transparent rounded-2xl border border-text-main/10">
                         <p className="text-text-main text-sm font-black mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px]">verified</span>
                            Plan Nivel Élite
                         </p>
                         <p className="text-[10px] text-text-muted leading-relaxed">Este perfil está siendo optimizado automáticamente por el motor AI de WooW Estudios para maximizar el billing.</p>
                         <div className="mt-4 pt-4 border-t border-text-main/10 space-y-2">
                            <div className="flex justify-between text-[9px] font-bold">
                               <span className="text-text-muted">Métricas Semanales</span>
                               <span className="text-green-400">En curso</span>
                            </div>
                            <div className="h-1.5 w-full bg-text-main/5 rounded-full overflow-hidden">
                               <div className="h-full bg-primary w-[65%] rounded-full shadow-lg shadow-primary/20"></div>
                            </div>
                         </div>
                     </div>
                     <Link href={`/action-plans?modelId=${id}`} className="block text-center py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.05] shadow-lg shadow-primary/20">
                         Gestionar Planes
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
