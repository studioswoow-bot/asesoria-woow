"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, addDoc, updateDoc, doc, where, orderBy } from 'firebase/firestore';

export interface DailyTracking {
  day: number;
  date: string;
  tokens: number;
  hours: number;
  dcm: number; // Daily Dollars
  plannedHours: number;
  comments: string;
}

export interface ActionPlan {
  id: string;
  modelId: string;
  modelName: string;
  period: string;
  status: 'active' | 'completed';
  goals: {
    tpm: number;
    icj: number;
    icr: number;
    zscore: number;
  };
  dailyTracking: DailyTracking[];
  weeklySummaries: {
    week1: string;
    week2: string;
  };
  strategicTasks: {
    categoryA: string[];
    categoryB: string[];
    categoryC: string[];
  };
  evaluation: string;
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
      // Omitimos el id local para que Firebase genere uno nuevo
      const { id, ...planData } = plan;
      const docRef = await addDoc(collection(db, PLANS_COLLECTION), planData);
      const newPlan = { ...plan, id: docRef.id };
      setPlans(prev => [newPlan, ...prev]);
    } catch (e) {
      console.error("Error adding plan to Firebase", e);
      throw e;
    }
  };

  const updatePlan = async (id: string, updates: Partial<ActionPlan>) => {
    try {
      const docRef = doc(db, PLANS_COLLECTION, id);
      await updateDoc(docRef, updates);
      setPlans(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
      if (activePlan?.id === id) {
        setActivePlan(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (e) {
      console.error("Error updating plan in Firebase", e);
      throw e;
    }
  };

  const deletePlan = async (id: string) => {
    try {
      const { deleteDoc } = await import('firebase/firestore');
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
