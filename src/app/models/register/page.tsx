"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import glossaryData from "@/data/glossary.json";
import toysData from "@/data/toys.json";
import attributesData from "@/data/attributes.json";
import hashtagsData from "@/data/hashtags.json";
import outfitsData from "@/data/outfits.json";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, collection, getDocs, query } from "firebase/firestore";
import { saveProfileHistory } from "@/lib/history";
import { usePlatforms } from "@/context/PlatformContext";
import LoadingScreen from "@/components/common/LoadingScreen";
import { useEffect } from "react";
import { calculateProfileProgress } from "@/lib/utils";

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

// Progress calculation moved to top imports

export default function ModelRegistrationPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const { platforms } = usePlatforms();
  const [selectedKinks, setSelectedKinks] = useState<string[]>([]);
  const [selectedToys, setSelectedToys] = useState<string[]>([]);
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);
  const [selectedOutfits, setSelectedOutfits] = useState<string[]>([]);
  const [customOutfits, setCustomOutfits] = useState<string[]>([]);
  const [otherOutfitInput, setOtherOutfitInput] = useState("");
  const [generalInfo, setGeneralInfo] = useState({
    realName: "",
    artisticName: "",
    age: "",
    experience: "nuevo",
    targetPlatforms: [] as string[]
  });
  const [platformCredentials, setPlatformCredentials] = useState<{[key: string]: { apiKey: string, username: string, apiSecret?: string }}>({});
  const [physicalAttributes, setPhysicalAttributes] = useState<{[key: string]: string}>({});
  const [activeDefinition, setActiveDefinition] = useState<GlossaryItem | null>(null);
  const [activeToy, setActiveToy] = useState<ToyItem | null>(null);
  const [activeHashtag, setActiveHashtag] = useState<HashtagItem | null>(null);
  const [activeOutfit, setActiveOutfit] = useState<OutfitItem | null>(null);
  const [apiEnabledPlatforms, setApiEnabledPlatforms] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [existingModels, setExistingModels] = useState<any[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [selectedModelId, setSelectedModelId] = useState<string>("");

  useEffect(() => {
    async function fetchModels() {
      try {
        const q = query(collection(db, "models"));
        const snapshot = await getDocs(q);
        const modelList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as any[];

        // Filtrar solo modelos activos (7288e)
        const activeModels = modelList.filter(m => {
          const s = (m.status || "").toLowerCase();
          return s === "active" || s === "activa" || s === "activo" || s === "online";
        });

        setExistingModels(activeModels);
      } catch (error) {
        console.error("Error fetching models:", error);
      } finally {
        setIsLoadingModels(false);
      }
    }
    fetchModels();
  }, []);

  const progress = useMemo(() => {
    if (!selectedModelId) return 0;
    
    return calculateProfileProgress({
      physicalAttributes,
      credentials: platformCredentials as any,
      selectedKinks,
      selectedToys,
      selectedOutfits,
      selectedHashtags,
      targetPlatforms: generalInfo.targetPlatforms,
      apiEnabledPlatforms,
      age: generalInfo.age,
      experience: generalInfo.experience
    });
  }, [selectedModelId, physicalAttributes, platformCredentials, selectedKinks, selectedToys, selectedOutfits, selectedHashtags, generalInfo, apiEnabledPlatforms]);

  const handleModelSelect = async (id: string) => {
    const model = existingModels.find(m => m.id === id);
    if (model) {
      setSelectedModelId(id);
      
      const modelPlatforms = Array.isArray(model.platforms) ? model.platforms : [];
      
      // Valores base desde la colección 'models' (App V1)
      let initialGeneralInfo = {
        artisticName: model.nickname || model.name || "",
        realName: model.fullName || model.name || "",
        age: model.age || "",
        experience: model.experience || "nuevo",
        targetPlatforms: modelPlatforms
      };

      try {
        // Cargar info complementada de 'modelos_profile_v2' (NUESTRA COLECCIÓN V2)
        const profileSnap = await getDoc(doc(db, "modelos_profile_v2", id));
        
        if (profileSnap.exists()) {
          const profileData = profileSnap.data();
          
          // Mezclar con info V2 si existe (prevalecen los datos guardados en V2 para edad y experiencia)
          if (profileData.generalInfo) {
            initialGeneralInfo = {
              ...initialGeneralInfo,
              age: profileData.generalInfo.age || initialGeneralInfo.age,
              experience: profileData.generalInfo.experience || initialGeneralInfo.experience
            };
          }

          if (profileData.physicalAttributes) setPhysicalAttributes(profileData.physicalAttributes);
          if (profileData.selectedKinks) setSelectedKinks(profileData.selectedKinks);
          if (profileData.selectedToys) setSelectedToys(profileData.selectedToys);
          if (profileData.selectedHashtags) setSelectedHashtags(profileData.selectedHashtags);
          if (profileData.selectedOutfits) {
            setSelectedOutfits(profileData.selectedOutfits);
            if (profileData.customOutfits) setCustomOutfits(profileData.customOutfits);
          }
          
          if (profileData.credentials) {
            setPlatformCredentials(profileData.credentials);
          } else {
            const syncedCredentials: {[key: string]: { apiKey: string, username: string }} = {};
            modelPlatforms.forEach((p: string) => {
              syncedCredentials[p] = { apiKey: "", username: "" };
            });
            setPlatformCredentials(syncedCredentials);
          }

          setApiEnabledPlatforms(profileData.apiEnabledPlatforms || modelPlatforms);
        } else {
          // Si no hay perfil V2, valores por defecto
          const syncedCredentials: {[key: string]: { apiKey: string, username: string }} = {};
          modelPlatforms.forEach((p: string) => {
            syncedCredentials[p] = { apiKey: "", username: "" };
          });
          setPlatformCredentials(syncedCredentials);
          
          setPhysicalAttributes({});
          setSelectedKinks([]);
          setSelectedToys([]);
          setSelectedHashtags([]);
          setSelectedOutfits([]);
          setCustomOutfits([]);
          setApiEnabledPlatforms(modelPlatforms);
        }
      } catch (err) {
        console.error("Error al cargar perfil complementario:", err);
      }

      // Seteo único de generalInfo para evitar renders innecesarios y estados inconsistentes
      setGeneralInfo(initialGeneralInfo);

    } else {
      setSelectedModelId("");
      setGeneralInfo({
        realName: "",
        artisticName: "",
        age: "",
        experience: "nuevo",
        targetPlatforms: []
      });
      setPlatformCredentials({});
      setPhysicalAttributes({});
      setSelectedKinks([]);
      setSelectedToys([]);
      setSelectedHashtags([]);
      setSelectedOutfits([]);
      setCustomOutfits([]);
      setApiEnabledPlatforms([]);
    }
  };

  const notifySave = (section: string) => {
    setSaveStatus(`¡${section} guardado con éxito!`);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleSectionSave = async (section: string) => {
    if (!selectedModelId) {
      alert("Debes seleccionar una modelo de la lista antes de guardar.");
      return;
    }

    try {
      // Build the full profile data to ensure consistency on each partial save
      const profileData = {
        modelId: selectedModelId,
        generalInfo,
        credentials: platformCredentials,
        physicalAttributes,
        selectedKinks,
        selectedToys,
        selectedHashtags,
        selectedOutfits,
        customOutfits,
        apiEnabledPlatforms,
        progress,
        updatedAt: new Date().toISOString()
      };

      // Use merge to avoid overwriting fields not currenty in the form logic
      await setDoc(doc(db, "modelos_profile_v2", selectedModelId), profileData, { merge: true });
      
      // Save history record for this partial update
      await saveProfileHistory(selectedModelId, profileData);

      notifySave(section);
    } catch (err) {
      console.error(`Error al guardar ${section}:`, err);
      alert(`Error al guardar: ${err}`);
    }
  };

  const handleGeneralInfoChange = (field: string, value: any) => {
    setGeneralInfo(prev => ({ ...prev, [field]: value }));
  };

  const togglePlatform = (platform: string) => {
    setGeneralInfo(prev => {
      const isSelected = prev.targetPlatforms.includes(platform);
      const newPlatforms = isSelected
        ? prev.targetPlatforms.filter(p => p !== platform)
        : [...prev.targetPlatforms, platform];
      
      // Also update credentials state to keep it clean
      if (isSelected) {
        const { [platform]: removed, ...rest } = platformCredentials;
        setPlatformCredentials(rest);
        setApiEnabledPlatforms(prevApi => prevApi.filter(p => p !== platform));
      } else {
        setPlatformCredentials(prevCreds => ({
          ...prevCreds,
          [platform]: { apiKey: "", username: "" }
        }));
        setApiEnabledPlatforms(prevApi => [...prevApi, platform]); // Enable API by default when platform is added
      }

      return {
        ...prev,
        targetPlatforms: newPlatforms
      };
    });
  };

  const handleCredentialChange = (platform: string, field: string, value: string) => {
    setPlatformCredentials(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [field]: value
      }
    }));
  };

  const toggleKink = (term: string) => {
    setSelectedKinks(prev => 
      prev.includes(term) ? prev.filter(t => t !== term) : [...prev, term]
    );
  };

  const toggleHashtag = (tag: string) => {
    setSelectedHashtags(prev => {
      if (prev.includes(tag)) return prev.filter(t => t !== tag);
      if (prev.length < 5) return [...prev, tag];
      return prev;
    });
  };

  const toggleToy = (name: string) => {
    setSelectedToys(prev => 
      prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
    );
  };

  const toggleOutfit = (name: string) => {
    setSelectedOutfits(prev => 
      prev.includes(name) ? prev.filter(o => o !== name) : [...prev, name]
    );
  };

  const addCustomOutfit = () => {
    if (otherOutfitInput.trim()) {
      const newOutfit = otherOutfitInput.trim();
      if (!customOutfits.includes(newOutfit) && !outfitsData.find(o => o.name === newOutfit)) {
        setCustomOutfits(prev => [...prev, newOutfit]);
        setSelectedOutfits(prev => [...prev, newOutfit]);
      }
      setOtherOutfitInput("");
    }
  };

  const selectAttribute = (category: string, option: string) => {
    setPhysicalAttributes(prev => ({
      ...prev,
      [category]: option
    }));
  };

  // Group toys by broader categories
  const groupedToys = useMemo(() => {
    const categories: { [key: string]: string } = {
      "Clítoris externo": "Estimulación & Vaginal",
      "Penetración": "Estimulación & Vaginal",
      "Vaginal/Anal": "Anal & Mixto",
      "Vaginal interna": "Estimulación & Vaginal",
      "Punto G": "Estimulación & Vaginal",
      "Punto G + Clítoris": "Estimulación & Vaginal",
      "Anal": "Anal & Próstata",
      "Próstata": "Anal & Próstata",
      "Anal/Fetiche": "Anal & Próstata",
      "Preparación anal": "Anal & Próstata",
      "BDSM": "BDSM & Fetiche",
      "Fetiche visual": "BDSM & Fetiche",
      "Sensorial": "Sensorial & Pezones",
      "Pezones": "Sensorial & Pezones",
      "Sientes el doble": "Sensorial & Pezones",
      "Cuerpo completo": "Sensorial & Pezones",
      "Pene": "Masculino & Pareja",
      "Pene/Pareja": "Masculino & Pareja",
      "Masturbación masculina": "Masculino & Pareja"
    };

    const groups: { [key: string]: ToyItem[] } = {};
    toysData.forEach(toy => {
      const broadCat = categories[toy.category] || "Otros";
      if (!groups[broadCat]) groups[broadCat] = [];
      groups[broadCat].push(toy);
    });
    return groups;
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto w-full">
      {isSaving && <LoadingScreen message="Registrando nueva modelo en el sistema..." fullPage />}
      
      {/* Definition Modal/Popover Overlay */}
      {activeDefinition && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setActiveDefinition(null)}
        >
          <div 
            className="bg-sidebar-dark border border-primary/30 p-8 rounded-2xl max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h5 className="text-xl font-display font-bold text-accent-gold">{activeDefinition.term}</h5>
              <button 
                onClick={() => setActiveDefinition(null)}
                className="size-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-slate-300 leading-relaxed italic border-l-2 border-primary/50 pl-4">
              "{activeDefinition.definition}"
            </p>
          </div>
        </div>
      )}
      {/* Toy Info Modal */}
      {activeToy && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setActiveToy(null)}
        >
          <div 
            className="bg-sidebar-dark border border-primary/30 p-8 rounded-2xl max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">vibration</span>
                </div>
                <div>
                  <h5 className="text-xl font-display font-bold text-accent-gold">{activeToy.name}</h5>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{activeToy.category}</span>
                </div>
              </div>
              <button 
                onClick={() => setActiveToy(null)}
                className="size-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Uso Sugerido</p>
                <p className="text-slate-200 text-sm leading-relaxed">{activeToy.use}</p>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Categoría</p>
                <p className="text-slate-200 text-sm">{activeToy.category}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Outfit Info Modal */}
      {activeOutfit && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setActiveOutfit(null)}
        >
          <div 
            className="bg-sidebar-dark border border-primary/30 p-8 rounded-2xl max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">apparel</span>
                </div>
                <div>
                  <h5 className="text-xl font-display font-bold text-accent-gold">{activeOutfit.name}</h5>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Lencería & Trajes</span>
                </div>
              </div>
              <button 
                onClick={() => setActiveOutfit(null)}
                className="size-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="bg-white/5 p-5 rounded-2xl border border-white/5 italic text-slate-300 leading-relaxed">
              "{activeOutfit.description}"
            </div>
          </div>
        </div>
      )}
      {/* Hashtag Info Modal */}
      {activeHashtag && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setActiveHashtag(null)}
        >
          <div 
            className="bg-sidebar-dark border border-primary/30 p-8 rounded-2xl max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black text-primary">#</span>
                <h5 className="text-xl font-display font-bold text-accent-gold">{activeHashtag.tag}</h5>
              </div>
              <button 
                onClick={() => setActiveHashtag(null)}
                className="size-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="bg-white/5 p-5 rounded-2xl border border-white/5 italic text-slate-300 leading-relaxed">
              "{activeHashtag.description}"
            </div>
          </div>
        </div>
      )}

      {/* Save Notification Toast */}
      {saveStatus && (
        <div className="fixed top-8 right-8 z-[110] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/20">
            <span className="material-symbols-outlined">check_circle</span>
            <span className="font-bold text-sm">{saveStatus}</span>
          </div>
        </div>
      )}

      <div className="mb-10 lg:flex items-start justify-between gap-10">
        <div className="flex-1">
          <h3 className="font-display text-4xl font-extrabold mb-2 bg-gradient-to-r from-primary to-accent-gold bg-clip-text text-transparent">
            Registro de modelo
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Completa el perfilamiento para registrar una nueva modelo en el estudio. La información detallada ayuda a un mejor posicionamiento.
          </p>
          
          <div className="bg-primary/5 dark:bg-primary/10 border border-slate-200 dark:border-primary/20 rounded-2xl p-6 flex items-center gap-6 shadow-sm">
            <div className="relative h-20 w-20 flex-shrink-0">
              <svg className="h-full w-full" viewBox="0 0 36 36">
                <path className="stroke-slate-200 dark:stroke-primary/10 fill-none" strokeWidth="3" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="stroke-primary fill-none transition-all duration-1000 ease-out" 
                      strokeDasharray={`${progress}, 100`} 
                      strokeWidth="3" 
                      strokeLinecap="round" 
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-black text-slate-800 dark:text-white">{progress}%</span>
              </div>
            </div>
            <div>
              <h5 className="font-bold text-slate-900 dark:text-white mb-1">Indicador de Progreso</h5>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                {progress < 100 
                  ? "Este porcentaje refleja qué tan completo está el perfil técnico de la modelo para las plataformas." 
                  : "¡Perfil optimizado al máximo! Estás lista para finalizar el registro."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <form className="space-y-8 pb-20">
        {/* Section 1: General Information */}
        <section className="bg-white dark:bg-sidebar-dark/50 rounded-2xl border border-slate-200 dark:border-primary/20 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white font-bold text-sm">1</span>
            <h4 className="font-display text-xl font-bold text-slate-900 dark:text-white">Información General</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-slate-500">Seleccionar Modelo (Desde Base Central)</label>
              <div className="relative">
                <select 
                  value={selectedModelId}
                  onChange={(e) => handleModelSelect(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-background-dark border-slate-200 dark:border-primary/20 rounded-xl px-4 py-3 focus:ring-primary focus:border-primary transition-all text-slate-900 dark:text-white appearance-none outline-none font-bold"
                >
                  <option value="">-- Seleccionar una modelo --</option>
                  {existingModels.sort((a,b) => a.name.localeCompare(b.name)).map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name} {model.nickname ? `(@${model.nickname})` : ''}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">expand_more</span>
              </div>
              <p className="text-[10px] text-slate-400 italic">Nota: Las modelos deben ser creadas previamente en la aplicación central 7288e.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500">Nombre Real</label>
              <input 
                value={generalInfo.realName}
                onChange={(e) => handleGeneralInfoChange('realName', e.target.value)}
                readOnly
                className="w-full bg-slate-100 dark:bg-background-dark/30 border-slate-200 dark:border-primary/10 rounded-xl px-4 py-3 text-slate-400 cursor-not-allowed" 
                placeholder="Se cargará automáticamente" 
                type="text"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500">Nombre Artístico</label>
              <input 
                value={generalInfo.artisticName}
                onChange={(e) => handleGeneralInfoChange('artisticName', e.target.value)}
                readOnly
                className="w-full bg-slate-100 dark:bg-background-dark/30 border-slate-200 dark:border-primary/10 rounded-xl px-4 py-3 text-slate-400 cursor-not-allowed" 
                placeholder="Se cargará automáticamente" 
                type="text"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500">Edad</label>
              <input 
                value={generalInfo.age}
                onChange={(e) => handleGeneralInfoChange('age', e.target.value)}
                className="w-full bg-slate-50 dark:bg-background-dark border-slate-200 dark:border-primary/20 rounded-xl px-4 py-3 focus:ring-primary focus:border-primary transition-all text-slate-900 dark:text-white" 
                placeholder="Debe ser mayor de 18" 
                type="number"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500">Tiempo de Experiencia</label>
              <select 
                value={generalInfo.experience}
                onChange={(e) => handleGeneralInfoChange('experience', e.target.value)}
                className="w-full bg-slate-50 dark:bg-background-dark border-slate-200 dark:border-primary/20 rounded-xl px-4 py-3 focus:ring-primary focus:border-primary transition-all text-slate-900 dark:text-white outline-none"
              >
                <option value="nuevo">Nueva / Sin experiencia</option>
                <option value="1-6">1 a 6 meses</option>
                <option value="6-12">6 meses a 1 año</option>
                <option value="1-2">1 a 2 años</option>
                <option value="more">Más de 2 años</option>
              </select>
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-slate-500">Plataformas Objetivo</label>
              <div className="flex flex-wrap gap-4 mt-2">
                {[...platforms, ...generalInfo.targetPlatforms]
                  .reduce((acc: string[], curr) => {
                    if (!acc.some(p => p.toLowerCase() === curr.toLowerCase())) acc.push(curr);
                    return acc;
                  }, [])
                  .map((platform) => {
                    const isChecked = generalInfo.targetPlatforms.some(p => p.toLowerCase() === platform.toLowerCase());
                    return (
                      <label 
                        key={platform} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border ${
                          isChecked 
                            ? "bg-primary/20 border-primary shadow-sm" 
                            : "bg-slate-100 dark:bg-primary/10 border-transparent hover:border-primary/30"
                        } ${selectedModelId ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                      >
                        <input 
                          type="checkbox" 
                          className="rounded text-primary focus:ring-primary bg-transparent border-slate-400 disabled:opacity-50"
                          checked={isChecked}
                          onChange={() => !selectedModelId && togglePlatform(platform)}
                          disabled={!!selectedModelId}
                        />
                        <span className={`text-sm font-medium transition-colors ${
                          isChecked ? "text-primary font-bold" : "text-slate-600 dark:text-slate-300"
                        }`}>{platform}</span>
                      </label>
                    );
                  })}
              </div>
            </div>

            {/* Platform Integration APIs Section */}
            {generalInfo.targetPlatforms.length > 0 && (
              <div className="md:col-span-2 mt-8 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-accent-gold">api</span>
                  <h5 className="text-sm font-black uppercase tracking-widest text-white">Configuración de integración API</h5>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {generalInfo.targetPlatforms.map((platform) => {
                    const isApiEnabled = apiEnabledPlatforms.includes(platform);
                    return (
                      <div key={platform} className={`p-5 rounded-2xl border transition-all ${
                        isApiEnabled 
                          ? "bg-slate-900/40 border-primary/30 shadow-lg shadow-primary/5" 
                          : "bg-slate-900/10 border-slate-800 opacity-60 grayscale"
                      }`}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary text-xl">
                              {platform.toLowerCase() === 'chaturbate' ? 'videocam' : 'stars'}
                            </span>
                            <h6 className="font-bold text-white tracking-wide">{platform}</h6>
                          </div>
                          
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-primary focus:ring-primary/50"
                              checked={isApiEnabled}
                              onChange={() => {
                                setApiEnabledPlatforms(prev => 
                                  prev.includes(platform) 
                                    ? prev.filter(p => p !== platform) 
                                    : [...prev, platform]
                                );
                              }}
                            />
                            <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400 group-hover:text-primary transition-colors">
                              Usar API
                            </span>
                          </label>
                        </div>
                        
                        {isApiEnabled ? (
                          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                            <div>
                              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 ml-1">Usuario / ID</label>
                              <input 
                                type="text"
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:ring-1 focus:ring-primary ring-offset-0 outline-none transition-all"
                                placeholder={`Usuario en ${platform}`}
                                value={platformCredentials[platform]?.username || ""}
                                onChange={(e) => setPlatformCredentials(prev => ({
                                  ...prev,
                                  [platform]: { ...prev[platform], username: e.target.value }
                                }))}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 ml-1">Clave API</label>
                              <div className="relative">
                                <input 
                                  type="password"
                                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:ring-1 focus:ring-primary ring-offset-0 outline-none transition-all pr-10"
                                  placeholder="••••••••••••••••"
                                  value={platformCredentials[platform]?.apiKey || ""}
                                  onChange={(e) => setPlatformCredentials(prev => ({
                                    ...prev,
                                    [platform]: { ...prev[platform], apiKey: e.target.value }
                                  }))}
                                />
                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 text-sm">key</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="h-24 flex items-center justify-center border border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                            <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Integración desactivada</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-primary/10 flex justify-end">
            <button 
              type="button"
              onClick={() => handleSectionSave("Perfil general")}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-primary text-white rounded-xl text-sm font-bold hover:scale-[1.02] transition-all active:scale-95 shadow-lg shadow-slate-900/10 dark:shadow-primary/20"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              Guardar Información General
            </button>
          </div>
        </section>

        {/* Section 2: Physical Attributes */}
        <section className="bg-white dark:bg-sidebar-dark/50 rounded-2xl border border-slate-200 dark:border-primary/20 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white font-bold text-sm">2</span>
            <h4 className="font-display text-xl font-bold dark:text-white text-slate-900">Atributos Físicos</h4>
          </div>

          <div className="space-y-10">
            {attributesData.map((attr) => (
              <div key={attr.category} className="space-y-4">
                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider block">
                  {attr.category}
                </label>
                <div className="flex flex-wrap gap-2">
                  {attr.options.map((option) => {
                    const isSelected = physicalAttributes[attr.category] === option;
                    return (
                      <button 
                        key={option}
                        type="button"
                        onClick={() => selectAttribute(attr.category, option)}
                        className={`px-5 py-2 rounded-full border text-sm font-medium transition-all ${
                          isSelected 
                            ? "border-primary bg-primary text-white shadow-lg shadow-primary/20" 
                            : "border-slate-300 dark:border-primary/20 text-slate-600 dark:text-slate-300 hover:border-primary/30 hover:bg-primary/5"
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-primary/10 flex justify-end">
            <button 
              type="button"
              onClick={() => handleSectionSave("Atributos físicos")}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-primary text-white rounded-xl text-sm font-bold hover:scale-[1.02] transition-all active:scale-95 shadow-lg shadow-slate-900/10 dark:shadow-primary/20"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              Guardar Atributos
            </button>
          </div>
        </section>

        {/* Section 3: Kinks & Skills (Sexionario Content) */}
        <section className="bg-white dark:bg-sidebar-dark/50 rounded-2xl border border-slate-200 dark:border-primary/20 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white font-bold text-sm">3</span>
            <h4 className="font-display text-xl font-bold dark:text-white text-slate-900">Kinks & Habilidades (Sexionario)</h4>
          </div>
          <p className="text-sm text-slate-400 mb-6">Selecciona todos los términos del sexionario que definen el perfil de la modelo.</p>
          <div className="flex flex-wrap gap-4 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
            {glossaryData.map((item) => (
              <div key={item.term} className="flex items-center gap-2 group">
                <button
                  type="button"
                  onClick={() => toggleKink(item.term)}
                  className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all flex items-center gap-2 ${
                    selectedKinks.includes(item.term)
                      ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                      : "border-slate-300 dark:border-primary/20 text-slate-600 dark:text-slate-300 hover:border-primary/50"
                  }`}
                >
                  {item.term}
                  {selectedKinks.includes(item.term) && (
                    <span className="material-symbols-outlined text-xs">check</span>
                  )}
                </button>
                <button 
                  type="button"
                  onClick={() => setActiveDefinition(item)}
                  className="size-6 rounded-full border border-primary/20 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-sm"
                  title="Ver definición"
                >
                  <span className="material-symbols-outlined text-[14px]">help</span>
                </button>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-primary/10 flex justify-end">
            <button 
              type="button"
              onClick={() => handleSectionSave("Kinks & Habilidades")}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-primary text-white rounded-xl text-sm font-bold hover:scale-[1.02] transition-all active:scale-95 shadow-lg shadow-slate-900/10 dark:shadow-primary/20"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              Guardar Sexionario
            </button>
          </div>
        </section>

        {/* Section 4: Toy Inventory */}
        <section className="bg-white dark:bg-sidebar-dark/50 rounded-2xl border border-slate-200 dark:border-primary/20 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white font-bold text-sm">4</span>
            <h4 className="font-display text-xl font-bold dark:text-white text-slate-900">Inventario de Juguetes</h4>
          </div>
          
          <div className="space-y-12">
            {Object.entries(groupedToys).map(([category, toys]) => (
              <div key={category} className="space-y-5">
                <div className="flex items-center gap-4">
                  <h5 className="text-[10px] font-black uppercase tracking-[0.25em] text-primary bg-primary/10 px-3 py-1 rounded-full whitespace-nowrap">
                    {category}
                  </h5>
                  <div className="h-px bg-slate-200 dark:bg-primary/10 w-full"></div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {toys.map((toy) => (
                    <div 
                      key={toy.name} 
                      className={`flex items-center gap-2 p-2 px-3 rounded-xl border transition-all group relative ${
                        selectedToys.includes(toy.name)
                          ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
                          : "border-slate-100 dark:border-primary/10 hover:border-primary/40 bg-slate-50/50 dark:bg-transparent"
                      }`}
                    >
                      <div 
                        className="flex items-center gap-2 flex-1 cursor-pointer overflow-hidden" 
                        onClick={() => toggleToy(toy.name)}
                      >
                        <div className={`size-7 shrink-0 rounded-lg flex items-center justify-center transition-colors ${
                          selectedToys.includes(toy.name) ? "bg-primary text-white" : "bg-slate-200 dark:bg-background-dark text-slate-500"
                        }`}>
                          <span className="material-symbols-outlined text-base">vibration</span>
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className={`text-[11px] font-bold truncate transition-colors ${
                            selectedToys.includes(toy.name) ? "text-slate-900 dark:text-white" : "text-slate-500"
                          }`}>
                            {toy.name}
                          </span>
                          {toy.brand === "Lovense" && (
                            <span className="text-[8px] font-black text-primary uppercase tracking-tighter">
                              Lovense
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <button 
                        type="button"
                        onClick={() => setActiveToy(toy)}
                        className="size-6 shrink-0 rounded-full hover:bg-primary/20 text-primary/40 hover:text-primary transition-all flex items-center justify-center"
                        title="Ver info"
                      >
                        <span className="material-symbols-outlined text-[14px]">info</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-primary/10 flex justify-end">
            <button 
              type="button"
              onClick={() => handleSectionSave("Inventario de juguetes")}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-primary text-white rounded-xl text-sm font-bold hover:scale-[1.02] transition-all active:scale-95 shadow-lg shadow-slate-900/10 dark:shadow-primary/20"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              Guardar Inventario
            </button>
          </div>
        </section>

        {/* Section 5: Lingerie, Outfits & Cosplay */}
        <section className="bg-white dark:bg-sidebar-dark/50 rounded-2xl border border-slate-200 dark:border-primary/20 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white font-bold text-sm">5</span>
            <h4 className="font-display text-xl font-bold dark:text-white text-slate-900">Lencería, Trajes y Cosplay</h4>
          </div>
          
          <div className="space-y-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {outfitsData.map((outfit) => {
                const isSelected = selectedOutfits.includes(outfit.name);
                return (
                  <div 
                    key={outfit.name} 
                    className={`flex items-center gap-2 p-2 px-3 rounded-xl border transition-all group relative ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
                        : "border-slate-100 dark:border-primary/10 hover:border-primary/40 bg-slate-50/50 dark:bg-transparent"
                    }`}
                  >
                    <div 
                      className="flex items-center gap-2 flex-1 cursor-pointer overflow-hidden" 
                      onClick={() => toggleOutfit(outfit.name)}
                    >
                      <div className={`size-7 shrink-0 rounded-lg flex items-center justify-center transition-colors ${
                        isSelected ? "bg-primary text-white" : "bg-slate-200 dark:bg-background-dark text-slate-500"
                      }`}>
                        <span className="material-symbols-outlined text-base">apparel</span>
                      </div>
                      <span className={`text-[11px] font-bold truncate transition-colors ${
                        isSelected ? "text-slate-900 dark:text-white" : "text-slate-500"
                      }`}>
                        {outfit.name}
                      </span>
                    </div>
                    
                    <button 
                      type="button"
                      onClick={() => setActiveOutfit(outfit)}
                      className="size-6 shrink-0 rounded-full hover:bg-primary/20 text-primary/40 hover:text-primary transition-all flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined text-[14px]">info</span>
                    </button>
                  </div>
                );
              })}

              {customOutfits.map((outfit) => (
                <div 
                  key={outfit} 
                  className="flex items-center gap-2 p-2 px-3 rounded-xl border border-primary bg-primary/5 shadow-md shadow-primary/5 scale-[1.02] transition-all"
                >
                  <div 
                    className="flex items-center gap-2 flex-1 cursor-pointer overflow-hidden" 
                    onClick={() => toggleOutfit(outfit)}
                  >
                    <div className="size-7 shrink-0 rounded-lg flex items-center justify-center bg-primary text-white">
                      <span className="material-symbols-outlined text-base">auto_fix</span>
                    </div>
                    <span className="text-[11px] font-bold truncate text-slate-900 dark:text-white">
                      {outfit}
                    </span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      setCustomOutfits(prev => prev.filter(o => o !== outfit));
                      setSelectedOutfits(prev => prev.filter(o => o !== outfit));
                    }}
                    className="size-6 shrink-0 rounded-full hover:bg-red-500/10 text-red-500 transition-all flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Others Input */}
            <div className="mt-8 p-6 rounded-2xl bg-slate-50 dark:bg-primary/5 border border-dashed border-slate-300 dark:border-primary/20">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">add_circle</span>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500">¿Tienes otros trajes?</label>
                </div>
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    value={otherOutfitInput}
                    onChange={(e) => setOtherOutfitInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomOutfit())}
                    placeholder="Escribe el nombre del traje y presiona Enter..."
                    className="flex-1 bg-white dark:bg-background-dark border border-slate-200 dark:border-primary/20 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                  <button 
                    type="button"
                    onClick={addCustomOutfit}
                    className="px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-primary/10 flex justify-end">
            <button 
              type="button"
              onClick={() => handleSectionSave("Vestuario")}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-primary text-white rounded-xl text-sm font-bold hover:scale-[1.02] transition-all active:scale-95 shadow-lg shadow-slate-900/10 dark:shadow-primary/20"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              Guardar Vestuario
            </button>
          </div>
        </section>

        {/* Section 6: #Hashtags */}
        <section className="bg-white dark:bg-sidebar-dark/50 rounded-2xl border border-slate-200 dark:border-primary/20 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center size-8 rounded-full bg-primary text-white font-bold text-sm">6</span>
              <h4 className="font-display text-xl font-bold dark:text-white text-slate-900">#Hashtags Sugeridos</h4>
            </div>
            <div className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${
              selectedHashtags.length === 5 ? "bg-accent-gold/20 text-accent-gold" : "bg-slate-100 dark:bg-primary/10 text-slate-500"
            }`}>
              {selectedHashtags.length}/5 Seleccionados
            </div>
          </div>
          
          <p className="text-sm text-slate-400 mb-6 italic">
            Selecciona hasta 5 etiquetas principales para el posicionamiento en buscadores y plataformas.
          </p>

          <div className="flex flex-wrap gap-3">
            {hashtagsData.map((item) => {
              const isSelected = selectedHashtags.includes(item.tag);
              const isLimitReached = selectedHashtags.length >= 5;
              
              return (
                <div key={item.tag} className="flex items-center gap-1">
                  <button 
                    type="button"
                    disabled={!isSelected && isLimitReached}
                    onClick={() => toggleHashtag(item.tag)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${
                      isSelected 
                        ? "border-primary bg-primary text-white shadow-lg shadow-primary/20" 
                        : !isSelected && isLimitReached
                          ? "opacity-30 cursor-not-allowed border-slate-200 dark:border-primary/5 text-slate-400"
                          : "border-slate-200 dark:border-primary/20 text-slate-600 dark:text-slate-400 hover:border-primary/50 hover:bg-primary/5"
                    }`}
                  >
                    {item.tag}
                    {isSelected && <span className="material-symbols-outlined text-[14px]">check_circle</span>}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setActiveHashtag(item)}
                    className="size-8 rounded-full hover:bg-primary/10 flex items-center justify-center text-primary/40 hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">help</span>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-primary/10 flex justify-end">
            <button 
              type="button"
              onClick={() => handleSectionSave("Hashtags")}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-primary text-white rounded-xl text-sm font-bold hover:scale-[1.02] transition-all active:scale-95 shadow-lg shadow-slate-900/10 dark:shadow-primary/20"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              Guardar #Hashtags
            </button>
          </div>
        </section>

        <div className="flex items-center justify-between pt-10 border-t border-slate-200 dark:border-primary/20">
          <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-primary font-bold transition-all">
            <span className="material-symbols-outlined">arrow_back</span>
            Cancelar
          </Link>
          <button 
            type="button"
            onClick={async () => {
              if (!selectedModelId) {
                alert("Debes seleccionar una modelo de la lista.");
                return;
              }
              setIsSaving(true);
              try {
                const profileData = {
                  modelId: selectedModelId,
                  generalInfo,
                  credentials: platformCredentials,
                  physicalAttributes,
                  selectedKinks,
                  selectedToys,
                   selectedHashtags,
                   selectedOutfits,
                   customOutfits,
                   apiEnabledPlatforms,
                   progress,
                   updatedAt: new Date().toISOString()
                };

                // Guardar en la colección principal con merge para no sobrescribir info accidentalmente
                await setDoc(doc(db, "modelos_profile_v2", selectedModelId), profileData, { merge: true });
                
                // Guardar snapshot histórico
                await saveProfileHistory(selectedModelId, profileData);

                setSaveStatus("¡Información guardada y sincronizada correctamente!");
                setTimeout(() => router.push("/"), 2000);
              } catch (e) {
                alert("Error al guardar: " + e);
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-10 py-4 rounded-xl font-black shadow-xl shadow-primary/20 transition-all font-sans disabled:opacity-50"
          >
            {isSaving ? "Registrando..." : "Finalizar registro"}
            <span className="material-symbols-outlined">save</span>
          </button>
        </div>
      </form>
    </div>
  );
}
