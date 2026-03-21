"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useActionPlans, ActionPlan, DailyTracking } from "@/context/ActionPlanContext";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, where, limit, orderBy } from "firebase/firestore";
import LoadingScreen from "@/components/common/LoadingScreen";

interface ModelOption {
  id: string;
  name: string;
  nickname?: string;
  status: string;
}

export default function ActionPlansPage() {
  type ViewType = 'list' | 'create' | 'detail';
  const { plans, addPlan, updatePlan, deletePlan, loading: contextLoading } = useActionPlans();
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [view, setView] = useState<ViewType>('list');
  const [searchTerm, setSearchTerm] = useState("");
  
  // Form State
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [goals, setGoals] = useState({ tpm: 0, icj: 0, icr: 0, zscore: 0 });
  const [dailyData, setDailyData] = useState<DailyTracking[]>([]);
  const [fetchingMetrics, setFetchingMetrics] = useState(false);

  // Auto-calculate periodEnd (14 days after periodStart)
  useEffect(() => {
    if (periodStart) {
      const start = new Date(periodStart);
      const end = new Date(start);
      end.setDate(start.getDate() + 13); // 14 days including start
      setPeriodEnd(end.toISOString().split('T')[0]);
    }
  }, [periodStart]);

  // Load models on mount
  useEffect(() => {
    async function fetchModels() {
      try {
        const q = query(collection(db, "models"));
        const snapshot = await getDocs(q);
        const modelList = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          nickname: doc.data().nickname,
          status: doc.data().status
        }));
        setModels(modelList);
      } catch (error) {
        console.error("Error fetching models:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchModels();
  }, []);

  // Fetch real-time metrics when model and period are selected via secure API — FIX #3, #6
  const autoFetchMetrics = async () => {
    if (!selectedModelId || !periodStart || !periodEnd) return;
    
    const selectedModel = models.find(m => m.id === selectedModelId);
    if (!selectedModel?.nickname) {
      alert("La modelo seleccionada no tiene un apodo (nickname) configurado.");
      return;
    }

    setFetchingMetrics(true);
    try {
      const { auth } = await import("@/lib/firebase");
      const token = await auth.currentUser?.getIdToken();
      
      const response = await fetch(
        `/api/action-plans/metrics?modelId=${selectedModelId}&start=${periodStart}&end=${periodEnd}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.statusText}`);
      }

      const { data } = await response.json();
      
      // Merge results with existing manual entries (plannedHours, comments)
      const newDailyData: DailyTracking[] = data.map((day: any) => {
        const existingDay = dailyData.find(d => d.date === day.date);
        return {
          ...day,
          plannedHours: existingDay ? existingDay.plannedHours : 6,
          comments: existingDay ? existingDay.comments : ""
        };
      });

      setDailyData(newDailyData);
      
      // Update goals base metrics
      const totalTokens = newDailyData.reduce((acc, curr) => acc + curr.tokens, 0);
      const totalHours = newDailyData.reduce((acc, curr) => acc + curr.hours, 0);
      const avgTpm = totalHours > 0 ? totalTokens / (totalHours * 60) : 0;
      
      setGoals(prev => ({
        ...prev,
        tpm: Number(avgTpm.toFixed(2))
      }));

    } catch (error: any) {
      console.error("Error fetching metrics:", error);
      alert(`Error al sincronizar datos: ${error.message}`);
    } finally {
      setFetchingMetrics(false);
    }
  };

  const selectedModelName = useMemo(() => {
    const m = models.find(m => m.id === selectedModelId);
    return m ? (m.nickname || m.name) : "";
  }, [selectedModelId, models]);

  const filteredPlans = useMemo(() => {
    return plans.filter(p => 
      p.modelName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [plans, searchTerm]);

  // Form State for Strategic Actions
  const [strategicA, setStrategicA] = useState<string[]>([""]);
  const [strategicB, setStrategicB] = useState<string[]>([""]);
  const [strategicC, setStrategicC] = useState<string[]>([""]);

  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);

  const handleOpenPlan = (plan: ActionPlan) => {
    setCurrentPlanId(plan.id);
    setSelectedModelId(plan.modelId);
    const [start, end] = plan.period.split(" a ");
    setPeriodStart(start);
    setPeriodEnd(end);
    setGoals(plan.goals);
    setDailyData(plan.dailyTracking);
    setStrategicA(plan.strategicTasks.categoryA.length > 0 ? plan.strategicTasks.categoryA : [""]);
    setStrategicB(plan.strategicTasks.categoryB.length > 0 ? plan.strategicTasks.categoryB : [""]);
    setStrategicC(plan.strategicTasks.categoryC.length > 0 ? plan.strategicTasks.categoryC : [""]);
    setView('detail');
  };

  const handleCreateNew = () => {
    setCurrentPlanId(null);
    setSelectedModelId("");
    setPeriodStart("");
    setPeriodEnd("");
    setGoals({ tpm: 0, icj: 100, icr: 0, zscore: 0 });
    setDailyData([]);
    setStrategicA([""]);
    setStrategicB([""]);
    setStrategicC([""]);
    setView('create');
  };

  const handleSave = async () => {
    if (!selectedModelId || !periodStart) return;

    const planData: Omit<ActionPlan, 'id'> = {
      modelId: selectedModelId,
      modelName: selectedModelName,
      period: `${periodStart} a ${periodEnd}`,
      status: 'active',
      goals: goals,
      dailyTracking: dailyData,
      weeklySummaries: { week1: "", week2: "" },
      strategicTasks: {
        categoryA: strategicA.filter(t => t.trim() !== ""),
        categoryB: strategicB.filter(t => t.trim() !== ""),
        categoryC: strategicC.filter(t => t.trim() !== ""),
      },
      evaluation: "",
      createdAt: new Date().toISOString()
    };

    try {
      if (view === 'detail' && currentPlanId) {
        await updatePlan(currentPlanId, planData);
      } else {
        await addPlan({ id: "", ...planData });
      }
      setView('list');
    } catch (error) {
      alert("Error al procesar el plan en Firebase. Inténtalo de nuevo.");
    }
  };

  const handleDeletePlan = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("¿Estás seguro de que deseas eliminar este plan de trabajo? Esta acción no se puede deshacer.")) {
      try {
        await deletePlan(id);
      } catch (error) {
        alert("Error al eliminar el plan.");
      }
    }
  };

  if (loading || contextLoading) {
    return <LoadingScreen message="Sincronizando planes con Estudios WooW Cloud..." />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-4xl">insights</span>
            {view === 'list' ? 'Planes de Acción y Seguimiento' : view === 'create' ? 'Crear Nuevo Plan' : `Plan: ${selectedModelName}`}
          </h1>
          <p className="text-slate-400 mt-1">
            {view === 'list' 
              ? 'Generación de estrategias y monitoreo de indicadores en tiempo real.' 
              : `Seguimiento quincenal para el periodo ${periodStart} al ${periodEnd}`}
          </p>
        </div>
        
        {view === 'list' && (
          <button 
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-all shadow-lg shadow-primary/20"
          >
            <span className="material-symbols-outlined">add_circle</span>
            Nuevo Plan de Trabajo
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 gap-6">
        {view === 'list' && (
          <div className="space-y-6">
            <div className="relative group max-w-md">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">search</span>
              <input 
                type="text" 
                placeholder="Buscar por apodo de modelo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-primary/50 transition-all focus:ring-4 focus:ring-primary/5 shadow-xl"
              />
            </div>

            {filteredPlans.length === 0 ? (
             <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
               <div className="size-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                 <span className="material-symbols-outlined text-primary text-3xl">folder_open</span>
               </div>
               <h3 className="text-xl font-bold text-white mb-2">No hay planes activos</h3>
               <p className="text-slate-400 max-w-md mx-auto mb-6">Comienza creando un nuevo plan de acción para una modelo para empezar a trackear su rendimiento.</p>
               <button 
                 onClick={handleCreateNew}
                 className="text-primary font-bold hover:underline"
               >
                 Crear primer plan ahora
               </button>
             </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPlans.map(plan => (
                  <div 
                   key={plan.id} 
                   onClick={() => handleOpenPlan(plan)}
                   className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-primary/50 transition-all cursor-pointer group relative"
                  >
                     <div className="flex justify-between items-start mb-4">
                       <div className="size-10 bg-primary/20 rounded-lg flex items-center justify-center text-primary">
                         <span className="material-symbols-outlined">person</span>
                       </div>
                       <div className="flex items-center gap-2">
                         <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${plan.status === 'active' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-500/20 text-slate-500'}`}>
                           {plan.status === 'active' ? 'Activo' : 'Completado'}
                         </span>
                         <button 
                           onClick={(e) => handleDeletePlan(e, plan.id)}
                           className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                           title="Eliminar Plan"
                         >
                           <span className="material-symbols-outlined text-[18px]">delete</span>
                         </button>
                       </div>
                     </div>
                     <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">{plan.modelName}</h3>
                     <p className="text-xs text-slate-500 mb-4">{plan.period}</p>
                     <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                       <div>
                         <p className="text-[10px] text-slate-500 uppercase font-bold">Goal TPM</p>
                         <p className="text-sm font-bold text-white">{plan.goals.tpm}</p>
                       </div>
                       <div>
                         <p className="text-[10px] text-slate-500 uppercase font-bold">Goal ICR</p>
                         <p className="text-sm font-bold text-white">{plan.goals.icr}</p>
                       </div>
                     </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(view === 'create' || view === 'detail') && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
             <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-6">
                <button 
                  onClick={() => setView('list')}
                  className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined">arrow_back</span>
                  {view === 'detail' ? 'Volver al listado' : 'Cancelar y volver'}
                </button>
                <div className="flex gap-3">
                  {(view === 'create' || view === 'detail') && (
                    <button 
                      onClick={autoFetchMetrics}
                      disabled={!selectedModelId || !periodStart || fetchingMetrics}
                      className="flex items-center gap-2 px-4 py-2 bg-accent-gold/10 text-accent-gold border border-accent-gold/20 font-bold rounded-lg hover:bg-accent-gold/20 transition-all disabled:opacity-50"
                    >
                      <span className={`material-symbols-outlined ${fetchingMetrics ? 'animate-spin' : ''}`}>sync</span>
                      {fetchingMetrics ? 'Sincronizando...' : 'Sincronizar Datos'}
                    </button>
                  )}
                  <button 
                    onClick={handleSave}
                    disabled={!selectedModelId || dailyData.length === 0}
                    className="flex items-center gap-2 px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined">save</span>
                    {view === 'detail' ? 'Actualizar Plan' : 'Guardar Plan'}
                  </button>
                </div>
             </div>

             {/* Form Sections */}
             <div className="space-y-6">
                {/* 1. Información General */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                  <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
                    <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white text-sm font-bold">1</span>
                    <h2 className="text-xl font-bold text-white">Información del Plan</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-400">modelo</label>
                      <select 
                        value={selectedModelId}
                        onChange={(e) => setSelectedModelId(e.target.value)}
                        disabled={view === 'detail'}
                        className="w-full bg-slate-800 border-white/10 rounded-xl p-3 text-white focus:ring-primary focus:border-primary disabled:opacity-70"
                      >
                        <option value="">Seleccionar modelo...</option>
                        {models.map(m => (
                          <option key={m.id} value={m.id}>{m.nickname || m.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-400">Inicio de Periodo</label>
                      <input 
                        type="date"
                        value={periodStart}
                        onChange={(e) => setPeriodStart(e.target.value)}
                        disabled={view === 'detail'}
                        className="w-full bg-slate-800 border-white/10 rounded-xl p-3 text-white disabled:opacity-70"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-400">Fin de Periodo</label>
                      <input 
                        type="date"
                        value={periodEnd}
                        onChange={(e) => setPeriodEnd(e.target.value)}
                        className="w-full bg-slate-800 border-white/10 rounded-xl p-3 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-400">Nivel</label>
                      <select className="w-full bg-slate-800 border-white/10 rounded-xl p-3 text-white">
                        <option>Junior</option>
                        <option>Intermedio</option>
                        <option>Top</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Metas Quincenales */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                  <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
                    <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white text-sm font-bold">2</span>
                    <h2 className="text-xl font-bold text-white">Metas Numéricas Objetivo</h2>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-center group hover:border-primary/30 transition-all">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-2">TPM Objetivo</p>
                      <input 
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        value={goals.tpm || ""}
                        onChange={(e) => setGoals({ ...goals, tpm: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-transparent text-2xl font-black text-center text-white focus:outline-none"
                      />
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-center group hover:border-primary/30 transition-all">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-2">ICJ % Objetivo</p>
                      <input 
                        type="number"
                        placeholder="0"
                        value={goals.icj || ""}
                        onChange={(e) => setGoals({ ...goals, icj: parseInt(e.target.value) || 0 })}
                        className="w-full bg-transparent text-2xl font-black text-center text-white focus:outline-none"
                      />
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-center group hover:border-primary/30 transition-all">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-2">ICR Objetivo</p>
                      <input 
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        value={goals.icr || ""}
                        onChange={(e) => setGoals({ ...goals, icr: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-transparent text-2xl font-black text-center text-white focus:outline-none"
                      />
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-center group hover:border-primary/30 transition-all">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-2">Z-Score Target</p>
                      <input 
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        value={goals.zscore || ""}
                        onChange={(e) => setGoals({ ...goals, zscore: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-transparent text-2xl font-black text-center text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Tabla Diaria (Núcleo) */}
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="p-8 border-b border-white/10 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white text-sm font-bold">3</span>
                      <h2 className="text-xl font-bold text-white">Tabla Diaria de Seguimiento</h2>
                    </div>
                    <div className="text-xs text-slate-500 font-bold uppercase flex items-center gap-2">
                       <span className="size-2 bg-emerald-500 rounded-full animate-pulse"></span>
                       Datos de Firebase Sincronizados
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10">
                          <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-wider">Fecha / Día</th>
                          <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-wider">Planteado (H)</th>
                          <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-wider text-primary">Real (H)</th>
                          <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-wider">ICJ %</th>
                          <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-wider text-primary">Tokens</th>
                          <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-wider">TPM</th>
                          <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-wider">ICR</th>
                          <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-wider">Comentarios</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {dailyData.length > 0 ? dailyData.map((day) => (
                          <tr key={day.day} className="hover:bg-white/5 transition-colors">
                            <td className="py-4 px-6">
                              <p className="text-sm font-bold text-white">{day.date}</p>
                              <p className="text-[10px] text-slate-500 uppercase">Día {day.day}</p>
                            </td>
                            <td className="py-4 px-6">
                              <input 
                                type="number" 
                                value={day.plannedHours} 
                                onChange={(e) => {
                                  const newData = [...dailyData];
                                  newData[day.day - 1].plannedHours = parseFloat(e.target.value) || 0;
                                  setDailyData(newData);
                                }}
                                className="w-12 bg-white/5 border border-white/10 rounded p-1 text-center text-sm" 
                              />
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-sm font-bold text-primary">{day.hours}h</span>
                            </td>
                            <td className="py-4 px-6">
                              <span className={`text-sm font-bold ${(day.hours / (day.plannedHours || 1) * 100) >= 100 ? 'text-emerald-500' : 'text-slate-400'}`}>
                                {Math.round(day.hours / (day.plannedHours || 1) * 100)}%
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-sm font-bold text-primary">{day.tokens.toLocaleString()}</span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-sm font-bold text-white">{(day.tokens / (day.hours * 60 || 1)).toFixed(2)}</span>
                            </td>
                            <td className="py-4 px-6 text-sm font-bold text-white">
                              {((day.tokens / (day.hours * 60 || 1)) * (day.hours / (day.plannedHours || 1))).toFixed(2)}
                            </td>
                            <td className="py-4 px-6">
                              <input 
                                type="text" 
                                placeholder="Añadir nota..." 
                                value={day.comments}
                                onChange={(e) => {
                                  const newData = [...dailyData];
                                  newData[day.day - 1].comments = e.target.value;
                                  setDailyData(newData);
                                }}
                                className="bg-transparent border-b border-white/10 focus:border-primary text-sm w-full outline-none py-1" 
                              />
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={8} className="py-20 text-center">
                              <p className="text-slate-500 italic">Selecciona modelo y periodo, luego haz clic en "Sincronizar Datos"</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. Plan de Acción Estratégico */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                  <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
                    <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white text-sm font-bold">4</span>
                    <h2 className="text-xl font-bold text-white">Plan de Acción Estratégico</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Categoría A */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-accent-gold">
                        <span className="material-symbols-outlined">trending_up</span>
                        <h3 className="font-bold uppercase text-xs tracking-wider">Mejorar TPM (Calidad)</h3>
                      </div>
                      {strategicA.map((task, idx) => (
                        <input 
                          key={idx}
                          value={task}
                          onChange={(e) => {
                            const newTasks = [...strategicA];
                            newTasks[idx] = e.target.value;
                            setStrategicA(newTasks);
                          }}
                          placeholder="Ej: Nuevos lencería, mejorar luces..."
                          className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-primary outline-none"
                        />
                      ))}
                      <button 
                        onClick={() => setStrategicA([...strategicA, ""])}
                        className="text-[10px] text-slate-500 hover:text-primary font-bold uppercase"
                      >
                        + Añadir Acción
                      </button>
                    </div>

                    {/* Categoría B */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-emerald-500">
                        <span className="material-symbols-outlined">schedule</span>
                        <h3 className="font-bold uppercase text-xs tracking-wider">Mejorar ICJ (Disciplina)</h3>
                      </div>
                      {strategicB.map((task, idx) => (
                        <input 
                          key={idx}
                          value={task}
                          onChange={(e) => {
                            const newTasks = [...strategicB];
                            newTasks[idx] = e.target.value;
                            setStrategicB(newTasks);
                          }}
                          placeholder="Ej: Puntualidad, reducir pausas..."
                          className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-primary outline-none"
                        />
                      ))}
                      <button 
                        onClick={() => setStrategicB([...strategicB, ""])}
                        className="text-[10px] text-slate-500 hover:text-primary font-bold uppercase"
                      >
                        + Añadir Acción
                      </button>
                    </div>

                    {/* Categoría C */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-primary">
                        <span className="material-symbols-outlined">star</span>
                        <h3 className="font-bold uppercase text-xs tracking-wider">Estrategias Top (Retención)</h3>
                      </div>
                      {strategicC.map((task, idx) => (
                        <input 
                          key={idx}
                          value={task}
                          onChange={(e) => {
                            const newTasks = [...strategicC];
                            newTasks[idx] = e.target.value;
                            setStrategicC(newTasks);
                          }}
                          placeholder="Ej: Juegos con usuarios, metas privadas..."
                          className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-primary outline-none"
                        />
                      ))}
                      <button 
                        onClick={() => setStrategicC([...strategicC, ""])}
                        className="text-[10px] text-slate-500 hover:text-primary font-bold uppercase"
                      >
                        + Añadir Acción
                      </button>
                    </div>
                  </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
