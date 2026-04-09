"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, query } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import LoadingScreen from "@/components/common/LoadingScreen";
import { useRouter } from "next/navigation";

interface ModelMapping {
  id: string;
  realName: string;
  primaryNickname: string;
  stripchatAliases: string[];
  camsodaAliases: string[];
}

export default function AliasMappingPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [mappings, setMappings] = useState<ModelMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingModel, setEditingModel] = useState<ModelMapping | null>(null);
  const [newAlias, setNewAlias] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    } else if (!authLoading && profile && (profile.role !== "admin" && profile.role !== "monitor")) {
      router.push("/");
    }
  }, [user, profile, authLoading, router]);

  useEffect(() => {
    async function fetchData() {
      try {
        const qModels = query(collection(db, "models"));
        const qProfiles = query(collection(db, "modelos_profile_v2"));
        
        const [modelsSnap, profilesSnap] = await Promise.all([
          getDocs(qModels),
          getDocs(qProfiles)
        ]);

        const profilesMap = new Map();
        profilesSnap.docs.forEach(d => profilesMap.set(d.id, d.data()));

        const data: ModelMapping[] = modelsSnap.docs.map(modelDoc => {
          const mData = modelDoc.data();
          const pData = profilesMap.get(modelDoc.id);
          
          return {
            id: modelDoc.id,
            realName: pData?.realName || mData.name || "Sin nombre",
            primaryNickname: mData.nickname || "sin_apodo",
            stripchatAliases: pData?.platformAliases?.Stripchat || [],
            camsodaAliases: pData?.platformAliases?.Camsoda || []
          };
        });

        setMappings(data);
      } catch (error) {
        console.error("Error fetching mappings:", error);
      } finally {
        setLoading(false);
      }
    }

    if (user) fetchData();
  }, [user]);

  const handleSaveAliases = async () => {
    if (!editingModel) return;
    setSaving(true);
    try {
      const docRef = doc(db, "modelos_profile_v2", editingModel.id);
      await updateDoc(docRef, {
        "platformAliases.Stripchat": editingModel.stripchatAliases,
        "updatedAt": new Date().toISOString()
      });
      
      // Update local state
      setMappings(prev => prev.map(m => m.id === editingModel.id ? editingModel : m));
      setEditingModel(null);
    } catch (error) {
      console.error("Error saving aliases:", error);
      alert("Error al guardar los cambios.");
    } finally {
      setSaving(false);
    }
  };

  const filteredMappings = mappings.filter(m => 
    m.realName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.primaryNickname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading || authLoading) return <LoadingScreen message="Cargando mapa de identidades..." />;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-display font-black text-text-main mb-2 italic tracking-tight">Mapeo de Plataformas</h2>
          <p className="text-text-muted font-medium">Vincula la identidad real de las modelos con sus apodos de trabajo en Stripchat y Chaturbate.</p>
        </div>
      </div>

      <div className="bg-panel-dark border border-text-main/10 rounded-3xl overflow-hidden shadow-2xl transition-colors">
        <div className="p-6 border-b border-text-main/10 flex items-center justify-between bg-text-main/5">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">search</span>
            <input 
              type="text" 
              placeholder="Buscar por identidad o apodo..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-background-dark border border-text-main/10 rounded-2xl pl-12 pr-6 py-3 text-text-main focus:outline-none focus:ring-2 focus:ring-primary w-80 transition-all placeholder:text-text-muted"
            />
          </div>
        </div>

        <table className="w-full text-left">
          <thead>
            <tr className="bg-text-main/5 border-b border-text-main/10 uppercase tracking-widest text-[10px] font-black text-text-muted">
              <th className="px-8 py-5">Identidad (Nombre Real)</th>
              <th className="px-8 py-5">Nickname Principal (CB)</th>
              <th className="px-8 py-5">Apodos Stripchat</th>
              <th className="px-8 py-5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredMappings.map((m) => (
              <tr key={m.id} className="hover:bg-text-main/5 transition-all group">
                <td className="px-8 py-6 font-bold text-text-main group-hover:text-primary transition-colors italic">{m.realName}</td>
                <td className="px-8 py-6">
                  <span className="px-3 py-1 bg-accent-gold/10 text-accent-gold border border-accent-gold/20 rounded-lg text-xs font-black uppercase">
                    {m.primaryNickname}
                  </span>
                </td>
                <td className="px-8 py-6">
                  <div className="flex gap-2 flex-wrap">
                    {m.stripchatAliases.length > 0 ? m.stripchatAliases.map(alias => (
                      <span key={alias} className="px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded-md text-[10px] font-bold">
                        {alias}
                      </span>
                    )) : <span className="text-text-muted italic text-[10px]">Sin alias configurados</span>}
                  </div>
                </td>
                <td className="px-8 py-6 text-right">
                  <button 
                    onClick={() => setEditingModel(m)}
                    className="p-3 bg-primary/20 text-primary hover:bg-primary hover:text-white rounded-xl transition-all shadow-lg"
                  >
                    <span className="material-symbols-outlined text-sm">link</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de Edición de Alias */}
      {editingModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background-dark/90 backdrop-blur-md">
          <div className="w-full max-w-xl bg-panel-dark border border-text-main/10 rounded-[32px] p-10 shadow-3xl animate-in zoom-in duration-300">
            <h3 className="text-2xl font-black text-text-main mb-2 italic underline decoration-primary decoration-4">Vincular Plataformas</h3>
            <p className="text-text-muted text-sm mb-8 font-sans">Gestionando apodos para: <strong className="text-text-main italic">{editingModel.realName}</strong></p>

            <div className="space-y-6">
              <div className="bg-text-main/5 p-6 rounded-2xl border border-text-main/10">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest block mb-4">Alias en Stripchat</label>
                <div className="flex gap-2 mb-4 flex-wrap">
                  {editingModel.stripchatAliases.map(alias => (
                    <div key={alias} className="flex items-center gap-2 bg-primary/20 text-primary px-3 py-1.5 rounded-xl border border-primary/20">
                      <span className="text-xs font-bold font-mono">{alias}</span>
                      <button onClick={() => setEditingModel({...editingModel, stripchatAliases: editingModel.stripchatAliases.filter(a => a !== alias)})}>
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Nuevo apodo (ej: SWEET_KITTY_01)" 
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                    className="flex-1 px-4 py-3 bg-background-dark border border-text-main/10 rounded-xl text-text-main focus:outline-none focus:ring-2 focus:ring-primary h-[48px] placeholder:text-text-muted/50"
                  />
                  <button 
                    onClick={() => {
                        if (newAlias && !editingModel.stripchatAliases.includes(newAlias)) {
                            setEditingModel({...editingModel, stripchatAliases: [...editingModel.stripchatAliases, newAlias]});
                            setNewAlias("");
                        }
                    }}
                    className="p-3 bg-accent-gold text-background-dark font-black rounded-xl hover:scale-105 transition-all text-xs uppercase"
                  >
                    Añadir
                  </button>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setEditingModel(null)}
                  className="flex-1 py-4 bg-text-main/5 text-text-muted font-bold rounded-2xl hover:bg-text-main/10 transition-all border border-text-main/10 uppercase text-xs"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveAliases}
                  disabled={saving}
                  className="flex-1 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/30 hover:scale-105 transition-all disabled:opacity-50 uppercase text-xs"
                >
                  {saving ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
