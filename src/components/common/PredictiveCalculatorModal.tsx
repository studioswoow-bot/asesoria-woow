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
  const [selectedPlatform, setSelectedPlatform] = useState<string>("Chaturbate");
  
  // Tasa de cambio (TRM) personalizable por la modelo o estudio
  const [exchangeRateUsdCop, setExchangeRateUsdCop] = useState<number>(4100);
  const [exchangeRateEurUsd, setExchangeRateEurUsd] = useState<number>(1.08);

  // Porcentaje asignado a la modelo (fijado en 60% por solicitud de administración)
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
          if (model.platforms && model.platforms.length > 0) {
            setSelectedPlatform(model.platforms[0]);
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

  // Moneda por plataforma
  const platformCurrency = useMemo(() => {
    const p = selectedPlatform.toLowerCase();
    if (p.includes("xlove")) return "EUR";
    return "USD";
  }, [selectedPlatform]);

  const currencySymbol = platformCurrency === "EUR" ? "€" : "$";

  // Cálculos estadísticos p25, p50, p75
  const calculations = useMemo(() => {
    const regularHours = workDays * dailyHours;
    const sundayHours = attendSundays * dailyHours;
    const holidayHours = attendHolidays * dailyHours;
    const totalHours = regularHours + sundayHours + holidayHours;

    // Percentiles base por hora de la modelo
    const p25Tph = data?.tokensPerHour?.p25 || 110;
    const p50Tph = data?.tokensPerHour?.p50 || 165;
    const p75Tph = data?.tokensPerHour?.p75 || 245;

    const p25Fph = data?.followersPerHour?.p25 || 4.0;
    const p50Fph = data?.followersPerHour?.p50 || 6.5;
    const p75Fph = data?.followersPerHour?.p75 || 10.5;

    // Multiplicador estacional
    const seasonalInfo = data?.seasonalFactors?.[selectedMonth] || {
      factor: 1.0,
      season: "Media",
      reason: "Estabilidad de mercado"
    };
    const seasonalFactor = seasonalInfo.factor || 1.0;

    // Multiplicador del algoritmo de posicionamiento según duración del turno:
    // Turnos de 6h alcanzan la plenitud logarítmica (+22%), turnos de 4h (+10%), turnos < 3h (-18%)
    let shiftMultiplier = 1.0;
    if (dailyHours >= 6) {
      shiftMultiplier = 1.22;
    } else if (dailyHours >= 4) {
      shiftMultiplier = 1.10;
    } else {
      shiftMultiplier = 0.82;
    }

    // Boost por domingos y festivos (menor competencia y usuarios VIP en casa)
    const sundayMultiplier = 1.20; // +20%
    const holidayMultiplier = 1.25; // +25%

    // Función para calcular tokens proyectados para un percentil dado
    const calcTokensForTph = (tph: number) => {
      const regTokens = regularHours * tph * shiftMultiplier * seasonalFactor;
      const sunTokens = sundayHours * tph * shiftMultiplier * seasonalFactor * sundayMultiplier;
      const holTokens = holidayHours * tph * shiftMultiplier * seasonalFactor * holidayMultiplier;
      return Math.round(regTokens + sunTokens + holTokens);
    };

    // Función para calcular seguidores proyectados
    const calcFollowersForFph = (fph: number) => {
      const regFollowers = regularHours * fph * (shiftMultiplier > 1 ? 1.15 : 0.9) * seasonalFactor;
      const sunFollowers = sundayHours * fph * 1.20 * seasonalFactor;
      const holFollowers = holidayHours * fph * 1.25 * seasonalFactor;
      return Math.round(regFollowers + sunFollowers + holFollowers);
    };

    // Tokens en percentiles (Generación en plataforma)
    const tokensP25 = calcTokensForTph(p25Tph);
    const tokensP50 = calcTokensForTph(p50Tph);
    const tokensP75 = calcTokensForTph(p75Tph);

    // Seguidores en percentiles
    const followersP25 = calcFollowersForFph(p25Fph);
    const followersP50 = calcFollowersForFph(p50Fph);
    const followersP75 = calcFollowersForFph(p75Fph);

    // Conversión a dinero bruto en plataforma (1 token = $0.05 USD en CB/SC):
    const grossUsdP25 = tokensP25 * 0.05;
    const grossUsdP50 = tokensP50 * 0.05;
    const grossUsdP75 = tokensP75 * 0.05;

    // GANANCIA NETA PARA LA MODELO: EXACTAMENTE EL 60%
    const modelNetUsdP25 = grossUsdP25 * MODEL_SHARE_PERCENTAGE;
    const modelNetUsdP50 = grossUsdP50 * MODEL_SHARE_PERCENTAGE;
    const modelNetUsdP75 = grossUsdP75 * MODEL_SHARE_PERCENTAGE;

    // Convertir si la plataforma es XLove (EUR)
    const toPlatformCurrency = (usdVal: number) => {
      if (platformCurrency === "EUR") {
        return usdVal / exchangeRateEurUsd;
      }
      return usdVal;
    };

    const biweeklyPlatformP25 = toPlatformCurrency(modelNetUsdP25);
    const biweeklyPlatformP50 = toPlatformCurrency(modelNetUsdP50);
    const biweeklyPlatformP75 = toPlatformCurrency(modelNetUsdP75);

    // Liquidación en COP con la TRM ingresada por la modelo
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
  }, [dailyHours, workDays, attendSundays, attendHolidays, selectedMonth, selectedPlatform, platformCurrency, data, exchangeRateUsdCop, exchangeRateEurUsd]);

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
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold font-display flex items-center gap-2">
                  Calculadora Predictiva: Ganancias de la Modelo (60%)
                </h3>
                <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-bold">
                  {model.name} (@{model.nickname || "modelo"})
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Estimaciones netas (60% para la modelo) basadas en los históricos reales de Google Drive con TRM ajustable.
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
              <p className="text-sm text-text-muted">Extrayendo históricos quincenales, domingos y festivos desde Google Drive...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-3">
              <span className="material-symbols-outlined">warning</span>
              <span>{error}</span>
            </div>
          ) : (
            <>
              {/* Barra de Ajuste de TRM y Moneda */}
              <div className="bg-gradient-to-r from-emerald-500/10 via-primary/10 to-transparent border border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <span className="material-symbols-outlined">currency_exchange</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-text-main flex items-center gap-2">
                      <span>Valor del Dólar (TRM) y Participación</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-black">
                        Pago Modelo: 60%
                      </span>
                    </div>
                    <div className="text-[11px] text-text-muted">
                      Ingresa el valor del dólar acordado para liquidar tus ganancias exactas en COP.
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
                      max={10} 
                      step={0.5}
                      value={dailyHours}
                      onChange={(e) => setDailyHours(parseFloat(e.target.value))}
                      className="w-full accent-primary cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-text-muted mt-1">
                      <span>4h (Bajo)</span>
                      <span className="text-primary font-bold">6h (Requerido)</span>
                      <span>8h+ (Intensivo)</span>
                    </div>
                  </div>

                  {/* Días Regulares (Lunes a Sábado sin Festivos) */}
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
                      <span>Descanso Lun-Sáb</span>
                      <span>11 días (Asistencia Total)</span>
                    </div>
                  </div>

                  {/* Domingos Asistidos */}
                  <div>
                    <label className="text-xs font-semibold text-text-muted flex justify-between mb-1.5">
                      <span>Domingos Extras:</span>
                      <span className="text-accent-gold font-bold">+{attendSundays} domingos (+{attendSundays * dailyHours}h)</span>
                    </label>
                    <div className="flex gap-2 mt-1">
                      {[0, 1, 2].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setAttendSundays(num)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            attendSundays === num 
                              ? "bg-accent-gold text-background-dark shadow-md" 
                              : "bg-background-dark/70 text-text-muted hover:text-text-main border border-text-main/10"
                          }`}
                        >
                          {num === 0 ? "Descanso" : `${num} Dom (+20%)`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Festivos Asistidos */}
                  <div>
                    <label className="text-xs font-semibold text-text-muted flex justify-between mb-1.5">
                      <span>Festivos Extras:</span>
                      <span className="text-emerald-400 font-bold">+{attendHolidays} festivos (+{attendHolidays * dailyHours}h)</span>
                    </label>
                    <div className="flex gap-2 mt-1">
                      {[0, 1, 2].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setAttendHolidays(num)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            attendHolidays === num 
                              ? "bg-emerald-500 text-background-dark shadow-md" 
                              : "bg-background-dark/70 text-text-muted hover:text-text-main border border-text-main/10"
                          }`}
                        >
                          {num === 0 ? "Descanso" : `${num} Fest (+25%)`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Selectores de Mes y Plataforma */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-text-main/10">
                  <div>
                    <label className="text-xs font-semibold text-text-muted block mb-1">Mes de Proyección:</label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                      className="w-full bg-background-dark border border-text-main/15 rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {Object.entries(data?.seasonalFactors || {}).map(([mStr, s]: [string, any]) => (
                        <option key={mStr} value={mStr}>
                          Mes {mStr} ({s.season} - {s.factor}x) — {s.reason}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-text-muted block mb-1">Plataforma:</label>
                    <select
                      value={selectedPlatform}
                      onChange={(e) => setSelectedPlatform(e.target.value)}
                      className="w-full bg-background-dark border border-text-main/15 rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="Chaturbate">Chaturbate (Tokens a USD $)</option>
                      <option value="Stripchat">Stripchat (Tokens a USD $)</option>
                      <option value="Streamate">Streamate (USD $)</option>
                      <option value="LiveJasmin">LiveJasmin (USD $)</option>
                      <option value="Skyprivate">Skyprivate (USD $)</option>
                      <option value="XLove">XLove (Euros €)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* MATRIZ DE PERCENTILES: P25, P50, P75 - GANANCIAS NETAS DE LA MODELO (60%) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-sm">query_stats</span>
                    Tus Ganancias Estimadas al 60% (P25 Conservador, P50 Esperado, P75 Destacado)
                  </h4>
                  <span className="text-[10px] text-emerald-400 font-bold">
                    {dailyHours >= 6 ? "Cumple 6h: Algoritmo óptimo (+22% efectividad)" : "Turno < 6h: Penalizado por barrera algorítmica"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* P25: Escenario Conservador */}
                  <div className="bg-background-dark/70 border border-text-main/10 rounded-2xl p-4 flex flex-col justify-between space-y-3 relative overflow-hidden">
                    <div className="flex items-center justify-between border-b border-text-main/10 pb-2">
                      <span className="text-xs font-bold uppercase text-text-muted tracking-wider">P25 (Conservador)</span>
                      <span className="text-[9px] bg-text-main/10 text-text-muted px-2 py-0.5 rounded-full font-bold">Piso Seguro</span>
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
                      Días de tráfico tranquilo o propinas bajas. Es lo mínimo que ganas para ti si asistes las horas pactadas.
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
                      Rendimiento normal de tu perfil con buena interacción y cumpliendo el horario de 6 horas diarias.
                    </div>
                  </div>

                  {/* P75: Escenario Destacado */}
                  <div className="bg-background-dark/70 border border-text-main/10 rounded-2xl p-4 flex flex-col justify-between space-y-3 relative overflow-hidden">
                    <div className="flex items-center justify-between border-b border-text-main/10 pb-2">
                      <span className="text-xs font-bold uppercase text-accent-gold tracking-wider">P75 (Destacado)</span>
                      <span className="text-[9px] bg-accent-gold/20 text-accent-gold px-2 py-0.5 rounded-full font-bold">Alto Desempeño</span>
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
                      Captura de miembros VIP (ballenas), privados frecuentes y asistencia a domingos/festivos de alta demanda.
                    </div>
                  </div>
                </div>
              </div>

              {/* MOTIVACIÓN Y VALOR AGREGADO POR DOMINGOS Y FESTIVOS */}
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-emerald-400 text-2xl">rocket_launch</span>
                  <div className="text-xs">
                    <div className="font-bold text-emerald-400">¿Por qué asistir domingos y festivos?</div>
                    <div className="text-text-muted text-[11px] mt-0.5">
                      Los domingos generan <strong className="text-text-main">+20% más tokens por hora</strong> y los festivos <strong className="text-text-main">+25%</strong> debido a la menor competencia y mayor afluencia de usuarios internacionales.
                    </div>
                  </div>
                </div>
                {(attendSundays > 0 || attendHolidays > 0) && (
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 block">Tu Bono Neto (60%)</span>
                    <span className="text-sm font-black text-text-main">
                      +{Math.round((attendSundays * 1.20 + attendHolidays * 1.25) * dailyHours * (data?.tokensPerHour?.p50 || 165) * 0.05 * MODEL_SHARE_PERCENTAGE * exchangeRateUsdCop).toLocaleString("es-CO")} COP
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-text-main/10 flex items-center justify-between bg-text-main/5">
          <div className="text-[10px] text-text-muted flex items-center gap-1.5">
            <span className="material-symbols-outlined text-xs text-primary">verified</span>
            <span>Liquidación transparente para modelos calculada al 60% neto con TRM personalizada.</span>
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
