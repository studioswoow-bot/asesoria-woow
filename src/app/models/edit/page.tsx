"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { saveProfileHistory } from "@/lib/history";
import LoadingScreen from "@/components/common/LoadingScreen";
import glossaryData from "@/data/glossary.json";
import toysData from "@/data/toys.json";
import attributesData from "@/data/attributes.json";
import hashtagsData from "@/data/hashtags.json";
import outfitsData from "@/data/outfits.json";
import { usePlatforms } from "@/context/PlatformContext";

interface GlossaryItem {
  term: string;
  definition: string;
}

interface ToyItem {
  name: string;
  use: string;
  category: string;
  brand: string;
}

interface HashtagItem {
  tag: string;
  description: string;
}

interface OutfitItem {
  name: string;
  description: string;
}

import { calculateProfileProgress, ProfileData } from "@/lib/utils";

function EditProfileContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const router = useRouter();
  const { platforms } = usePlatforms();
  const [loading, setLoading] = useState(true);
  
  const [selectedKinks, setSelectedKinks] = useState<string[]>([]);
  const [selectedToys, setSelectedToys] = useState<string[]>([]);
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);
  const [selectedOutfits, setSelectedOutfits] = useState<string[]>([]);
  const [customOutfits, setCustomOutfits] = useState<string[]>([]);
  const [physicalAttributes, setPhysicalAttributes] = useState<{[key: string]: string}>({});
  
  const [generalInfo, setGeneralInfo] = useState({
    realName: "",
    artisticName: "",
    age: "",
    experience: "nuevo",
    targetPlatforms: [] as string[]
  });
  
  const [platformCredentials, setPlatformCredentials] = useState<{[key: string]: { apiKey: string, username: string, apiSecret?: string }}>({});
  const [activeDefinition, setActiveDefinition] = useState<GlossaryItem | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadModelData() {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const modelRef = doc(db, "models", id);
        const modelSnap = await getDoc(modelRef);
        if (modelSnap.exists()) {
          const data = modelSnap.data();
          // Verificar que la modelo esté activa (7288e)
          const s = (data.status || "").toLowerCase();
          const isActive = s === "active" || s === "activa" || s === "activo" || s === "online";
          
          if (!isActive) {
            console.warn("La modelo no está activa.");
            setLoading(false);
            return;
          }

          setGeneralInfo(prev => ({
            ...prev,
            artisticName: data.name || "",
            realName: data.fullName || "",
            experience: data.experience || "nuevo",
            age: data.age || "",
            targetPlatforms: data.platforms || []
          }));
        } else {
          setLoading(false);
          return;
        }

        const profileRef = doc(db, "modelos_profile_v2", id);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          const pData = profileSnap.data();
          if (pData.selectedKinks) setSelectedKinks(pData.selectedKinks);
          if (pData.selectedToys) setSelectedToys(pData.selectedToys);
          if (pData.selectedHashtags) setSelectedHashtags(pData.selectedHashtags);
          if (pData.selectedOutfits) {
            setSelectedOutfits(pData.selectedOutfits);
            if (pData.customOutfits) setCustomOutfits(pData.customOutfits);
          }
          if (pData.physicalAttributes) setPhysicalAttributes(pData.physicalAttributes);
          if (pData.credentials) setPlatformCredentials(pData.credentials);
        }
      } catch (err) {
        console.error("Error loading profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadModelData();
  }, [id]);

  const progress = useMemo(() => {
    return calculateProfileProgress({
      physicalAttributes,
      credentials: platformCredentials as any,
      selectedKinks,
      selectedToys,
      selectedOutfits,
      selectedHashtags,
      targetPlatforms: generalInfo.targetPlatforms,
      age: generalInfo.age,
      experience: generalInfo.experience
    });
  }, [physicalAttributes, platformCredentials, selectedKinks, selectedToys, selectedOutfits, selectedHashtags, generalInfo]);

  const handleUpdateProfile = async () => {
    if (!id) return;
    setIsSaving(true);
    try {
      const profileRef = doc(db, "modelos_profile_v2", id);
      const profileData = {
        modelId: id,
        updatedAt: new Date().toISOString(),
        selectedKinks,
        selectedToys,
        selectedHashtags,
        selectedOutfits,
        customOutfits,
        physicalAttributes,
        credentials: platformCredentials,
        generalInfo,
        progress: progress // Store current progress
      };
      
      await setDoc(profileRef, profileData, { merge: true });
      
      // Guardar snapshot histórico
      await saveProfileHistory(id, profileData);
      
      setSaveStatus("¡Perfil actualizado correctamente!");
      setTimeout(() => {
        setSaveStatus(null);
        router.push(`/models/profile?id=${id}`);
      }, 2000);
    } catch (err) {
        alert("Error al actualizar: " + err);
    } finally {
        setIsSaving(false);
    }
  };

  const handleCredentialChange = (platform: string, field: string, value: string) => {
    setPlatformCredentials(prev => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value }
    }));
  };

  const toggleToy = (name: string) => {
    setSelectedToys(prev => 
      prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
    );
  };

  const selectAttribute = (category: string, option: string) => {
    setPhysicalAttributes(prev => ({
      ...prev,
      [category]: option
    }));
  };

  if (loading) return <LoadingScreen message="Recuperando perfilamiento..." />;

  if (!id) return <div className="p-10 text-white">ID no proporcionado.</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto w-full animate-in fade-in duration-500">
      {isSaving && <LoadingScreen message="Actualizando base de datos central..." fullPage />}
      
      {activeDefinition && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setActiveDefinition(null)}>
          <div className="bg-sidebar-dark border border-primary/30 p-8 rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h5 className="text-xl font-bold text-accent-gold mb-4">{activeDefinition.term}</h5>
            <p className="text-slate-300 italic border-l-2 border-primary/50 pl-4">"{activeDefinition.definition}"</p>
          </div>
        </div>
      )}

      {saveStatus && (
        <div className="fixed top-8 right-8 z-[110] animate-in slide-in-from-top-4">
          <div className="bg-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3">
            <span className="material-symbols-outlined">check_circle</span>
            <span className="font-bold">{saveStatus}</span>
          </div>
        </div>
      )}

      <div className="mb-10 lg:flex items-start justify-between gap-10">
        <div className="flex-1">
            <h3 className="font-display text-4xl font-black text-white">Editar perfilamiento</h3>
            <p className="text-slate-400 mb-6">Actualiza las preferencias de {generalInfo.artisticName}.</p>
            
            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-6 mb-8 flex items-center gap-6">
              <div className="relative h-20 w-20 flex-shrink-0">
                <svg className="h-full w-full" viewBox="0 0 36 36">
                  <path className="stroke-primary/10 fill-none" strokeWidth="3" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="stroke-primary fill-none transition-all duration-1000 ease-out" 
                        strokeDasharray={`${progress}, 100`} 
                        strokeWidth="3" 
                        strokeLinecap="round" 
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-black text-white">{progress}%</span>
                </div>
              </div>
              <div>
                <h5 className="font-bold text-white mb-1">Compleción del Perfil</h5>
                <p className="text-xs text-slate-400 max-w-xs">{progress < 100 ? 'Todavía faltan algunos detalles para que el perfil esté completo. ¡Sigue así!' : '¡Excelente! El perfil de la modelo está completo al 100%.'}</p>
              </div>
            </div>
        </div>
        <button 
            onClick={handleUpdateProfile}
            disabled={isSaving}
            className="px-8 py-4 bg-primary text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 mt-4 lg:mt-0"
        >
            {isSaving ? "Guardando..." : "Actualizar Todo"}
        </button>
      </div>

      <div className="space-y-8 pb-32">
        <section className="bg-sidebar-dark/50 rounded-3xl border border-primary/20 p-8">
            <h4 className="font-bold text-white text-lg mb-6 flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">api</span>
                Credenciales de Plataformas
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {generalInfo.targetPlatforms.map((platform) => (
                    <div key={platform} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                      <p className="font-bold text-primary mb-4">{platform}</p>
                      <div className="space-y-3">
                        <input 
                          type="text" 
                          value={platformCredentials[platform]?.username || ""}
                          onChange={(e) => handleCredentialChange(platform, 'username', e.target.value)}
                          placeholder="Username"
                          className="w-full bg-background-dark/50 border border-primary/10 rounded-lg px-3 py-2 text-xs text-white"
                        />
                        <input 
                          type="password" 
                          value={platformCredentials[platform]?.apiKey || ""}
                          onChange={(e) => handleCredentialChange(platform, 'apiKey', e.target.value)}
                          placeholder="API Key"
                          className="w-full bg-background-dark/50 border border-primary/10 rounded-lg px-3 py-2 text-xs text-white"
                        />
                      </div>
                    </div>
                  ))}
            </div>
        </section>

        <section className="bg-sidebar-dark/50 rounded-3xl border border-primary/20 p-8">
            <h4 className="font-bold text-white text-lg mb-6">Atributos Físicos</h4>
            <div className="space-y-6">
                {attributesData.map((attr) => (
                    <div key={attr.category}>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3">{attr.category}</label>
                        <div className="flex flex-wrap gap-2">
                             {attr.options.map((option) => (
                                <button 
                                    key={option}
                                    type="button"
                                    onClick={() => selectAttribute(attr.category, option)}
                                    className={`px-4 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                                        physicalAttributes[attr.category] === option 
                                        ? "bg-primary border-primary text-white" 
                                        : "border-white/10 text-slate-400 hover:border-primary/50"
                                    }`}
                                >
                                    {option}
                                </button>
                             ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>

        <section className="bg-sidebar-dark/50 rounded-3xl border border-primary/20 p-8">
            <h4 className="font-bold text-white text-lg mb-6">Juguetes e Inventario</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {toysData.map(toy => (
                    <button
                        key={toy.name}
                        onClick={() => toggleToy(toy.name)}
                        className={`p-3 rounded-xl border text-[10px] font-bold text-left transition-all ${
                            selectedToys.includes(toy.name) ? "bg-primary/20 border-primary text-primary" : "border-white/5 text-slate-500 bg-white/5"
                        }`}
                    >
                        {toy.name}
                    </button>
                ))}
            </div>
        </section>
      </div>
    </div>
  );
}

export default function ModelEditPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Cargando editor..." />}>
      <EditProfileContent />
    </Suspense>
  );
}
