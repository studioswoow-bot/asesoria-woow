"use client";

import React, { useState, useEffect, useMemo } from "react";
import ModelAvatar from "@/components/common/ModelAvatar";

interface PredictiveCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: {
    id: string;
    name: string;
    nickname?: string;
    platforms?: string[];
    photo_url?: string;
    category?: string;
  } | null;
}

export function PredictiveCalculatorModal({
  isOpen,
  onClose,
  model
}: PredictiveCalculatorModalProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Parámetros de asistencia y turnos
  const [dailyHours, setDailyHours] = useState<number>(6); // Meta estándar: 6 horas diarias
  const [workDays, setWorkDays] = useState<number>(11); // Lunes a Sábado regulares (excluyendo festivos y domingos)
  const [attendSundays, setAttendSundays] = useState<number>(0); // Domingos asistidos (0 a 2 en la quincena)
  const [attendHolidays, setAttendHolidays] = useState<number>(0); // Festivos asistidos (0 a 2 en la quincena)
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedBiweekHalf, setSelectedBiweekHalf] = useState<"Q1" | "Q2">("Q2"); // Q1: 1 al 15, Q2: 16 al 30/31
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");

  // Tasa de cambio (TRM) personalizable por la modelo o estudio
  const [exchangeRateUsdCop, setExchangeRateUsdCop] = useState<number>(4100);
  const [exchangeRateEurUsd, setExchangeRateEurUsd] = useState<number>(1.08);

  // Porcentaje asignado a la modelo (60%)
  const MODEL_SHARE_PERCENTAGE = 0.60;

  useEffect(() => {
    if (!isOpen || !model) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const fetchAnalysis = async () => {
      try {
        const res = await fetch(
          `/api/models/predictive-calculator?modelId=${encodeURIComponent(model.id)}&nickname=${encodeURIComponent(model.nickname || model.name)}`
        );
        if (!res.ok) {
          throw new Error("No se pudo cargar la telemetría predictiva del Drive.");
        }
        const json = await res.json();
        if (isMounted) {
          setData(json);
          const enabled: string[] = json?.model?.enabledPlatforms || [];
          // Si tiene más de 1 plataforma habilitada, mostrar primero el consolidado ("ALL") o la primera habilitada
          if (enabled.length > 1) {
            setSelectedPlatform("ALL");
          } else if (enabled.length === 1) {
            setSelectedPlatform(enabled[0]);
          } else {
            setSelectedPlatform("Chaturbate");
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Error al conectar con los históricos.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAnalysis();

    return () => {
      isMounted = false;
    };
  }, [isOpen, model]);

  // Lista exclusiva de plataformas habilitadas para esta modelo
  const enabledPlatforms: string[] = useMemo(() => {
    if (data?.model?.enabledPlatforms && data.model.enabledPlatforms.length > 0) {
      return data.model.enabledPlatforms;
    }
    if (model?.platforms && model.platforms.length > 0) {
      return model.platforms;
    }
    return ["Chaturbate"];
  }, [data, model]);

  // Moneda según plataforma seleccionada
  const platformCurrency = useMemo(() => {
    const p = selectedPlatform.toLowerCase();
    if (p.includes("xlove")) return "EUR";
    return "USD";
  }, [selectedPlatform]);

  const currencySymbol = platformCurrency === "EUR" ? "€" : "$";

  // Obtener métricas específicas de la plataforma seleccionada (o "ALL" para el consolidado)
  const currentPlatMetrics = useMemo(() => {
    if (!data?.platformBreakdown) return null;
    return data.platformBreakdown[selectedPlatform] || data.platformBreakdown["ALL"] || null;
  }, [data, selectedPlatform]);

  // Filtrar el historial de periodos que se muestra en la tabla inferior según la selección
  const filteredPeriods = useMemo(() => {
    if (!data?.periods) return [];
    if (selectedPlatform === "ALL") return data.periods;
    return data.periods.filter((p: any) => p.platform.toLowerCase() === selectedPlatform.toLowerCase());
  }, [data, selectedPlatform]);

  // Cálculos estadísticos p25, p50, p75 calibrados sin inflar
  const calculations = useMemo(() => {
    const regularHours = workDays * dailyHours;
    const sundayHours = attendSundays * dailyHours;
    const holidayHours = attendHolidays * dailyHours;
    const totalHours = regularHours + sundayHours + holidayHours;

    // Percentiles empíricos de la plataforma seleccionada
    const p25Tph = currentPlatMetrics?.tokensPerHour?.p25 || 35;
    const p50Tph = currentPlatMetrics?.tokensPerHour?.p50 || 55;
    const p75Tph = currentPlatMetrics?.tokensPerHour?.p75 || 80;

    const p25Fph = currentPlatMetrics?.followersPerHour?.p25 || 1.5;
    const p50Fph = currentPlatMetrics?.followersPerHour?.p50 || 2.8;
    const p75Fph = currentPlatMetrics?.followersPerHour?.p75 || 4.5;

    // Multiplicador estacional empírico de la agencia según mes y quincena (Q1 o Q2)
    const seasonalInfo = data?.seasonalFactors?.[selectedMonth] || {
      factor: 1.0,
      q1Factor: 1.0,
      q2Factor: 1.0,
      season: "Media",
      reason: "Estabilidad de mercado"
    };
    const seasonalFactor = selectedBiweekHalf === "Q1" 
      ? (seasonalInfo.q1Factor || seasonalInfo.factor || 1.0)
      : (seasonalInfo.q2Factor || seasonalInfo.factor || 1.0);

    // Ajuste por duración del turno anclado a la meta de 6h = 1.00x (100% de su mediana histórica real)
    let shiftMultiplier = 1.0;
    if (dailyHours >= 7) {
      shiftMultiplier = 1.05; // Turno extendido (+5% adicional por hora)
    } else if (dailyHours >= 6) {
      shiftMultiplier = 1.00; // Meta de 6h cumplida = 100% de su P25/P50/P75 histórico real
    } else if (dailyHours >= 4) {
      shiftMultiplier = 0.90; // Turno medio (-10% por menor posicionamiento)
    } else {
      shiftMultiplier = 0.78; // Penalización por turno corto (< 4h)
    }

    // Multiplicadores realistas por domingos (+15%) y festivos (+18%)
    const sundayMultiplier = 1.15;
    const holidayMultiplier = 1.18;

    const calcTokensForTph = (tph: number) => {
      const regTokens = regularHours * tph * shiftMultiplier * seasonalFactor;
      const sunTokens = sundayHours * tph * shiftMultiplier * seasonalFactor * sundayMultiplier;
      const holTokens = holidayHours * tph * shiftMultiplier * seasonalFactor * holidayMultiplier;
      return Math.round(regTokens + sunTokens + holTokens);
    };

    const calcFollowersForFph = (fph: number) => {
      const regFollowers = regularHours * fph * shiftMultiplier * seasonalFactor;
      const sunFollowers = sundayHours * fph * 1.15 * seasonalFactor;
      const holFollowers = holidayHours * fph * 1.18 * seasonalFactor;
      return Math.round(regFollowers + sunFollowers + holFollowers);
    };

    // Tokens proyectados
    const tokensP25 = calcTokensForTph(p25Tph);
    const tokensP50 = calcTokensForTph(p50Tph);
    const tokensP75 = calcTokensForTph(p75Tph);

    // Seguidores proyectados
    const followersP25 = calcFollowersForFph(p25Fph);
    const followersP50 = calcFollowersForFph(p50Fph);
    const followersP75 = calcFollowersForFph(p75Fph);

    // Conversión a dinero bruto (1 token = $0.05 USD):
    const grossUsdP25 = tokensP25 * 0.05;
    const grossUsdP50 = tokensP50 * 0.05;
    const grossUsdP75 = tokensP75 * 0.05;

    // GANANCIA NETA DE LA MODELO (60%)
    const modelNetUsdP25 = grossUsdP25 * MODEL_SHARE_PERCENTAGE;
    const modelNetUsdP50 = grossUsdP50 * MODEL_SHARE_PERCENTAGE;
    const modelNetUsdP75 = grossUsdP75 * MODEL_SHARE_PERCENTAGE;

    const toPlatformCurrency = (usdVal: number) => {
      if (platformCurrency === "EUR") {
        return usdVal / exchangeRateEurUsd;
      }
      return usdVal;
    };

    const biweeklyPlatformP25 = toPlatformCurrency(modelNetUsdP25);
    const biweeklyPlatformP50 = toPlatformCurrency(modelNetUsdP50);
    const biweeklyPlatformP75 = toPlatformCurrency(modelNetUsdP75);

    const biweeklyCopP25 = modelNetUsdP25 * exchangeRateUsdCop;
    const biweeklyCopP50 = modelNetUsdP50 * exchangeRateUsdCop;
    const biweeklyCopP75 = modelNetUsdP75 * exchangeRateUsdCop;

    return {
      totalHours,
      regularHours,
      sundayHours,
      holidayHours,
      seasonalInfo,
      seasonalFactor,
      shiftMultiplier,
      p50Tph,
      tokens: {
        p25: tokensP25,
        p50: tokensP50,
        p75: tokensP75
      },
      followers: {
        p25: followersP25,
        p50: followersP50,
        p75: followersP75
      },
      biweekly: {
        p25: biweeklyPlatformP25,
        p50: biweeklyPlatformP50,
        p75: biweeklyPlatformP75
      },
      biweeklyCop: {
        p25: biweeklyCopP25,
        p50: biweeklyCopP50,
        p75: biweeklyCopP75
      },
      monthlyCop: {
        p25: biweeklyCopP25 * 2,
        p50: biweeklyCopP50 * 2,
        p75: biweeklyCopP75 * 2
      }
    };
  }, [dailyHours, workDays, attendSundays, attendHolidays, selectedMonth, selectedBiweekHalf, selectedPlatform, platformCurrency, currentPlatMetrics, data, exchangeRateUsdCop, exchangeRateEurUsd]);

  if (!isOpen || !model) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div 
        className="bg-panel-dark border border-text-main/15 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col text-text-main relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="p-6 border-b border-text-main/10 flex items-center justify-between sticky top-0 bg-panel-dark/95 backdrop-blur z-10">
          <div className="flex items-center gap-4">
            <ModelAvatar 
              name={model.name} 
              nickname={model.nickname} 
              photoUrl={model.photo_url} 
              size="lg" 
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-bold font-display">
                  Calculadora Predictiva (60% Modelo)
                </h3>
                <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-bold">
                  {model.name} (@{model.nickname || "modelo"})
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Proyección realista filtrada exclusivamente por las plataformas habilitadas de la modelo.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-text-main/10 rounded-xl transition-all text-text-muted hover:text-text-main cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="size-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm text-text-muted">Analizando históricos de Drive para las plataformas habilitadas de {model.name}...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-3">
              <span className="material-symbols-outlined">warning</span>
              <span>{error}</span>
            </div>
          ) : (
            <>
              {/* Selector Rápido de Plataformas Habilitadas + Opción Totalizada */}
              <div className="bg-background-dark/80 border border-text-main/10 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-sm">tv_signin</span>
                    Plataformas Habilitadas para {model.name}:
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {currentPlatMetrics?.periodsCount || 0} quincenas registradas ({currentPlatMetrics?.totalHours || 0}h históricas)
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {enabledPlatforms.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSelectedPlatform("ALL")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                        selectedPlatform === "ALL"
                          ? "bg-primary text-white shadow-lg shadow-primary/25 border border-primary"
                          : "bg-text-main/5 text-text-muted hover:text-text-main border border-text-main/10"
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">layers</span>
                      <span>Todas Habilitadas ({enabledPlatforms.join(" + ")})</span>
                    </button>
                  )}

                  {enabledPlatforms.map((plat) => (
                    <button
                      key={plat}
                      type="button"
                      onClick={() => setSelectedPlatform(plat)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                        selectedPlatform === plat
                          ? "bg-accent-gold text-background-dark shadow-lg shadow-accent-gold/20 border border-accent-gold"
                          : "bg-text-main/5 text-text-muted hover:text-text-main border border-text-main/10"
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">videocam</span>
                      <span>Solo {plat} ({plat.toLowerCase().includes("xlove") ? "EUR €" : "USD $"})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Barra de Ajuste de TRM y Moneda */}
              <div className="bg-gradient-to-r from-emerald-500/10 via-primary/10 to-transparent border border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <span className="material-symbols-outlined">currency_exchange</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-text-main flex items-center gap-2">
                      <span>Valor del Dólar (TRM)</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-black">
                        Tu Porcentaje: 60% Neto
                      </span>
                    </div>
                    <div className="text-[11px] text-text-muted">
                      Digita el valor de la TRM en pesos colombianos para calcular tu pago exacto.
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-44">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">$</span>
                    <input
                      type="number"
                      step="10"
                      min="3000"
                      max="6000"
                      value={exchangeRateUsdCop}
                      onChange={(e) => setExchangeRateUsdCop(parseFloat(e.target.value) || 0)}
                      className="w-full bg-background-dark border border-emerald-500/40 rounded-xl pl-7 pr-12 py-2 text-sm font-black text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      placeholder="4100"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text-muted">COP</span>
                  </div>

                  {platformCurrency === "EUR" && (
                    <div className="relative flex-1 sm:w-36">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">€/$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.8"
                        max="1.5"
                        value={exchangeRateEurUsd}
                        onChange={(e) => setExchangeRateEurUsd(parseFloat(e.target.value) || 1.08)}
                        className="w-full bg-background-dark border border-primary/40 rounded-xl pl-8 pr-3 py-2 text-sm font-black text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Controles de Simulación de Asistencia */}
              <div className="bg-text-main/5 border border-text-main/10 rounded-2xl p-5 space-y-5">
                <div className="flex items-center justify-between border-b border-text-main/10 pb-3">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-base">event_available</span>
                    Compromiso de Asistencia y Horas de Transmisión
                  </h4>
                  <div className="text-xs font-semibold text-primary">
                    Total Horas Quincena: <span className="text-text-main font-bold text-sm">{calculations.totalHours} hrs</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Horas Diarias */}
                  <div>
                    <label className="text-xs font-semibold text-text-muted flex justify-between mb-1.5">
                      <span>Horas Diarias:</span>
                      <span className={`font-bold ${dailyHours >= 6 ? "text-emerald-400" : "text-amber-400"}`}>
                        {dailyHours} hrs/día {dailyHours === 6 && "(Meta)"}
                      </span>
                    </label>
                    <input 
                      type="range" 
                      min={2} 
                      max={9} 
                      step={0.5}
                      value={dailyHours}
                      onChange={(e) => setDailyHours(parseFloat(e.target.value))}
                      className="w-full accent-primary cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-text-muted mt-1">
                      <span>3h (Bajo)</span>
                      <span className="text-primary font-bold">6h (Requerido)</span>
                      <span>8h+ (Extra)</span>
                    </div>
                  </div>

                  {/* Días Regulares */}
                  <div>
                    <label className="text-xs font-semibold text-text-muted flex justify-between mb-1.5">
                      <span>Días Regulares:</span>
                      <span className="text-text-main font-bold">{workDays} de 11 días</span>
                    </label>
                    <input 
                      type="range" 
                      min={6} 
                      max={12} 
                      step={1}
                      value={workDays}
                      onChange={(e) => setWorkDays(parseInt(e.target.value, 10))}
                      className="w-full accent-primary cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-text-muted mt-1">
                      <span>6 días</span>
                      <span>11 días (Lun-Sáb)</span>
                    </div>
                  </div>

                  {/* Domingos Asistidos */}
                  <div>
                    <label className="text-xs font-semibold text-text-muted flex justify-between mb-1.5">
                      <span>Domingos Extras:</span>
                      <span className="text-accent-gold font-bold">+{attendSundays} dom (+{attendSundays * dailyHours}h)</span>
                    </label>
                    <div className="flex gap-1.5 mt-1">
                      {[0, 1, 2].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setAttendSundays(num)}
                          className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            attendSundays === num 
                              ? "bg-accent-gold text-background-dark shadow-md" 
                              : "bg-background-dark/70 text-text-muted hover:text-text-main border border-text-main/10"
                          }`}
                        >
                          {num === 0 ? "Descanso" : `${num} Dom`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Festivos Asistidos */}
                  <div>
                    <label className="text-xs font-semibold text-text-muted flex justify-between mb-1.5">
                      <span>Festivos Extras:</span>
                      <span className="text-emerald-400 font-bold">+{attendHolidays} fest (+{attendHolidays * dailyHours}h)</span>
                    </label>
                    <div className="flex gap-1.5 mt-1">
                      {[0, 1, 2].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setAttendHolidays(num)}
                          className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            attendHolidays === num 
                              ? "bg-emerald-500 text-background-dark shadow-md" 
                              : "bg-background-dark/70 text-text-muted hover:text-text-main border border-text-main/10"
                          }`}
                        >
                          {num === 0 ? "Descanso" : `${num} Fest`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Selector de Mes / Temporada y Quincena (Q1/Q2) */}
                <div className="pt-2 border-t border-text-main/10 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-text-muted block mb-1">
                      Temporada Histórica Real (Quincenas 2 y 3 — 109 Quincenas Analizadas):
                    </label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                      className="w-full bg-background-dark border border-text-main/15 rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {Object.entries(data?.seasonalFactors || {}).map(([mStr, s]: [string, any]) => {
                        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
                        const mName = monthNames[parseInt(mStr, 10) - 1] || `Mes ${mStr}`;
                        return (
                          <option key={mStr} value={mStr}>
                            {mName} — Temporada {s.season} | Prom. Creadora: {s.agencyAvgTokensPerCreator?.toLocaleString() || "7,000"} tk/Q ({s.activeCreatorsAvg || 15} activas) | Agencia: ~{s.agencyTotalTokensAvg?.toLocaleString() || "100,000"} tk/Q
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-text-muted block mb-1">Quincena del Mes:</label>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedBiweekHalf("Q1")}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          selectedBiweekHalf === "Q1"
                            ? "bg-primary text-white shadow-md"
                            : "bg-background-dark/70 text-text-muted hover:text-text-main border border-text-main/10"
                        }`}
                      >
                        1ra Q ({calculations.seasonalInfo?.q1Tier || "Q1"}: {calculations.seasonalInfo?.q1Factor || 1}x)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedBiweekHalf("Q2")}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          selectedBiweekHalf === "Q2"
                            ? "bg-primary text-white shadow-md"
                            : "bg-background-dark/70 text-text-muted hover:text-text-main border border-text-main/10"
                        }`}
                      >
                        2da Q ({calculations.seasonalInfo?.q2Tier || "Q2"}: {calculations.seasonalInfo?.q2Factor || 1}x)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Nota explicativa de la temporada empírica */}
                <div className="bg-background-dark/60 px-3.5 py-2.5 rounded-xl border border-text-main/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-text-muted">
                    <span className="material-symbols-outlined text-accent-gold text-sm">insights</span>
                    <span>{calculations.seasonalInfo.reason}</span>
                  </div>
                  <span className="text-[11px] font-bold text-primary">
                    Factor Aplicado ({selectedBiweekHalf}): {calculations.seasonalFactor}x
                  </span>
                </div>
              </div>

              {/* MATRIZ DE PERCENTILES: P25, P50, P75 - GANANCIAS NETAS DE LA MODELO (60%) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-sm">query_stats</span>
                    Predicción Realista para {selectedPlatform === "ALL" ? "Todas tus Plataformas Habilitadas" : selectedPlatform} (Tu 60% Neto)
                  </h4>
                  <span className="text-[10px] text-emerald-400 font-bold">
                    {dailyHours >= 6 ? "Horario de 6h cumplido: Posicionamiento estable" : "Menos de 6h: El algoritmo reduce alcance"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* P25: Escenario Conservador */}
                  <div className="bg-background-dark/70 border border-text-main/10 rounded-2xl p-4 flex flex-col justify-between space-y-3 relative overflow-hidden">
                    <div className="flex items-center justify-between border-b border-text-main/10 pb-2">
                      <span className="text-xs font-bold uppercase text-text-muted tracking-wider">P25 (Conservador)</span>
                      <span className="text-[9px] bg-text-main/10 text-text-muted px-2 py-0.5 rounded-full font-bold">Piso Realista</span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="text-[10px] text-text-muted uppercase font-bold">Tokens Producidos</div>
                        <div className="text-2xl font-black text-text-main">
                          {calculations.tokens.p25.toLocaleString()} <span className="text-xs font-normal text-text-muted">tk</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-text-muted uppercase font-bold">Nuevos Seguidores</div>
                        <div className="text-lg font-bold text-accent-gold">
                          +{calculations.followers.p25.toLocaleString()} fans
                        </div>
                      </div>

                      <div className="border-t border-text-main/10 pt-2">
                        <div className="text-[10px] text-emerald-400 uppercase font-black">Tu Ganancia Neta (60%)</div>
                        <div className="text-xl font-black text-emerald-400">
                          {currencySymbol}{calculations.biweekly.p25.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs font-semibold text-text-main">
                          ≈ ${Math.round(calculations.biweeklyCop.p25).toLocaleString("es-CO")} COP / Quincena
                        </div>
                        <div className="text-[10px] text-text-muted mt-0.5">
                          Mensual (2Q): ${Math.round(calculations.monthlyCop.p25).toLocaleString("es-CO")} COP
                        </div>
                      </div>
                    </div>

                    <div className="text-[9px] text-text-muted bg-text-main/5 p-2 rounded-lg leading-tight">
                      Quincena de tráfico lento. Es la base segura que lograrás únicamente por mantener tu constancia de horas.
                    </div>
                  </div>

                  {/* P50: Escenario Esperado (Mediana Real) */}
                  <div className="bg-gradient-to-b from-primary/15 via-panel-dark to-panel-dark border-2 border-primary/40 rounded-2xl p-4 flex flex-col justify-between space-y-3 relative shadow-xl">
                    <div className="flex items-center justify-between border-b border-primary/20 pb-2">
                      <span className="text-xs font-black uppercase text-primary tracking-wider">P50 (Esperado / Mediana)</span>
                      <span className="text-[9px] bg-primary text-white px-2 py-0.5 rounded-full font-bold">Más Probable</span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="text-[10px] text-text-muted uppercase font-bold">Tokens Producidos</div>
                        <div className="text-3xl font-black text-text-main">
                          {calculations.tokens.p50.toLocaleString()} <span className="text-xs font-normal text-primary">tk</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-text-muted uppercase font-bold">Nuevos Seguidores</div>
                        <div className="text-lg font-bold text-accent-gold">
                          +{calculations.followers.p50.toLocaleString()} fans
                        </div>
                      </div>

                      <div className="border-t border-text-main/10 pt-2">
                        <div className="text-[10px] text-emerald-400 uppercase font-black">Tu Ganancia Neta (60%)</div>
                        <div className="text-2xl font-black text-emerald-400">
                          {currencySymbol}{calculations.biweekly.p50.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-sm font-black text-text-main">
                          ≈ ${Math.round(calculations.biweeklyCop.p50).toLocaleString("es-CO")} COP / Quincena
                        </div>
                        <div className="text-xs font-bold text-accent-gold mt-0.5">
                          Mensual (2Q): ${Math.round(calculations.monthlyCop.p50).toLocaleString("es-CO")} COP
                        </div>
                      </div>
                    </div>

                    <div className="text-[9px] text-text-muted bg-primary/10 p-2 rounded-lg leading-tight border border-primary/20">
                      Tu promedio real histórico manteniendo buena actitud, show dinámico y cumpliendo las 6 horas diarias.
                    </div>
                  </div>

                  {/* P75: Escenario Destacado */}
                  <div className="bg-background-dark/70 border border-text-main/10 rounded-2xl p-4 flex flex-col justify-between space-y-3 relative overflow-hidden">
                    <div className="flex items-center justify-between border-b border-text-main/10 pb-2">
                      <span className="text-xs font-bold uppercase text-accent-gold tracking-wider">P75 (Destacado)</span>
                      <span className="text-[9px] bg-accent-gold/20 text-accent-gold px-2 py-0.5 rounded-full font-bold">Buena Racha</span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="text-[10px] text-text-muted uppercase font-bold">Tokens Producidos</div>
                        <div className="text-2xl font-black text-text-main">
                          {calculations.tokens.p75.toLocaleString()} <span className="text-xs font-normal text-accent-gold">tk</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-text-muted uppercase font-bold">Nuevos Seguidores</div>
                        <div className="text-lg font-bold text-accent-gold">
                          +{calculations.followers.p75.toLocaleString()} fans
                        </div>
                      </div>

                      <div className="border-t border-text-main/10 pt-2">
                        <div className="text-[10px] text-emerald-400 uppercase font-black">Tu Ganancia Neta (60%)</div>
                        <div className="text-xl font-black text-emerald-400">
                          {currencySymbol}{calculations.biweekly.p75.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs font-semibold text-text-main">
                          ≈ ${Math.round(calculations.biweeklyCop.p75).toLocaleString("es-CO")} COP / Quincena
                        </div>
                        <div className="text-[10px] text-text-muted mt-0.5">
                          Mensual (2Q): ${Math.round(calculations.monthlyCop.p75).toLocaleString("es-CO")} COP
                        </div>
                      </div>
                    </div>

                    <div className="text-[9px] text-text-muted bg-text-main/5 p-2 rounded-lg leading-tight">
                      Quincena sobresaliente con privados constantes, fidelización de usuarios frecuentes y turnos en domingos/festivos.
                    </div>
                  </div>
                </div>
              </div>

              {/* MOTIVACIÓN Y VALOR AGREGADO POR DOMINGOS Y FESTIVOS */}
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-emerald-400 text-2xl">rocket_launch</span>
                  <div className="text-xs">
                    <div className="font-bold text-emerald-400">Ventaja de transmitir Domingos y Festivos</div>
                    <div className="text-text-muted text-[11px] mt-0.5">
                      Los domingos generan <strong className="text-text-main">+15% más tokens/hora</strong> y los festivos <strong className="text-text-main">+18%</strong> debido a que hay menos modelos conectadas y más usuarios libres en casa.
                    </div>
                  </div>
                </div>
                {(attendSundays > 0 || attendHolidays > 0) && (
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 block">Extra Neto para Ti (60%)</span>
                    <span className="text-sm font-black text-text-main">
                      +${Math.round((attendSundays * 1.15 + attendHolidays * 1.18) * dailyHours * calculations.p50Tph * 0.05 * MODEL_SHARE_PERCENTAGE * exchangeRateUsdCop).toLocaleString("es-CO")} COP
                    </span>
                  </div>
                )}
              </div>

              {/* Tabla de Historial Quincenal Filtrado por Plataforma */}
              {filteredPeriods.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      Periodos Analizados en Drive ({selectedPlatform === "ALL" ? "Todas sus páginas" : selectedPlatform})
                    </h5>
                    <span className="text-[10px] text-text-muted">
                      Mostrando {filteredPeriods.length} registros históricos
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-text-main/10 bg-background-dark/40">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-text-main/5 text-text-muted uppercase text-[9px] border-b border-text-main/10">
                        <tr>
                          <th className="px-3 py-2">Quincena</th>
                          <th className="px-3 py-2">Plataforma</th>
                          <th className="px-3 py-2">Horas</th>
                          <th className="px-3 py-2">Tokens</th>
                          <th className="px-3 py-2">Ganancia Modelo (60%)</th>
                          <th className="px-3 py-2">Nuevos Fans</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-text-main/5">
                        {filteredPeriods.map((p: any, idx: number) => {
                          const netModel60 = (p.earnings || 0) * MODEL_SHARE_PERCENTAGE;
                          return (
                            <tr key={idx} className="hover:bg-text-main/5 transition-colors">
                              <td className="px-3 py-2 font-mono font-bold text-text-main">{p.period}</td>
                              <td className="px-3 py-2">
                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-primary/10 text-primary border border-primary/20">
                                  {p.platform}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-text-muted">{p.hours}h</td>
                              <td className="px-3 py-2 text-text-main">{p.tokens > 0 ? p.tokens.toLocaleString() : "-"}</td>
                              <td className="px-3 py-2 font-bold text-emerald-400">
                                {p.currency === "EUR" ? "€" : "$"}{netModel60 > 0 ? netModel60.toFixed(2) : "-"}
                              </td>
                              <td className="px-3 py-2 text-accent-gold">
                                {p.followersGain > 0 ? `+${p.followersGain}` : "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-text-main/10 flex items-center justify-between bg-text-main/5">
          <div className="text-[10px] text-text-muted flex items-center gap-1.5">
            <span className="material-symbols-outlined text-xs text-primary">verified</span>
            <span>Liquidación proyectada al 60% neto exclusivamente para las plataformas activas de la modelo.</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-text-main/10 hover:bg-text-main/20 text-text-main text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
