"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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

function ActionPlansContent() {
  type ViewType = 'list' | 'create' | 'detail';
  const searchParams = useSearchParams();
  const urlModelId = searchParams.get('modelId');
  const { plans, addPlan, updatePlan, deletePlan, loading: contextLoading } = useActionPlans();
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [view, setView] = useState<ViewType>('list');
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Form State
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [goals, setGoals] = useState({ tph: 0, icj: 0, icr: 0, zscore: 0 });
  const [dailyData, setDailyData] = useState<DailyTracking[]>([]);
  const [fetchingMetrics, setFetchingMetrics] = useState(false);

  // New Management Sections state
  const [weeklySummaries, setWeeklySummaries] = useState({
    week1: { analysis: "", status: "" as any },
    week2: { analysis: "", status: "" as any }
  });
  const [evaluation, setEvaluation] = useState({
    globalResult: "" as any,
    decisions: [] as string[],
    finalComments: ""
  });

  // Rank Positioning State
  const [rankPositioning, setRankPositioning] = useState({
    chaturbate: { activeViewersTarget: 0, tippingDensityTarget: 0, newFollowersTarget: 0, streamStabilityHours: 4 },
    stripchat: { averageViewersTarget: 0, tokensPer15Min: 0, followerBaseTarget: 0 },
    actionItems: [""] as string[]
  });

  // Auto-calculate periodEnd (14 days after periodStart) only if not set manually
  useEffect(() => {
    if (periodStart) {
      const start = new Date(periodStart + "T00:00:00");
      if (!isNaN(start.getTime())) {
        const end = new Date(start);
        end.setDate(start.getDate() + 13); // 14 days including start
        const dateStr = end.toISOString().split('T')[0];
        if (periodEnd !== dateStr) {
          setPeriodEnd(dateStr);
        }
      }
    }
  }, [periodStart]); // Only re-run when periodStart changes

  // Auto-calculate ICR Objetivo (TPH * ICJ / 100) -- FIX: AUTOMATICO
  useEffect(() => {
    const calculatedIcr = goals.tph * (goals.icj / 100);
    // Solo actualizamos si el cambio es significativo para evitar renders innecesarios
    if (Math.abs(goals.icr - calculatedIcr) > 0.01) {
      setGoals(prev => ({ ...prev, icr: Number(calculatedIcr.toFixed(2)) }));
    }
  }, [goals.tph, goals.icj]);

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
        
        // Si viene un modelId por URL, buscar si tiene un plan activo o autoseleccionarlo
        if (urlModelId) {
           setSelectedModelId(urlModelId);
           setSearchTerm(modelList.find(m => m.id === urlModelId)?.nickname || "");
        }
      } catch (error) {
        console.error("Error fetching models:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchModels();
  }, [urlModelId]);

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

      const { data, error: apiError } = await response.json();
      
      if (apiError) {
        throw new Error(apiError);
      }
      
      // Merge results with existing manual entries (plannedHours, comments)
      // FIX: Force plannedHours to 0 for holidays/sundays during Sync so that the frontend ICJ matches the strict Backend rule.
      const newDailyData: DailyTracking[] = data.map((day: any) => {
        const existingDay = dailyData.find(d => d.date === day.date);
        
        let forcedHours = 6;
        if (day.isHoliday) {
            forcedHours = 0; // Obligatorio cero por regla de negocio
        } else if (existingDay && existingDay.plannedHours !== undefined) {
            forcedHours = existingDay.plannedHours;
        }

        return {
          ...day,
          plannedHours: forcedHours,
          comments: existingDay ? existingDay.comments : ""
        };
      });

      setDailyData(newDailyData);
      
    } catch (error: any) {
      console.error("Error fetching metrics:", error);
      alert(`Error al sincronizar datos del estudio: ${error.message}`);
    } finally {
      setFetchingMetrics(false);
    }
  };

  const selectedModelName = useMemo(() => {
    const m = models.find(m => m.id === selectedModelId);
    if (!m) return "";
    return m.nickname ? `${m.name} (${m.nickname})` : m.name;
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
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const handleOpenPlan = (plan: ActionPlan) => {
    setCurrentPlanId(plan.id);
    setSelectedModelId(plan.modelId);
    setHistory(plan.history || []);
    const [start, end] = plan.period.split(" a ");
    setPeriodStart(start);
    setPeriodEnd(end);
    setGoals({
      tph: plan.goals.tph || (plan.goals as any).tpm || 0,
      icj: plan.goals.icj,
      icr: plan.goals.icr,
      zscore: plan.goals.zscore
    });
    setDailyData(plan.dailyTracking);
    setStrategicA(plan.strategicTasks.categoryA.length > 0 ? plan.strategicTasks.categoryA : [""]);
    setStrategicB(plan.strategicTasks.categoryB.length > 0 ? plan.strategicTasks.categoryB : [""]);
    setStrategicC(plan.strategicTasks.categoryC.length > 0 ? plan.strategicTasks.categoryC : [""]);
    
    // Load new sections
    setWeeklySummaries(plan.weeklySummaries || {
      week1: { analysis: "", status: "" },
      week2: { analysis: "", status: "" }
    });
    setEvaluation(plan.evaluation || {
      globalResult: "",
      decisions: [],
      finalComments: ""
    });
    setRankPositioning(plan.rankPositioningPlan || {
      chaturbate: { activeViewersTarget: 0, tippingDensityTarget: 0, newFollowersTarget: 0, streamStabilityHours: 4 },
      stripchat: { averageViewersTarget: 0, tokensPer15Min: 0, followerBaseTarget: 0 },
      actionItems: [""]
    });
    setView('detail');
  };

  const handleCreateNew = () => {
    setCurrentPlanId(null);
    setSelectedModelId("");
    setPeriodStart("");
    setPeriodEnd("");
    setGoals({ tph: 0, icj: 100, icr: 0, zscore: 0 });
    setDailyData([]);
    setStrategicA([""]);
    setStrategicB([""]);
    setStrategicC([""]);
    setWeeklySummaries({
      week1: { analysis: "", status: "" },
      week2: { analysis: "", status: "" }
    });
    setEvaluation({
      globalResult: "",
      decisions: [],
      finalComments: ""
    });
    setHistory([]);
    setRankPositioning({
      chaturbate: { activeViewersTarget: 0, tippingDensityTarget: 0, newFollowersTarget: 0, streamStabilityHours: 4 },
      stripchat: { averageViewersTarget: 0, tokensPer15Min: 0, followerBaseTarget: 0 },
      actionItems: [""]
    });
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
      weeklySummaries: weeklySummaries,
      strategicTasks: {
        categoryA: strategicA.filter(t => t.trim() !== ""),
        categoryB: strategicB.filter(t => t.trim() !== ""),
        categoryC: strategicC.filter(t => t.trim() !== ""),
      },
      rankPositioningPlan: {
        chaturbate: rankPositioning.chaturbate,
        stripchat: rankPositioning.stripchat,
        actionItems: rankPositioning.actionItems.filter(t => t.trim() !== ""),
      },
      evaluation: evaluation,
      createdAt: new Date().toISOString()
    };

    try {
      if (view === 'detail' && currentPlanId) {
        await updatePlan(currentPlanId, planData);
      } else {
        await addPlan({ id: "", ...planData });
      }
      setView('list');
    } catch (error: any) {
      console.error("Firebase Save Error:", error);
      alert("Error al procesar el plan en Firebase: " + (error.message || "Error desconocido"));
    }
  };

  const handleDownloadAI = () => {
    if (!selectedModelId || dailyData.length === 0) return;

    const exportData = {
      reportType: "WooW Estudios - Action Plan Report",
      exportDate: new Date().toISOString(),
      model: {
        id: selectedModelId,
        name: selectedModelName,
      },
      period: `${periodStart} a ${periodEnd}`,
      goals: goals,
      performance: {
        totalTokens: dailyData.reduce((acc, curr) => acc + (curr.tokens || 0), 0),
        totalHours: dailyData.reduce((acc, curr) => acc + (curr.hours || 0), 0),
        averageTph: (dailyData.reduce((acc, curr) => acc + (curr.tokens || 0), 0) / (dailyData.reduce((acc, curr) => acc + (curr.hours || 0), 0) || 1)).toFixed(2),
        totalIcj: (() => {
          const totalP = dailyData.reduce((acc, curr) => acc + (curr.plannedHours || 0), 0);
          const totalR = dailyData.reduce((acc, curr) => acc + (curr.hours || 0), 0);
          return totalP > 0 ? (totalR / totalP * 100).toFixed(2) + "%" : "0%";
        })(),
      },
      rankPositioning: rankPositioning,
      strategicTasks: {
        categoryA: strategicA.filter(t => t.trim() !== ""),
        categoryB: strategicB.filter(t => t.trim() !== ""),
        categoryC: strategicC.filter(t => t.trim() !== ""),
      },
      dailyTracking: dailyData.map(d => ({
        ...d,
        icj_percent: d.plannedHours > 0 ? (d.hours / d.plannedHours * 100).toFixed(2) + "%" : "0%",
        tph: d.hours > 0 ? (d.tokens / d.hours).toFixed(2) : 0,
        icr: (d.hours > 0 && d.plannedHours > 0) ? ((d.tokens / d.hours) * (d.hours / d.plannedHours)).toFixed(2) : 0
      })),
      weeklyAnalysis: weeklySummaries,
      finalEvaluation: evaluation
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WooW_Plan_${selectedModelName.replace(/\s+/g, '_')}_${periodStart}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeletePlan = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!id) {
       alert("Error: ID del plan no encontrado.");
       return;
    }
    setShowDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    if (!showDeleteConfirm) return;
    setIsDeleting(true);
    try {
      await deletePlan(showDeleteConfirm);
      setShowDeleteConfirm(null);
      if (view === 'detail') setView('list');
    } catch (error: any) {
      console.error("Delete Error:", error);
      alert("Error al borrar de la base de datos: " + (error.message || "Error desconocido"));
    } finally {
      setIsDeleting(false);
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
          <h1 className="text-3xl font-black tracking-tight text-text-main flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-4xl">insights</span>
            {view === 'list' ? 'Planes de Acción y Seguimiento' : view === 'create' ? 'Crear Nuevo Plan' : `Plan: ${selectedModelName}`}
          </h1>
          <p className="text-text-muted mt-1">
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
                className="w-full bg-text-main/5 border border-text-main/10 rounded-2xl py-3 pl-12 pr-4 text-text-main placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 transition-all focus:ring-4 focus:ring-primary/5 shadow-xl"
              />
            </div>

            {filteredPlans.length === 0 ? (
             <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
               <div className="size-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                 <span className="material-symbols-outlined text-primary text-3xl">folder_open</span>
               </div>
                <h3 className="text-xl font-bold text-text-main mb-2">No hay planes activos</h3>
                <p className="text-text-muted max-w-md mx-auto mb-6">Comienza creando un nuevo plan de acción para una modelo para empezar a trackear su rendimiento.</p>
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
                  <div key={plan.id} className="relative group">
            <div 
                      onClick={() => handleOpenPlan(plan)}
                      className="bg-panel-dark border border-text-main/10 rounded-2xl p-6 hover:border-primary/50 transition-all cursor-pointer h-full shadow-lg"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="size-10 bg-primary/20 rounded-lg flex items-center justify-center text-primary">
                          <span className="material-symbols-outlined">person</span>
                        </div>
                        <div className="flex items-center gap-2 pr-8"> {/* Reserve space for absolute button */}
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${plan.status === 'active' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-500/20 text-slate-500'}`}>
                            {plan.status === 'active' ? 'Activo' : 'Completado'}
                          </span>
                        </div>
                      </div>
                      <h3 className="text-lg font-bold text-text-main group-hover:text-primary transition-colors">{plan.modelName}</h3>
                      <p className="text-xs text-text-muted mb-4">{plan.period}</p>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-text-main/10">
                        <div>
                          <p className="text-[10px] text-text-muted uppercase font-bold">Goal TPH</p>
                          <p className="text-sm font-bold text-text-main">{plan.goals.tph || (plan.goals as any).tpm}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-text-muted uppercase font-bold">Goal ICR</p>
                          <p className="text-sm font-bold text-text-main">{plan.goals.icr}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Delete button positioned absolutely over the card but not as as nested click target in the DOM flow of the card itself */}
                    <button 
                      onClick={(e) => handleDeletePlan(e, plan.id)}
                      style={{ cursor: 'pointer', zIndex: 9999, pointerEvents: 'auto' }}
                      className="absolute top-4 right-4 z-[9999] p-3 text-red-400 hover:text-red-500 hover:bg-red-500/20 rounded-xl transition-all flex items-center justify-center bg-slate-900 border border-red-500/20"
                      title="Eliminar Plan"
                    >
                      <span className="material-symbols-outlined text-[24px] pointer-events-none">delete</span>
                    </button>
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
                  className="flex items-center gap-2 text-text-muted hover:text-text-main transition-colors"
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
                  {view === 'detail' && currentPlanId && (
                    <button 
                      onClick={(e) => handleDeletePlan(e, currentPlanId)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 font-bold rounded-lg hover:bg-red-500/20 transition-all pointer-events-auto cursor-pointer"
                    >
                      <span className="material-symbols-outlined pointer-events-none">delete</span>
                      Eliminar Plan
                    </button>
                  )}
                  <button 
                    onClick={handleDownloadAI}
                    disabled={!selectedModelId || dailyData.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 border border-white/10 font-bold rounded-lg hover:bg-slate-700 transition-all disabled:opacity-50"
                    title="Exportar datos completos para análisis con Inteligencia Artificial"
                  >
                    <span className="material-symbols-outlined">psychology</span>
                    Exportar AI
                  </button>
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

             {/* Audit History Log - Mini Timeline Section */}
             {view === 'detail' && (
                <div className="bg-panel-dark border border-text-main/5 rounded-2xl p-6 backdrop-blur-sm mb-6 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-[10px] font-black text-text-muted uppercase tracking-widest">
                      <span className="material-symbols-outlined text-sm">history</span>
                      Historial de Cambios y Trazabilidad
                    </div>
                  </div>
                  
                  {history.length > 0 ? (
                    <div className="flex flex-wrap gap-4">
                      {history.slice(0, 5).map((entry, idx) => (
                        <div key={idx} className="flex-1 min-w-[200px] p-3 bg-text-main/5 rounded-xl border border-text-main/5 flex items-start gap-3 group animate-in slide-in-from-left duration-300" style={{ animationDelay: `${idx * 100}ms` }}>
                          <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${entry.action === 'create' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary'}`}>
                            <span className="material-symbols-outlined text-sm">{entry.action === 'create' ? 'verified' : 'edit_square'}</span>
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-xs font-bold text-text-main truncate">{entry.userName}</p>
                            <p className="text-[10px] text-text-muted">{new Date(entry.timestamp).toLocaleString()}</p>
                            <p className="text-[10px] text-primary font-medium mt-1 uppercase tracking-tighter bg-primary/5 px-1.5 py-0.5 rounded w-fit italic">
                              {entry.changes || (entry.action === 'create' ? 'Inició Plan' : 'Modificó Plan')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-4 bg-text-main/5 rounded-xl border border-dashed border-text-main/10">
                      <span className="material-symbols-outlined text-text-muted/50">info</span>
                      <p className="text-xs text-text-muted">Este plan no tiene cambios registrados aún. El registro iniciará en la próxima actualización.</p>
                    </div>
                  )}
                </div>
             )}

             {/* Form Sections */}
             <div className="space-y-6">
                {/* 1. Información General */}
                <div className="bg-panel-dark border border-text-main/10 rounded-2xl p-8 shadow-lg">
                  <div className="flex items-center gap-3 mb-8 border-b border-text-main/5 pb-4">
                    <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white text-sm font-bold">1</span>
                    <h2 className="text-xl font-bold text-text-main">Información del Plan</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-text-muted">modelo</label>
                      <select 
                        value={selectedModelId}
                        onChange={(e) => setSelectedModelId(e.target.value)}
                        disabled={view === 'detail'}
                        className="w-full bg-text-main/5 border border-text-main/10 rounded-xl p-3 text-text-main focus:ring-primary focus:border-primary disabled:opacity-70 transition-colors"
                      >
                        <option value="">Seleccionar modelo...</option>
                        {models.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.nickname ? `(${m.nickname})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-text-muted">Inicio de Periodo</label>
                      <input 
                        type="date"
                        value={periodStart}
                        onChange={(e) => setPeriodStart(e.target.value)}
                        disabled={view === 'detail'}
                        className="w-full bg-text-main/5 border border-text-main/10 rounded-xl p-3 text-text-main disabled:opacity-70 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                       <label className="text-sm font-bold text-text-muted">Fin de Periodo</label>
                      <input 
                        type="date"
                        value={periodEnd}
                        onChange={(e) => setPeriodEnd(e.target.value)}
                        className="w-full bg-text-main/5 border border-text-main/10 rounded-xl p-3 text-text-main transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-text-muted">Nivel</label>
                      <select className="w-full bg-text-main/5 border border-text-main/10 rounded-xl p-3 text-text-main transition-colors">
                        <option>Junior</option>
                        <option>Intermedio</option>
                        <option>Top</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Metas Numéricas Objetivo */}
                <div className="bg-panel-dark border border-text-main/10 rounded-2xl p-8 shadow-lg transition-colors">
                  <div className="flex items-center justify-between mb-8 border-b border-text-main/5 pb-4">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white text-sm font-bold">2</span>
                      <h2 className="text-xl font-bold text-text-main">Metas Numéricas Objetivo</h2>
                    </div>
                    <span className="text-[10px] font-bold text-text-muted bg-text-main/5 px-2 py-1 rounded border border-text-main/10 transition-colors">Valores de Referencia Quincenal</span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
                    <div className="p-4 bg-text-main/5 rounded-xl border border-text-main/5 text-center group hover:border-primary/30 transition-all">
                      <p className="text-xs font-bold text-text-muted uppercase mb-2">TPH Objetivo</p>
                      <input 
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        value={goals.tph || ""}
                        onChange={(e) => setGoals({ ...goals, tph: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-transparent text-2xl font-black text-center text-text-main focus:outline-none transition-colors"
                      />
                    </div>
                    <div className="p-4 bg-text-main/5 rounded-xl border border-text-main/5 text-center group hover:border-primary/30 transition-all">
                      <p className="text-xs font-bold text-text-muted uppercase mb-2">ICJ % Objetivo</p>
                      <input 
                        type="number"
                        placeholder="0"
                        value={goals.icj || ""}
                        onChange={(e) => setGoals({ ...goals, icj: parseInt(e.target.value) || 0 })}
                        className="w-full bg-transparent text-2xl font-black text-center text-text-main focus:outline-none transition-colors"
                      />
                    </div>
                    <div className="p-4 bg-text-main/5 rounded-xl border border-text-main/5 text-center group hover:border-primary/30 transition-all opacity-80">
                      <p className="text-xs font-bold text-text-muted uppercase mb-2">ICR Objetivo</p>
                      <input 
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        value={goals.icr || "0.00"}
                        readOnly
                        className="w-full bg-transparent text-2xl font-black text-center text-primary focus:outline-none cursor-not-allowed transition-colors"
                      />
                    </div>
                    <div className="p-4 bg-text-main/5 rounded-xl border border-text-main/5 text-center group hover:border-primary/30 transition-all">
                      <p className="text-xs font-bold text-text-muted uppercase mb-2">Z-Score Target</p>
                      <input 
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        value={goals.zscore || ""}
                        onChange={(e) => setGoals({ ...goals, zscore: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-transparent text-2xl font-black text-center text-text-main focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Definiciones Sencillas para la Modelo */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 pt-8 border-t border-text-main/5">
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <div className="size-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 text-primary font-bold">TPH</div>
                        <div>
                          <p className="text-sm font-bold text-text-main">¿Qué tan bien aprovechas cada hora?</p>
                          <p className="text-xs text-text-muted">Es el promedio de tokens que ganas por cada hora que estás online. ¡Es como tu "sueldo" de monedas por hora!</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="size-10 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-500 font-bold">ICJ</div>
                        <div>
                          <p className="text-sm font-bold text-text-main">¿Cumpliste con tu horario?</p>
                          <p className="text-xs text-text-muted">Comparamos las horas que trabajaste contra las que prometiste. 100% significa que cumpliste tu palabra.</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <div className="size-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0 text-blue-500 font-bold">ICR</div>
                        <div>
                          <p className="text-sm font-bold text-text-main">¿Llegaste a la meta de producción?</p>
                          <p className="text-xs text-text-muted">Muestra si los tokens que ganaste fueron suficientes según lo planeado para tu tiempo trabajado.</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="size-10 rounded-lg bg-accent-gold/20 flex items-center justify-center shrink-0 text-accent-gold font-bold">Z-S</div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-text-main">Tu "Termómetro" de Desempeño (Z-Score)</p>
                          <p className="text-xs text-text-muted">Es una medida que te dice qué tan potente es tu resultado comparado con el promedio de todas las modelos del estudio.</p>
                          <div className="grid grid-cols-1 gap-1 text-[10px] mt-2">
                            <p className="text-emerald-500 font-bold">● Valor Positivo (+): <span className="text-text-muted font-normal">Estás por ENCIMA del promedio. Ejemplo: Si el equipo suele ganar 1000 monedas por hora y tú ganas 1500, ¡tu termómetro marcará positivo porque estás destacando!</span></p>
                            <p className="text-red-500 font-bold">● Valor Negativo (-): <span className="text-text-muted font-normal">Estás por DEBAJO del promedio. Ejemplo: Si el promedio es 1000 y tú ganas 500, marcará negativo. Es un aviso para que ajustemos juntas la estrategia.</span></p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Tabla Diaria (Núcleo) */}
                <div className="bg-panel-dark border border-text-main/10 rounded-2xl overflow-hidden shadow-xl transition-colors">
                  <div className="p-8 border-b border-text-main/10 flex justify-between items-center bg-text-main/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white text-sm font-bold">3</span>
                      <h2 className="text-xl font-bold text-text-main">Tabla Diaria de Seguimiento</h2>
                    </div>
                    <div className="text-xs text-text-muted font-bold uppercase flex items-center gap-2">
                       <span className="size-2 bg-emerald-500 rounded-full animate-pulse transition-colors"></span>
                       Datos de Firebase Sincronizados
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-text-main/5 border-b border-text-main/10 transition-colors">
                          <th className="py-4 px-6 text-[10px] font-black text-text-muted uppercase tracking-wider">Fecha / Día</th>
                          <th className="py-4 px-6 text-[10px] font-black text-text-muted uppercase tracking-wider">Planteado (H)</th>
                          <th className="py-4 px-6 text-[10px] font-black text-text-muted uppercase tracking-wider text-primary">Real (H)</th>
                          <th className="py-4 px-6 text-[10px] font-black text-text-muted uppercase tracking-wider">ICJ %</th>
                          <th className="py-4 px-6 text-[10px] font-black text-text-muted uppercase tracking-wider text-primary">Tokens</th>
                          <th className="py-4 px-6 text-[10px] font-black text-text-muted uppercase tracking-wider">TPH</th>
                          <th className="py-4 px-6 text-[10px] font-black text-text-muted uppercase tracking-wider">ICR</th>
                          <th className="py-4 px-6 text-[10px] font-black text-text-muted uppercase tracking-wider text-accent-gold">Z-Score</th>
                          <th className="py-4 px-6 text-[10px] font-black text-text-muted uppercase tracking-wider">Comentarios</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-text-main/5">
                        {dailyData.length > 0 ? dailyData.map((day) => (
                          <tr key={day.day} className="hover:bg-white/5 transition-colors">
                            <td className="py-4 px-6">
                              <p className="text-sm font-bold text-text-main">{day.date}</p>
                              <p className="text-[10px] text-text-muted uppercase">Día {day.day}</p>
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
                              <input 
                                type="number" 
                                value={day.tokens} 
                                onChange={(e) => {
                                  const newData = [...dailyData];
                                  newData[day.day - 1].tokens = parseInt(e.target.value) || 0;
                                  setDailyData(newData);
                                }}
                                className="w-20 bg-white/5 border border-white/10 rounded p-1 text-center text-sm font-bold text-primary" 
                              />
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-sm font-bold text-text-main">{(day.tokens / (day.hours || 1)).toFixed(2)}</span>
                            </td>
                            <td className="py-4 px-6 text-sm font-bold text-text-main">
                              {((day.tokens / (day.hours || 1)) * (day.hours / (day.plannedHours || 1))).toFixed(2)}
                            </td>
                            <td className="py-4 px-6">
                              <span className={`text-sm font-bold ${day.zscore && day.zscore > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {day.zscore !== undefined ? day.zscore.toFixed(2) : "0.00"}
                              </span>
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
                                className="bg-transparent border-b border-text-main/10 focus:border-primary text-sm w-full outline-none py-1 text-text-main" 
                              />
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={9} className="py-20 text-center">
                              <p className="text-text-muted italic">Selecciona modelo y periodo, luego haz clic en "Sincronizar Datos"</p>
                            </td>
                          </tr>
                        )}

                        {/* Fila de Promedios Parciales (NUEVA) */}
                        {dailyData.length > 0 && (
                          <tr className="bg-emerald-500/5 border-t border-text-main/5">
                            <td className="py-4 px-6">
                              <p className="text-xs font-black text-emerald-500 uppercase tracking-tighter">Promedios Parciales</p>
                              <p className="text-[10px] text-text-muted">(A la fecha: {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })})</p>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-sm font-bold text-text-muted">
                                {(() => {
                                  const todayStr = new Date().toISOString().split('T')[0];
                                  const partials = dailyData.filter(d => d.date <= todayStr);
                                  return partials.reduce((acc, curr) => acc + (curr.plannedHours || 0), 0).toFixed(1);
                                })()}h
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-sm font-bold text-emerald-500">
                                {(() => {
                                  const todayStr = new Date().toISOString().split('T')[0];
                                  const partials = dailyData.filter(d => d.date <= todayStr);
                                  return partials.reduce((acc, curr) => acc + (curr.hours || 0), 0).toFixed(2);
                                })()}h
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-sm font-bold text-emerald-500">
                                {(() => {
                                  const todayStr = new Date().toISOString().split('T')[0];
                                  const partials = dailyData.filter(d => d.date <= todayStr);
                                  const totalP = partials.reduce((acc, curr) => acc + (curr.plannedHours || 0), 0);
                                  const totalR = partials.reduce((acc, curr) => acc + (curr.hours || 0), 0);
                                  return totalP > 0 ? Math.round((totalR / totalP) * 100) : 0;
                                })()}%
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-sm font-bold text-emerald-500">
                                {(() => {
                                  const todayStr = new Date().toISOString().split('T')[0];
                                  const partials = dailyData.filter(d => d.date <= todayStr);
                                  return partials.reduce((acc, curr) => acc + (curr.tokens || 0), 0).toLocaleString();
                                })()}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-sm font-bold text-text-muted">
                                {(() => {
                                  const todayStr = new Date().toISOString().split('T')[0];
                                  const partials = dailyData.filter(d => d.date <= todayStr);
                                  const totalT = partials.reduce((acc, curr) => acc + (curr.tokens || 0), 0);
                                  const totalH = partials.reduce((acc, curr) => acc + (curr.hours || 0), 0);
                                  return totalH > 0 ? (totalT / totalH).toFixed(2) : "0.00";
                                })()}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-sm font-bold text-text-muted">
                                {(() => {
                                  const todayStr = new Date().toISOString().split('T')[0];
                                  const partials = dailyData.filter(d => d.date <= todayStr);
                                  const totalT = partials.reduce((acc, curr) => acc + (curr.tokens || 0), 0);
                                  const totalP = partials.reduce((acc, curr) => acc + (curr.plannedHours || 0), 0);
                                  return totalP > 0 ? (totalT / totalP).toFixed(2) : "0.00";
                                })()}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-sm font-bold text-accent-gold">
                                {(() => {
                                  const todayStr = new Date().toISOString().split('T')[0];
                                  const partials = dailyData.filter(d => d.date <= todayStr);
                                  return partials.length > 0 ? (partials.reduce((acc, curr) => acc + (curr.zscore || 0), 0) / partials.length).toFixed(2) : "0.00";
                                })()}
                              </span>
                            </td>
                            <td className="py-4 px-6 italic text-[10px] text-emerald-500/50">
                              Cálculo solo de días activos transcurridos
                            </td>
                          </tr>
                        )}

                        {/* Fila de Totales y Promedios */}
                        {dailyData.length > 0 && (
                          <tr className="bg-primary/10 border-t-2 border-primary/20">
                            <td className="py-4 px-6">
                              <p className="text-xs font-black text-primary uppercase tracking-tighter">Promedios Totales</p>
                              <p className="text-[10px] text-text-muted">Periodo Completo</p>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-sm font-black text-text-main">
                                {dailyData.reduce((acc, curr) => acc + (curr.plannedHours || 0), 0).toFixed(1)}h
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-sm font-black text-primary">
                                {dailyData.reduce((acc, curr) => acc + (curr.hours || 0), 0).toFixed(2)}h
                              </span>
                            </td>
                            <td className="py-4 px-6 border-x border-text-main/5">
                              <span className="text-sm font-black text-emerald-500">
                                {(() => {
                                  const totalP = dailyData.reduce((acc, curr) => acc + (curr.plannedHours || 0), 0);
                                  const totalR = dailyData.reduce((acc, curr) => acc + (curr.hours || 0), 0);
                                  return totalP > 0 ? Math.round((totalR / totalP) * 100) : 0;
                                })()}%
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-sm font-black text-primary">
                                {dailyData.reduce((acc, curr) => acc + (curr.tokens || 0), 0).toLocaleString()}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-sm font-black text-text-main">
                                {(() => {
                                  const totalT = dailyData.reduce((acc, curr) => acc + (curr.tokens || 0), 0);
                                  const totalH = dailyData.reduce((acc, curr) => acc + (curr.hours || 0), 0);
                                  return totalH > 0 ? (totalT / totalH).toFixed(2) : "0.00";
                                })()}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-sm font-black text-text-main">
                                {(() => {
                                  const totalT = dailyData.reduce((acc, curr) => acc + (curr.tokens || 0), 0);
                                  const totalP = dailyData.reduce((acc, curr) => acc + (curr.plannedHours || 0), 0);
                                  return totalP > 0 ? (totalT / totalP).toFixed(2) : "0.00";
                                })()}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-sm font-black text-accent-gold">
                                {(dailyData.reduce((acc, curr) => acc + (curr.zscore || 0), 0) / dailyData.length).toFixed(2)}
                              </span>
                            </td>
                            <td className="py-4 px-6 italic text-[10px] text-text-muted">
                              Resumen de gestión quincenal
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. Plan de Acción Estratégico */}
                <div className="bg-text-main/5 border border-text-main/10 rounded-2xl p-8">
                  <div className="flex items-center gap-3 mb-8 border-b border-text-main/5 pb-4">
                    <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white text-sm font-bold">4</span>
                    <h2 className="text-xl font-bold text-text-main">Plan de Acción Estratégico</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Categoría A */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-accent-gold">
                        <span className="material-symbols-outlined">trending_up</span>
                        <h3 className="font-bold uppercase text-xs tracking-wider">Mejorar TPH (Calidad)</h3>
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
                          className="w-full bg-text-main/5 border border-text-main/10 rounded-lg p-2 text-sm text-text-main focus:border-primary outline-none"
                        />
                      ))}
                      <button 
                        onClick={() => setStrategicA([...strategicA, ""])}
                        className="text-[10px] text-text-muted hover:text-primary font-bold uppercase"
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

                {/* 5. Plan Incremento Rank de Posicionamiento */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 border-t-4 border-t-accent-gold">
                  <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
                    <span className="flex items-center justify-center size-8 rounded-full bg-accent-gold text-slate-900 text-sm font-bold">5</span>
                    <div>
                      <h2 className="text-xl font-bold text-white">Plan Incremento Rank de Posicionamiento</h2>
                      <p className="text-xs text-slate-400 mt-1">Métricas y metas basadas en algoritmos predictivos</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    {/* Chaturbate Metrics */}
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                      <div className="flex items-center gap-2 mb-4 text-orange-500">
                        <span className="material-symbols-outlined">network_node</span>
                        <h3 className="font-bold uppercase tracking-wider">Chaturbate (Momentum)</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-400" title="Usuarios registrados/con tokens en sala">Viewers Activos Objetivo</label>
                          <input 
                            type="number"
                            value={rankPositioning.chaturbate.activeViewersTarget || ""}
                            onChange={(e) => setRankPositioning({...rankPositioning, chaturbate: {...rankPositioning.chaturbate, activeViewersTarget: parseInt(e.target.value) || 0}})}
                            className="w-full bg-slate-900 border border-white/10 p-2 rounded text-sm text-white focus:outline-none focus:border-accent-gold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-400" title="Propinas frecuentes (1 a 1). Ej: 50 por hora">Densidad Goteo/H</label>
                          <input 
                            type="number"
                            value={rankPositioning.chaturbate.tippingDensityTarget || ""}
                            onChange={(e) => setRankPositioning({...rankPositioning, chaturbate: {...rankPositioning.chaturbate, tippingDensityTarget: parseInt(e.target.value) || 0}})}
                            className="w-full bg-slate-900 border border-white/10 p-2 rounded text-sm text-white focus:outline-none focus:border-accent-gold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-400">Nuevos Seguidores/H</label>
                          <input 
                            type="number"
                            value={rankPositioning.chaturbate.newFollowersTarget || ""}
                            onChange={(e) => setRankPositioning({...rankPositioning, chaturbate: {...rankPositioning.chaturbate, newFollowersTarget: parseInt(e.target.value) || 0}})}
                            className="w-full bg-slate-900 border border-white/10 p-2 rounded text-sm text-white focus:outline-none focus:border-accent-gold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-400" title="Horas de transmisión continua sin caída (Log(T))">Horas sin Caídas</label>
                          <input 
                            type="number"
                            value={rankPositioning.chaturbate.streamStabilityHours || ""}
                            onChange={(e) => setRankPositioning({...rankPositioning, chaturbate: {...rankPositioning.chaturbate, streamStabilityHours: parseInt(e.target.value) || 0}})}
                            className="w-full bg-slate-900 border border-white/10 p-2 rounded text-sm text-white focus:outline-none focus:border-accent-gold"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Stripchat Metrics */}
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                      <div className="flex items-center gap-2 mb-4 text-red-500">
                        <span className="material-symbols-outlined">local_fire_department</span>
                        <h3 className="font-bold uppercase tracking-wider">Stripchat (Regresión)</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-400" title="Variable mayoritaria de impacto">Prom. Viewers Target</label>
                          <input 
                            type="number"
                            value={rankPositioning.stripchat.averageViewersTarget || ""}
                            onChange={(e) => setRankPositioning({...rankPositioning, stripchat: {...rankPositioning.stripchat, averageViewersTarget: parseInt(e.target.value) || 0}})}
                            className="w-full bg-slate-900 border border-white/10 p-2 rounded text-sm text-white focus:outline-none focus:border-accent-gold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-400" title="Ventana de memoria: Tokens sumados últimos 15 min">Tokens / 15 min Target</label>
                          <input 
                            type="number"
                            value={rankPositioning.stripchat.tokensPer15Min || ""}
                            onChange={(e) => setRankPositioning({...rankPositioning, stripchat: {...rankPositioning.stripchat, tokensPer15Min: parseInt(e.target.value) || 0}})}
                            className="w-full bg-slate-900 border border-white/10 p-2 rounded text-sm text-white focus:outline-none focus:border-accent-gold"
                          />
                        </div>
                        <div className="space-y-1 col-span-2">
                          <label className="text-[10px] uppercase font-bold text-slate-400" title="Piso de inercia">Base Followers Activos En Sala</label>
                          <input 
                            type="number"
                            value={rankPositioning.stripchat.followerBaseTarget || ""}
                            onChange={(e) => setRankPositioning({...rankPositioning, stripchat: {...rankPositioning.stripchat, followerBaseTarget: parseInt(e.target.value) || 0}})}
                            className="w-full bg-slate-900 border border-white/10 p-2 rounded text-sm text-white focus:outline-none focus:border-accent-gold"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Acciones de Apoyo (Cuentas VPN, etc) */}
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase font-bold text-slate-500">Acciones Prácticas de Posicionamiento</label>
                    <p className="text-xs text-slate-400 mb-2">Ej: Activar goteo de 1 token a partir de hora 3, pedir follows post-tip, etc.</p>
                    {rankPositioning.actionItems.map((task, idx) => (
                      <div key={`rp-${idx}`} className="flex gap-2">
                        <input 
                          value={task}
                          onChange={(e) => {
                            const newTasks = [...rankPositioning.actionItems];
                            newTasks[idx] = e.target.value;
                            setRankPositioning({...rankPositioning, actionItems: newTasks});
                          }}
                          placeholder="Ingresa la acción estratégica a realizar..."
                          className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-accent-gold outline-none"
                        />
                      </div>
                    ))}
                    <button 
                      onClick={() => setRankPositioning({...rankPositioning, actionItems: [...rankPositioning.actionItems, ""]})}
                      className="text-[10px] text-accent-gold font-bold uppercase hover:underline"
                    >
                      + Añadir Acción
                    </button>
                  </div>
                </div>

                {/* 6. Análisis Cualitativo Semanal (Gestión) */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                  <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
                    <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white text-sm font-bold">6</span>
                    <h2 className="text-xl font-bold text-white">Análisis de Gestión Semanal</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Semana 1 */}
                    <div className="space-y-4 p-6 bg-white/5 rounded-2xl border border-white/5">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Semana 1 del Plan</h3>
                        <select 
                          value={weeklySummaries.week1.status}
                          onChange={(e) => setWeeklySummaries({
                            ...weeklySummaries,
                            week1: { ...weeklySummaries.week1, status: e.target.value as any }
                          })}
                          className={`text-[10px] font-bold uppercase px-2 py-1 rounded border-none outline-none ${
                            weeklySummaries.week1.status === 'Excelente' ? 'bg-emerald-500/20 text-emerald-500' :
                            weeklySummaries.week1.status === 'Aceptable' ? 'bg-accent-gold/20 text-accent-gold' :
                            weeklySummaries.week1.status === 'Crítica' ? 'bg-red-500/20 text-red-500' : 'bg-white/10 text-slate-500'
                          }`}
                        >
                          <option value="">Estatus...</option>
                          <option value="Excelente">Excelente</option>
                          <option value="Aceptable">Aceptable</option>
                          <option value="Crítica">Crítica</option>
                        </select>
                      </div>
                      <textarea 
                        value={weeklySummaries.week1.analysis}
                        onChange={(e) => setWeeklySummaries({
                          ...weeklySummaries,
                          week1: { ...weeklySummaries.week1, analysis: e.target.value }
                        })}
                        placeholder="Describa el progreso, dificultades y cumplimiento de las acciones de la semana 1..."
                        className="w-full bg-transparent text-sm text-slate-300 min-h-[120px] focus:outline-none resize-none"
                      />
                    </div>

                    {/* Semana 2 */}
                    <div className="space-y-4 p-6 bg-white/5 rounded-2xl border border-white/5">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Semana 2 del Plan</h3>
                        <select 
                          value={weeklySummaries.week2.status}
                          onChange={(e) => setWeeklySummaries({
                            ...weeklySummaries,
                            week2: { ...weeklySummaries.week2, status: e.target.value as any }
                          })}
                          className={`text-[10px] font-bold uppercase px-2 py-1 rounded border-none outline-none ${
                            weeklySummaries.week2.status === 'Excelente' ? 'bg-emerald-500/20 text-emerald-500' :
                            weeklySummaries.week2.status === 'Aceptable' ? 'bg-accent-gold/20 text-accent-gold' :
                            weeklySummaries.week2.status === 'Crítica' ? 'bg-red-500/20 text-red-500' : 'bg-white/10 text-slate-500'
                          }`}
                        >
                          <option value="">Estatus...</option>
                          <option value="Excelente">Excelente</option>
                          <option value="Aceptable">Aceptable</option>
                          <option value="Crítica">Crítica</option>
                        </select>
                      </div>
                      <textarea 
                        value={weeklySummaries.week2.analysis}
                        onChange={(e) => setWeeklySummaries({
                          ...weeklySummaries,
                          week2: { ...weeklySummaries.week2, analysis: e.target.value }
                        })}
                        placeholder="Describa el cierre del plan y si se cumplieron los objetivos finales..."
                        className="w-full bg-transparent text-sm text-slate-300 min-h-[120px] focus:outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 7. Evaluación Global y Decisión (Administración) */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                  <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
                    <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white text-sm font-bold">7</span>
                    <h2 className="text-xl font-bold text-white">Evaluación Global y Decisiones</h2>
                  </div>

                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="col-span-1 space-y-4">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Resultado de Productividad</label>
                        <select 
                          value={evaluation.globalResult}
                          onChange={(e) => setEvaluation({ ...evaluation, globalResult: e.target.value as any })}
                          className="w-full bg-slate-800 border-white/10 rounded-xl p-3 text-sm text-white"
                        >
                          <option value="">Seleccionar resultado...</option>
                          <option value="Superó metas">Superó metas</option>
                          <option value="Cumplió metas mínimas">Cumplió metas mínimas</option>
                          <option value="No cumplió metas">No cumplió metas</option>
                        </select>
                      </div>
                      
                      <div className="col-span-2 space-y-4">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Toma de Decisiones Profesionales</label>
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            "Extensión de Plan", "Plan de Recuperación", 
                            "Cambio de Nivel", "Necesidad de Capacitación",
                            "Sanción Disciplinaria", "Mención de Excelencia"
                          ].map(decision => (
                            <label key={decision} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                              <input 
                                type="checkbox" 
                                checked={evaluation.decisions.includes(decision)}
                                onChange={(e) => {
                                  const updated = e.target.checked 
                                    ? [...evaluation.decisions, decision]
                                    : evaluation.decisions.filter(d => d !== decision);
                                  setEvaluation({ ...evaluation, decisions: updated });
                                }}
                                className="size-4 accent-primary"
                              />
                              <span className="text-xs font-medium text-slate-300">{decision}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Comentarios de Cierre / Seguimiento</label>
                      <textarea 
                        value={evaluation.finalComments}
                        onChange={(e) => setEvaluation({ ...evaluation, finalComments: e.target.value })}
                        placeholder="Observaciones finales del coordinador para el próximo periodo..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-slate-300 min-h-[100px] outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(null)}></div>
          <div 
            className="relative bg-panel-dark border border-text-main/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <div className="size-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-red-500 text-3xl">delete</span>
            </div>
            <h3 className="text-xl font-bold text-text-main text-center mb-2">¿Eliminar este plan?</h3>
            <p className="text-text-muted text-center text-sm mb-8">Esta acción no se puede deshacer y borrará permanentemente todo el histórico de seguimiento de este periodo.</p>
            
            <div className="flex gap-4">
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-3 bg-text-main/5 hover:bg-text-main/10 text-text-main font-bold rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-500/20 disabled:opacity-50"
              >
                {isDeleting ? 'Borrando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ActionPlansPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Cargando sistema de planes..." />}>
      <ActionPlansContent />
    </Suspense>
  );
}


