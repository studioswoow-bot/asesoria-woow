"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, addDoc, updateDoc, doc, where, orderBy, deleteDoc } from 'firebase/firestore';

export interface HistoryEntry {
  userId: string;
  userName: string;
  timestamp: string;
  action: 'create' | 'update' | 'delete';
  changes?: string;
}

export interface DailyTracking {
  day: number;
  date: string;
  tokens: number;
  hours: number;
  dcm: number; // Daily Dollars
  plannedHours: number;
  comments: string;
  zscore?: number;
}

export interface ActionPlan {
  id: string;
  modelId: string;
  modelName: string;
  period: string;
  status: 'active' | 'completed';
  goals: {
    tph: number;
    icj: number;
    icr: number;
    zscore: number;
  };
  dailyTracking: DailyTracking[];
  weeklySummaries: {
    week1: { analysis: string; status: 'Excelente' | 'Aceptable' | 'Crítica' | '' };
    week2: { analysis: string; status: 'Excelente' | 'Aceptable' | 'Crítica' | '' };
  };
  strategicTasks: {
    categoryA: string[];
    categoryB: string[];
    categoryC: string[];
  };
  rankPositioningPlan?: {
    chaturbate: {
      activeViewersTarget: number;
      tippingDensityTarget: number;
      newFollowersTarget: number;
      streamStabilityHours: number;
    };
    stripchat: {
      averageViewersTarget: number;
      tokensPer15Min: number;
      followerBaseTarget: number;
    };
    actionItems: string[];
  };
  evaluation: {
    globalResult: 'Superó metas' | 'Cumplió metas mínimas' | 'No cumplió metas' | '';
    decisions: string[];
    finalComments: string;
  };
  history?: HistoryEntry[];
  createdAt: string;
}

interface ActionPlanContextType {
  plans: ActionPlan[];
  activePlan: ActionPlan | null;
  loading: boolean;
  addPlan: (plan: ActionPlan) => Promise<void>;
  updatePlan: (id: string, updates: Partial<ActionPlan>) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;
  setActivePlan: (plan: ActionPlan | null) => void;
  getHistoricalPlans: (modelId: string) => ActionPlan[];
}

const ActionPlanContext = createContext<ActionPlanContextType | undefined>(undefined);

// NUEVA COLECCIÓN PARA ESTA APP (Respetando el aislamiento)
const PLANS_COLLECTION = "modelos_action_plans_v2";

export const ActionPlanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [activePlan, setActivePlan] = useState<ActionPlan | null>(null);
  const [loading, setLoading] = useState(true);

  // Load from Firebase on mount
  useEffect(() => {
    async function fetchPlans() {
      try {
        const q = query(collection(db, PLANS_COLLECTION), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const loadedPlans = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        })) as ActionPlan[];
        setPlans(loadedPlans);
      } catch (e) {
        console.error("Error loading plans from Firebase", e);
      } finally {
        setLoading(false);
      }
    }
    fetchPlans();
  }, []);

  const addPlan = async (plan: ActionPlan) => {
    try {
      const { auth } = await import('@/lib/firebase');
      const currentUser = auth.currentUser;
      
      const historyEntry: HistoryEntry = {
        userId: currentUser?.uid || 'unknown',
        userName: currentUser?.displayName || currentUser?.email || 'Sistema',
        timestamp: new Date().toISOString(),
        action: 'create',
        changes: 'Creación inicial del plan'
      };

      // Omitimos el id local para que Firebase genere uno nuevo
      const { id, ...planData } = plan;
      const finalPlanData = {
        ...planData,
        history: [historyEntry]
      };

      const docRef = await addDoc(collection(db, PLANS_COLLECTION), finalPlanData);
      const newPlan = { ...finalPlanData, id: docRef.id } as ActionPlan;
      setPlans(prev => [newPlan, ...prev]);
    } catch (e) {
      console.error("Error adding plan to Firebase", e);
      throw e;
    }
  };

  const updatePlan = async (id: string, updates: Partial<ActionPlan>) => {
    try {
      const { auth } = await import('@/lib/firebase');
      const currentUser = auth.currentUser;
      const docRef = doc(db, PLANS_COLLECTION, id);
      const currentPlan = plans.find(p => p.id === id);
      
      // Calculate specific changes
      const specificChanges: string[] = [];
      if (updates.goals) {
        if (updates.goals.tph !== currentPlan?.goals.tph) 
          specificChanges.push(`TPH: ${currentPlan?.goals.tph || 0} -> ${updates.goals.tph}`);
        if (updates.goals.icj !== currentPlan?.goals.icj) 
          specificChanges.push(`ICJ: ${currentPlan?.goals.icj || 0}% -> ${updates.goals.icj}%`);
      }
      if (updates.period && updates.period !== currentPlan?.period) {
        specificChanges.push(`Periodo cambiado`);
      }
      if (updates.rankPositioningPlan) {
        specificChanges.push(`Plan de Rank actualizado`);
      }
      if (updates.strategicTasks) {
        specificChanges.push(`Estrategias actualizadas`);
      }

      const historyEntry: HistoryEntry = {
        userId: currentUser?.uid || 'unknown',
        userName: currentUser?.displayName || currentUser?.email || 'Sistema',
        timestamp: new Date().toISOString(),
        action: 'update',
        changes: specificChanges.length > 0 ? specificChanges.join(', ') : 'Actualización general'
      };

      const newHistory = [historyEntry, ...(currentPlan?.history || [])].slice(0, 10); // Keep last 10
      
      const finalUpdates = {
        ...updates,
        history: newHistory
      };

      await updateDoc(docRef, finalUpdates);
      setPlans(prev => prev.map(p => p.id === id ? { ...p, ...finalUpdates } : p));
      if (activePlan?.id === id) {
        setActivePlan(prev => prev ? { ...prev, ...finalUpdates } : null);
      }
    } catch (e) {
      console.error("Error updating plan in Firebase", e);
      throw e;
    }
  };

  const deletePlan = async (id: string) => {
    try {
      const docRef = doc(db, PLANS_COLLECTION, id);
      await deleteDoc(docRef);
      setPlans(prev => prev.filter(p => p.id !== id));
      if (activePlan?.id === id) {
        setActivePlan(null);
      }
    } catch (e) {
      console.error("Error deleting plan from Firebase", e);
      throw e;
    }
  };

  const getHistoricalPlans = (modelId: string) => {
    return plans.filter(p => p.modelId === modelId);
  };

  return (
    <ActionPlanContext.Provider value={{ 
      plans, 
      activePlan, 
      loading,
      addPlan, 
      updatePlan, 
      deletePlan,
      setActivePlan, 
      getHistoricalPlans 
    }}>
      {children}
    </ActionPlanContext.Provider>
  );
};

export const useActionPlans = () => {
  const context = useContext(ActionPlanContext);
  if (context === undefined) {
    throw new Error('useActionPlans must be used within an ActionPlanProvider');
  }
  return context;
};

