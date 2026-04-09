"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { saveProfileHistory } from "@/lib/history";
import glossaryData from "@/data/glossary.json";
import toysData from "@/data/toys.json";
import attributesData from "@/data/attributes.json";
import hashtagsData from "@/data/hashtags.json";
import outfitsData from "@/data/outfits.json";
import { usePlatforms } from "@/context/PlatformContext";
import LoadingScreen from "@/components/common/LoadingScreen";
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
  const [otherOutfitInput, setOtherOutfitInput] = useState("");
  
  const [generalInfo, setGeneralInfo] = useState({
    realName: "",
    artisticName: "",
    age: "",
    experience: "nuevo",
    targetPlatforms: [] as string[]
  });
  
  const [platformCredentials, setPlatformCredentials] = useState<{[key: string]: { apiKey: string, username: string, apiSecret?: string }}>({});
  const [platformAliases, setPlatformAliases] = useState<{[key: string]: string[]}>({ "Chaturbate": [], "Stripchat": [] });
  const [apiEnabledPlatforms, setApiEnabledPlatforms] = useState<string[]>([]);
  const [physicalAttributes, setPhysicalAttributes] = useState<{[key: string]: string}>({});
  const [activeDefinition, setActiveDefinition] = useState<GlossaryItem | null>(null);
  const [activeToy, setActiveToy] = useState<ToyItem | null>(null);
  const [activeHashtag, setActiveHashtag] = useState<HashtagItem | null>(null);
  const [activeOutfit, setActiveOutfit] = useState<OutfitItem | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newAliasInputs, setNewAliasInputs] = useState<{[key: string]: string}>({ "Chaturbate": "", "Stripchat": "" });

  useEffect(() => {
    async function loadModelData() {
      if (!id) return;
      try {
        setLoading(true);
        // Load basic data from 'models'
        const modelRef = doc(db, "models", id);
        const modelSnap = await getDoc(modelRef);
        
        let initialPlatforms: string[] = [];
        if (modelSnap.exists()) {
          const data = modelSnap.data();
          initialPlatforms = data.platforms || [];
          setGeneralInfo(prev => ({
            ...prev,
            artisticName: data.nickname || data.name || "",
            realName: data.fullName || data.name || "",
            experience: data.experience || "nuevo",
            targetPlatforms: initialPlatforms
          }));
        }

        // Load extended profiling from 'modelos_profile_v2'
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
          if (pData.platformAliases) setPlatformAliases(prev => ({ ...prev, ...pData.platformAliases }));
          if (pData.apiEnabledPlatforms) setApiEnabledPlatforms(pData.apiEnabledPlatforms);
          else setApiEnabledPlatforms(initialPlatforms);

          if (pData.generalInfo) {
            setGeneralInfo(prev => ({
              ...prev,
              age: pData.generalInfo.age || prev.age,
              experience: pData.generalInfo.experience || prev.experience,
              artisticName: pData.generalInfo.artisticName || prev.artisticName
            }));
          }
        } else {
          setApiEnabledPlatforms(initialPlatforms);
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
      apiEnabledPlatforms,
      age: generalInfo.age,
      experience: generalInfo.experience
    });
  }, [physicalAttributes, platformCredentials, selectedKinks, selectedToys, selectedOutfits, selectedHashtags, generalInfo, apiEnabledPlatforms]);

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
        platformAliases,
        apiEnabledPlatforms,
        generalInfo,
        progress: progress 
      };

      await setDoc(profileRef, profileData, { merge: true });
      await saveProfileHistory(id, profileData);
      
      setSaveStatus("¡Perfil actualizado correctamente!");
      setTimeout(() => {
        router.push(`/models/profile?id=${id}`);
      }, 2000);
    } catch (err) {
        alert("Error al actualizar: " + err);
    } finally {
        setIsSaving(false);
    }
  };

  const handleGeneralInfoChange = (field: string, value: any) => {
    setGeneralInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleCredentialChange = (platform: string, field: string, value: string) => {
    setPlatformCredentials(prev => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value }
    }));
  };

  const addAlias = (platform: string) => {
    const val = newAliasInputs[platform]?.trim();
    if (!val) return;
    setPlatformAliases(prev => ({
      ...prev,
      [platform]: Array.from(new Set([...(prev[platform] || []), val]))
    }));
    setNewAliasInputs(prev => ({ ...prev, [platform]: "" }));
  };

  const removeAlias = (platform: string, alias: string) => {
    setPlatformAliases(prev => ({
      ...prev,
      [platform]: prev[platform].filter(a => a !== alias)
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

  if (loading) return <LoadingScreen message="Recuperando perfilamiento..." />;
  if (!id) return <div className="p-10 text-white text-center">ID de modelo no proporcionado.</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto w-full animate-in fade-in duration-500">
      {isSaving && <LoadingScreen message="Actualizando base de datos central..." fullPage />}
      
      {/* Modals */}
      {activeDefinition && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setActiveDefinition(null)}>
          <div className="bg-sidebar-dark border border-primary/30 p-8 rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h5 className="text-xl font-bold text-accent-gold mb-4">{activeDefinition.term}</h5>
            <p className="text-slate-300 italic border-l-2 border-primary/50 pl-4">"{activeDefinition.definition}"</p>
          </div>
        </div>
      )}

      {activeToy && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setActiveToy(null)}>
          <div className="bg-sidebar-dark border border-primary/30 p-8 rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h5 className="text-xl font-bold text-accent-gold mb-4">{activeToy.name}</h5>
            <p className="text-slate-300 italic border-l-2 border-primary/50 pl-4 mb-4">"{activeToy.use}"</p>
            <span className="text-[10px] font-black uppercase text-primary tracking-widest bg-primary/10 px-3 py-1 rounded-full">{activeToy.category}</span>
          </div>
        </div>
      )}

      {activeHashtag && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setActiveHashtag(null)}>
          <div className="bg-sidebar-dark border border-primary/30 p-8 rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h5 className="text-xl font-bold text-accent-gold mb-4">{activeHashtag.tag}</h5>
            <p className="text-slate-300 italic border-l-2 border-primary/50 pl-4">"{activeHashtag.description}"</p>
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
            <h3 className="font-display text-4xl font-black text-white">Completar Perfil</h3>
            <p className="text-slate-400 mb-6">Optimiza el perfilamiento de {generalInfo.artisticName} para el algoritmo WooW.</p>
            
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
                <h5 className="font-bold text-white mb-1">Indicador de Progreso</h5>
                <p className="text-xs text-slate-400 max-w-xs">{progress < 100 ? 'Completa todas las secciones para llegar al 100% y mejorar el WooW Rating.' : '¡Excelente! Perfil completado al 100%.'}</p>
              </div>
            </div>
        </div>
        <button 
            onClick={handleUpdateProfile}
            disabled={isSaving}
            className="px-8 py-4 bg-primary text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 mt-4 lg:mt-0"
        >
            {isSaving ? "Guardando..." : "Finalizar Edición"}
        </button>
      </div>

      <div className="space-y-12 pb-32">
        {/* INFO GENERAL */}
        <section className="bg-sidebar-dark/50 rounded-3xl border border-primary/20 p-8">
            <h4 className="font-bold text-white text-lg mb-6 flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">person</span>
                Información del Perfil
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Edad</label>
                    <input 
                        type="number"
                        value={generalInfo.age}
                        onChange={(e) => handleGeneralInfoChange('age', e.target.value)}
                        placeholder="Ej: 22"
                        className="w-full bg-background-dark/50 border border-primary/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Experiencia</label>
                    <select 
                        value={generalInfo.experience}
                        onChange={(e) => handleGeneralInfoChange('experience', e.target.value)}
                        className="w-full bg-background-dark/50 border border-primary/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-colors"
                    >
                        <option value="nuevo">Nueva / Sin experiencia</option>
                        <option value="1-6">1 a 6 meses</option>
                        <option value="6-12">6 meses a 1 año</option>
                        <option value="1-2">1 a 2 años</option>
                        <option value="more">Más de 2 años</option>
                    </select>
                </div>
            </div>
        </section>

        {/* PLATAFORMAS */}
        <section className="bg-sidebar-dark/50 rounded-3xl border border-primary/20 p-8">
            <h4 className="font-bold text-white text-lg mb-6 flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">api</span>
                Sincronización & APIs
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {generalInfo.targetPlatforms.map((platform) => {
                    const isApiEnabled = apiEnabledPlatforms.includes(platform);
                    return (
                        <div key={platform} className={`bg-white/5 border rounded-2xl p-6 transition-all ${isApiEnabled ? 'border-primary/40 shadow-lg shadow-primary/5' : 'border-white/10 opacity-60'}`}>
                            <div className="flex items-center justify-between mb-6">
                                <p className="font-bold text-white text-lg">{platform}</p>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div className="relative">
                                        <input 
                                            type="checkbox" 
                                            className="peer sr-only"
                                            checked={isApiEnabled}
                                            onChange={() => setApiEnabledPlatforms(prev => 
                                                prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
                                            )}
                                        />
                                        <div className="w-10 h-5 bg-slate-800 rounded-full peer-checked:bg-primary transition-all"></div>
                                        <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full peer-checked:translate-x-5 transition-all"></div>
                                    </div>
                                    <span className="text-[10px] font-black uppercase text-slate-500">API</span>
                                </label>
                            </div>

                            <div className="bg-primary/5 rounded-xl border border-primary/10 p-4 mb-4">
                                <label className="text-[9px] font-black text-primary uppercase block mb-2">Apodos en Drive (Alias)</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text"
                                        value={newAliasInputs[platform] || ""}
                                        onChange={(e) => setNewAliasInputs(prev => ({ ...prev, [platform]: e.target.value }))}
                                        onKeyDown={(e) => e.key === 'Enter' && addAlias(platform)}
                                        placeholder="Alias en carpeta"
                                        className="flex-1 bg-background-dark/50 border border-primary/10 rounded-lg px-3 py-2 text-xs text-white"
                                    />
                                    <button onClick={() => addAlias(platform)} className="bg-primary text-white px-3 rounded-lg"><span className="material-symbols-outlined text-sm">add</span></button>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {platformAliases[platform]?.map(alias => (
                                        <span key={alias} className="flex items-center gap-1.5 bg-primary/20 px-2 py-1 rounded-lg text-[10px] font-bold text-white">
                                            {alias}
                                            <button onClick={() => removeAlias(platform, alias)} className="hover:text-red-400"><span className="material-symbols-outlined text-[14px]">close</span></button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {isApiEnabled && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <input 
                                        type="text" 
                                        value={platformCredentials[platform]?.username || ""}
                                        onChange={(e) => handleCredentialChange(platform, 'username', e.target.value)}
                                        placeholder="Username / Email API"
                                        className="w-full bg-background-dark/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                                    />
                                    <input 
                                        type="password" 
                                        value={platformCredentials[platform]?.apiKey || ""}
                                        onChange={(e) => handleCredentialChange(platform, 'apiKey', e.target.value)}
                                        placeholder="API Key / Token"
                                        className="w-full bg-background-dark/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                                    />
                                </div>
                            )}
                        </div>
                    );
                  })}
            </div>
        </section>

        {/* ATRIBUTOS */}
        <section className="bg-sidebar-dark/50 rounded-3xl border border-primary/20 p-8">
            <h4 className="font-bold text-white text-lg mb-6">Atributos Físicos</h4>
            <div className="space-y-8">
                {attributesData.map((attr) => (
                    <div key={attr.category}>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4">{attr.category}</label>
                        <div className="flex flex-wrap gap-2">
                             {attr.options.map((option) => {
                                const isSelected = physicalAttributes[attr.category] === option;
                                return (
                                    <button 
                                        key={option}
                                        type="button"
                                        onClick={() => selectAttribute(attr.category, option)}
                                        className={`px-5 py-2 rounded-xl border text-xs font-bold transition-all ${
                                            isSelected 
                                            ? "bg-primary border-primary text-white shadow-lg shadow-primary/20" 
                                            : "border-white/10 text-slate-500 hover:border-primary/50"
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
        </section>

        {/* SEXIONARIO */}
        <section className="bg-sidebar-dark/50 rounded-3xl border border-primary/20 p-8">
            <h4 className="font-bold text-white text-lg mb-6">Sexionario (Kinks & Skills)</h4>
            <div className="flex flex-wrap gap-3 max-h-[300px] overflow-y-auto pr-4 custom-scrollbar">
                {glossaryData.map(item => (
                    <div key={item.term} className="flex items-center gap-2">
                        <button 
                            onClick={() => toggleKink(item.term)}
                            className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 ${
                                selectedKinks.includes(item.term) ? "bg-primary border-primary text-white" : "border-white/10 text-slate-500"
                            }`}
                        >
                            {item.term}
                            {selectedKinks.includes(item.term) && <span className="material-symbols-outlined text-[14px]">check</span>}
                        </button>
                        <button onClick={() => setActiveDefinition(item)} className="text-primary/40 hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-sm">help</span>
                        </button>
                    </div>
                ))}
            </div>
        </section>

        {/* TOYS */}
        <section className="bg-sidebar-dark/50 rounded-3xl border border-primary/20 p-8">
            <h4 className="font-bold text-white text-lg mb-6">Inventario de Juguetes</h4>
            <div className="space-y-10">
                {Object.entries(groupedToys).map(([cat, toys]) => (
                    <div key={cat} className="space-y-4">
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 px-3 py-1 rounded-full inline-block">{cat}</p>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {toys.map(toy => (
                                <div 
                                    key={toy.name}
                                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                        selectedToys.includes(toy.name) ? "bg-primary/10 border-primary/50" : "bg-white/5 border-white/5"
                                    }`}
                                >
                                    <button 
                                        onClick={() => toggleToy(toy.name)}
                                        className={`flex-1 text-left text-[11px] font-bold ${selectedToys.includes(toy.name) ? "text-white" : "text-slate-500"}`}
                                    >
                                        {toy.name}
                                    </button>
                                    <button onClick={() => setActiveToy(toy)} className="text-primary/30 hover:text-primary">
                                        <span className="material-symbols-outlined text-sm">info</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>

        {/* OUTFITS */}
        <section className="bg-sidebar-dark/50 rounded-3xl border border-primary/20 p-8">
            <h4 className="font-bold text-white text-lg mb-6">Lencería & Trajes</h4>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                {outfitsData.map(outfit => (
                    <button 
                        key={outfit.name} 
                        onClick={() => toggleOutfit(outfit.name)}
                        className={`p-3 rounded-xl border text-[11px] font-bold text-left transition-all ${
                            selectedOutfits.includes(outfit.name) ? "bg-primary/20 border-primary text-white" : "bg-white/5 border-white/5 text-slate-500"
                        }`}
                    >
                        {outfit.name}
                    </button>
                ))}
                {customOutfits.map(outfit => (
                    <div key={outfit} className="flex items-center bg-primary/30 border border-primary/50 p-3 rounded-xl">
                        <span className="flex-1 text-[11px] font-bold text-white">{outfit}</span>
                        <button onClick={() => setCustomOutfits(prev => prev.filter(o => o !== outfit))} className="text-white/40 hover:text-red-400"><span className="material-symbols-outlined text-sm">close</span></button>
                    </div>
                ))}
            </div>
            <div className="flex gap-2">
                <input 
                    type="text" 
                    value={otherOutfitInput}
                    onChange={(e) => setOtherOutfitInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCustomOutfit()}
                    placeholder="Otro traje..."
                    className="flex-1 bg-background-dark/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white"
                />
                <button onClick={addCustomOutfit} className="bg-primary text-white px-6 rounded-xl font-bold text-xs uppercase">Agregar</button>
            </div>
        </section>

        {/* HASHTAGS */}
        <section className="bg-sidebar-dark/50 rounded-3xl border border-primary/20 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">tag</span>
                    <h4 className="font-bold text-white text-lg">Hashtags Sugeridos (Posicionamiento)</h4>
                </div>
                <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${selectedHashtags.length === 5 ? 'bg-accent-gold/20 text-accent-gold' : 'bg-white/5 text-slate-500'}`}>
                    {selectedHashtags.length} / 5
                </span>
            </div>
            <div className="flex flex-wrap gap-3">
                {hashtagsData.map(item => {
                    const isSelected = selectedHashtags.includes(item.tag);
                    const disabled = !isSelected && selectedHashtags.length >= 5;
                    return (
                        <div key={item.tag} className="flex items-center gap-1">
                            <button 
                                onClick={() => toggleHashtag(item.tag)}
                                disabled={disabled}
                                className={`px-4 py-2 rounded-xl border text-[10px] font-bold transition-all ${
                                    isSelected 
                                    ? "bg-primary border-primary text-white" 
                                    : disabled ? "opacity-20 cursor-not-allowed border-white/5" : "border-white/5 text-slate-500 hover:border-primary/50"
                                }`}
                            >
                                {item.tag}
                            </button>
                            <button onClick={() => setActiveHashtag(item)} className="text-primary/20 hover:text-primary transition-colors">
                                <span className="material-symbols-outlined text-sm">help</span>
                            </button>
                        </div>
                    );
                })}
            </div>
        </section>
      </div>
    </div>
  );
}

export default function ModelEditPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Iniciando interfaz avanzada..." />}>
      <EditProfileContent />
    </Suspense>
  );
}
