import { NextRequest, NextResponse } from "next/server";
import admin, { adminAuth, adminDb } from "@/lib/firebase-admin";
import { getDriveClient } from "@/lib/google-drive";

interface PlatformMetrics {
  platform: string;
  currency: "USD" | "EUR";
  periodsCount: number;
  totalHours: number;
  totalTokens: number;
  totalEarningsUsdOrEur: number;
  tokensPerHour: { p25: number; p50: number; p75: number };
  followersPerHour: { p25: number; p50: number; p75: number };
  earningsPerHour: { p25: number; p50: number; p75: number };
}

interface PeriodDetail {
  period: string;
  month: number;
  platform: string;
  currency: "USD" | "EUR";
  hours: number;
  tokens: number;
  earnings: number;
  followersGain: number;
  dailyHours: number[];
  sundayHours: number;
  holidayHours: number;
}

// Festivos en Colombia 2026 (Ley Emiliani y fijos)
const COLOMBIA_HOLIDAYS_2026 = new Set([
  "2026-01-01", // Año Nuevo
  "2026-01-12", // Reyes Magos
  "2026-03-23", // San José
  "2026-04-02", // Jueves Santo
  "2026-04-03", // Viernes Santo
  "2026-05-01", // Día del Trabajo
  "2026-05-18", // Ascensión del Señor
  "2026-06-08", // Corpus Christi
  "2026-06-15", // Sagrado Corazón
  "2026-06-29", // San Pedro y San Pablo
  "2026-07-20", // Día de la Independencia
  "2026-08-07", // Batalla de Boyacá
  "2026-08-17", // Asunción de la Virgen
  "2026-10-12", // Día de la Raza
  "2026-11-02", // Todos los Santos
  "2026-11-16", // Independencia de Cartagena
  "2026-12-08", // Inmaculada Concepción
  "2026-12-25"  // Navidad
]);

// Temporadas webcam anuales (factor conservador y realista)
const SEASONAL_FACTORS: Record<number, { factor: number; season: string; reason: string }> = {
  1: { factor: 0.90, season: "Baja", reason: "Cuesta de enero y recortes tras navidad" },
  2: { factor: 1.04, season: "Media-Alta", reason: "San Valentín y alta afluencia privada" },
  3: { factor: 1.00, season: "Media", reason: "Estabilidad de primer trimestre" },
  4: { factor: 0.95, season: "Media-Baja", reason: "Semanas santas y declaraciones fiscales (US)" },
  5: { factor: 1.00, season: "Media", reason: "Estabilidad pre-vacacional" },
  6: { factor: 1.01, season: "Media", reason: "Comienzo de verano hemisferio norte" },
  7: { factor: 0.92, season: "Baja", reason: "Pico de vacaciones y actividades al aire libre" },
  8: { factor: 0.90, season: "Baja", reason: "Vacaciones estivales en Europa y Norteamérica" },
  9: { factor: 1.04, season: "Media-Alta", reason: "Retorno a rutina y aumento de tráfico en línea" },
  10: { factor: 1.08, season: "Alta", reason: "Halloween y aumento de interacción" },
  11: { factor: 1.14, season: "Muy Alta", reason: "Black Friday, Cyber Monday y mayor gasto" },
  12: { factor: 1.18, season: "Pico Anual", reason: "Aguinaldos, bonos y fiestas de fin de año" }
};

function calculatePercentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  if (sortedArr.length === 1) return sortedArr[0];
  const idx = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  const weight = idx - lower;
  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

function normalizePlatformName(p: string): string {
  const low = p.trim().toLowerCase();
  if (low.includes("chaturbate") || low === "cb") return "Chaturbate";
  if (low.includes("stripchat") || low === "sc" || low === "st") return "Stripchat";
  if (low.includes("streamate") || low.includes("streammate") || low === "sm") return "Streamate";
  if (low.includes("livejasmin") || low.includes("jasmin") || low === "lj") return "LiveJasmin";
  if (low.includes("skyprivate") || low === "sp") return "Skyprivate";
  if (low.includes("xlove") || low === "xl") return "XLove";
  return p.trim();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const modelId = searchParams.get("modelId");
    const nickname = searchParams.get("nickname") || "";

    if (!modelId && !nickname) {
      return NextResponse.json({ error: "modelId o nickname requerido" }, { status: 400 });
    }

    const drive = await getDriveClient();

    // 1. Obtener datos y plataformas habilitadas reales de Firestore
    let modelData: any = null;
    let enabledPlatformsSet = new Set<string>();
    let aliases: string[] = [nickname, nickname.toLowerCase(), nickname.replace(/\s+/g, '_'), nickname.replace(/_/g, ' ')];
    let platformSpecificAliases: Record<string, string[]> = {};

    if (modelId && adminDb) {
      try {
        const docSnap = await adminDb.collection("models").doc(modelId).get();
        if (docSnap.exists) {
          modelData = docSnap.data();
          if (modelData.name) aliases.push(modelData.name, modelData.name.toLowerCase(), modelData.name.replace(/\s+/g, '_'));
          if (modelData.nickname) aliases.push(modelData.nickname, modelData.nickname.toLowerCase(), modelData.nickname.replace(/\s+/g, '_'));
          if (Array.isArray(modelData.platforms)) {
            modelData.platforms.forEach((p: string) => {
              if (p) enabledPlatformsSet.add(normalizePlatformName(p));
            });
          }
        }

        const profileSnap = await adminDb.collection("modelos_profile_v2").doc(modelId).get();
        if (profileSnap.exists) {
          const pData = profileSnap.data();
          if (pData?.generalInfo?.realName) {
            const rn = pData.generalInfo.realName;
            aliases.push(rn, rn.toLowerCase(), rn.replace(/\s+/g, '_'));
          }
          if (Array.isArray(pData?.generalInfo?.targetPlatforms)) {
            pData.generalInfo.targetPlatforms.forEach((p: string) => {
              if (p) enabledPlatformsSet.add(normalizePlatformName(p));
            });
          }
          if (Array.isArray(pData?.apiEnabledPlatforms)) {
            pData.apiEnabledPlatforms.forEach((p: string) => {
              if (p) enabledPlatformsSet.add(normalizePlatformName(p));
            });
          }
          if (pData?.platformAliases) {
            Object.entries(pData.platformAliases).forEach(([platKey, arr]: [string, any]) => {
              const normPlat = normalizePlatformName(platKey);
              if (Array.isArray(arr) && arr.length > 0) {
                platformSpecificAliases[normPlat] = [];
                arr.forEach(a => {
                  if (a) {
                    const clean = String(a).trim();
                    aliases.push(clean, clean.toLowerCase(), clean.replace(/\s+/g, '_'));
                    platformSpecificAliases[normPlat].push(clean, clean.toLowerCase(), clean.replace(/\s+/g, '_'));
                  }
                });
              }
            });
          }
        }
      } catch (e) {
        console.warn("Error leyendo Firestore:", e);
      }
    }

    aliases = Array.from(new Set(aliases.filter(Boolean)));

    // 2. Extraer históricos del Drive separados estrictamente por plataforma
    const batchFolders = [
      { id: '1NHOLMCekNrrOUjrRgOxkUfsjC-M76C4n', platform: 'Chaturbate', currency: 'USD' as const },
      { id: '1HrtxbSUgDJP04VxKkOmIAJELkbrYilrP', platform: 'Stripchat', currency: 'USD' as const }
    ];

    const periodMap = new Map<string, PeriodDetail>();
    let totalObservedDays = 0;
    let sundaySessionsCount = 0;
    let holidaySessionsCount = 0;

    for (const bf of batchFolders) {
      try {
        const batchList = await drive.files.list({
          q: `'${bf.id}' in parents and trashed = false`,
          fields: 'files(id, name)',
          pageSize: 50,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        });

        const files = batchList.data.files || [];
        for (const file of files) {
          if (!file.id || !file.name) continue;
          const matchPeriod = file.name.match(/(\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2})/);
          const periodKey = matchPeriod ? matchPeriod[1] : file.name;
          const monthNum = parseInt(periodKey.substring(5, 7), 10) || 1;

          try {
            const fileContent = await drive.files.get({
              fileId: file.id,
              alt: 'media',
              supportsAllDrives: true
            });

            const parsed = typeof fileContent.data === 'string' ? JSON.parse(fileContent.data) : fileContent.data;
            const modelsData = parsed?.data || {};

            let targetModelKey: string | null = null;
            for (const key of Object.keys(modelsData)) {
              const kClean = key.toLowerCase().replace(/[^a-z0-9]/g, "");
              if (aliases.some(a => {
                const aClean = a.toLowerCase().replace(/[^a-z0-9]/g, "");
                return aClean === kClean || (aClean.length > 3 && (kClean.includes(aClean) || aClean.includes(kClean)));
              })) {
                targetModelKey = key;
                break;
              }
            }

            if (targetModelKey && modelsData[targetModelKey]) {
              const mStats = modelsData[targetModelKey];
              let totalHours = 0;
              if (mStats.total_time) {
                totalHours = (mStats.total_time.hours || 0) + ((mStats.total_time.minutes || 0) / 60);
              }

              // Si tiene horas registradas en esta plataforma en Drive, asegurar que la plataforma esté habilitada
              if (totalHours > 0.5) {
                enabledPlatformsSet.add(bf.platform);
              }

              let periodSundayHours = 0;
              let periodHolidayHours = 0;
              const dailyHoursArr: number[] = [];

              if (mStats.activity && typeof mStats.activity === 'object') {
                for (const [dateStr, actText] of Object.entries(mStats.activity)) {
                  const match = String(actText).match(/(\d+)\s*Hours?\s*(\d+)\s*Minutes?/i);
                  const h = match ? parseInt(match[1], 10) + (parseInt(match[2], 10) / 60) : 0;
                  if (h > 0) {
                    totalObservedDays++;
                    dailyHoursArr.push(h);

                    const dObj = new Date(`${dateStr}T12:00:00Z`);
                    const isSun = dObj.getUTCDay() === 0;
                    const isHol = COLOMBIA_HOLIDAYS_2026.has(dateStr);

                    if (isSun) {
                      sundaySessionsCount++;
                      periodSundayHours += h;
                    }
                    if (isHol) {
                      holidaySessionsCount++;
                      periodHolidayHours += h;
                    }
                  }
                }
              }

              // Calcular crecimiento de seguidores en el periodo
              let initialFollowers = 0;
              let finalFollowers = 0;
              if (mStats.details && typeof mStats.details === 'object') {
                const dates = Object.keys(mStats.details).sort();
                if (dates.length > 0) {
                  const firstDayList = mStats.details[dates[0]] || [];
                  const lastDayList = mStats.details[dates[dates.length - 1]] || [];
                  if (firstDayList.length > 0 && firstDayList[0].followers) {
                    initialFollowers = Number(firstDayList[0].followers);
                  }
                  if (lastDayList.length > 0 && lastDayList[lastDayList.length - 1].followers) {
                    finalFollowers = Number(lastDayList[lastDayList.length - 1].followers);
                  }
                }
              }

              const followersDiff = Math.max(0, finalFollowers - initialFollowers);

              periodMap.set(`${periodKey}_${bf.platform}`, {
                period: periodKey,
                month: monthNum,
                platform: bf.platform,
                currency: bf.currency,
                hours: Math.round(totalHours * 10) / 10,
                tokens: 0,
                earnings: 0,
                followersGain: followersDiff,
                dailyHours: dailyHoursArr,
                sundayHours: Math.round(periodSundayHours * 10) / 10,
                holidayHours: Math.round(periodHolidayHours * 10) / 10
              });
            }
          } catch (eInner) {
            console.warn(`Error procesando batch ${file.name}:`, eInner);
          }
        }
      } catch (eBf) {
        console.warn(`Error listando batch ${bf.platform}:`, eBf);
      }
    }

    // 3. Cruzar con archivos CSV de la modelo en Drive e identificar la plataforma real del CSV (CB, SC, SM)
    const folderPlatformCache = new Map<string, string>();

    for (const alias of aliases.slice(0, 4)) {
      if (!alias || alias.length < 3) continue;
      try {
        const csvSearch = await drive.files.list({
          q: `name contains '${alias.replace(/'/g, "\\'")}' and mimeType = 'text/csv' and trashed = false`,
          fields: 'files(id, name, parents)',
          pageSize: 40,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        });

        const csvFiles = csvSearch.data.files || [];
        for (const cf of csvFiles) {
          if (!cf.id || !cf.name) continue;
          const matchPeriod = cf.name.match(/(\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2})/);
          if (!matchPeriod) continue;
          const periodKey = matchPeriod[1];
          const monthNum = parseInt(periodKey.substring(5, 7), 10) || 1;

          // Identificar carpeta padre (CB, SC, SM) para no mezclar plataformas
          let parentPlatform: string | null = null;
          if (cf.parents && cf.parents[0]) {
            const pId = cf.parents[0];
            if (folderPlatformCache.has(pId)) {
              parentPlatform = folderPlatformCache.get(pId)!;
            } else {
              try {
                const parentMeta = await drive.files.get({ fileId: pId, fields: 'name', supportsAllDrives: true });
                const pName = (parentMeta.data.name || "").toUpperCase();
                if (pName === "CB" || pName.includes("CHATURBATE")) parentPlatform = "Chaturbate";
                else if (pName === "SC" || pName.includes("STRIPCHAT")) parentPlatform = "Stripchat";
                else if (pName === "SM" || pName.includes("STREAMATE")) parentPlatform = "Streamate";
                if (parentPlatform) folderPlatformCache.set(pId, parentPlatform);
              } catch {}
            }
          }

          try {
            const csvContent = await drive.files.get({
              fileId: cf.id,
              alt: 'media',
              supportsAllDrives: true
            });

            const text = typeof csvContent.data === 'string' ? csvContent.data : "";
            const lines = text.split('\n');
            const isStreamate = text.includes("Customer Nickname") || text.includes("Performer Earned") || parentPlatform === "Streamate";
            const isXLove = text.toLowerCase().includes("xlove") || text.includes("Euros");

            let tokensInCsv = 0;
            let earningsInCsv = 0;
            let totalDurationSeconds = 0;

            if (isStreamate) {
              parentPlatform = "Streamate";
              for (const line of lines.slice(1)) {
                if (!line.trim()) continue;
                const cols = line.split(',');
                if (cols[2] && cols[2] !== "N/A") {
                  totalDurationSeconds += parseInt(cols[2], 10) || 0;
                }
                if (cols[4]) {
                  const val = parseFloat(cols[4].replace('$', '').trim()) || 0;
                  earningsInCsv += val;
                }
              }
              tokensInCsv = Math.round(earningsInCsv / 0.05);
              if (earningsInCsv > 0) enabledPlatformsSet.add("Streamate");
            } else {
              for (const line of lines.slice(1)) {
                if (!line.trim()) continue;
                const sep = line.includes(';') ? ';' : ',';
                const parts = line.split(sep);
                for (const part of parts) {
                  const num = parseInt(part.trim(), 10);
                  if (!isNaN(num) && num > 0 && num < 100000 && !part.includes('-') && !part.includes(':')) {
                    tokensInCsv += num;
                    break;
                  }
                }
              }
              earningsInCsv = tokensInCsv * 0.05;
            }

            if (parentPlatform === "Streamate" && earningsInCsv > 0) {
              // En Streamate el CSV reporta duración en shows pagos; el tiempo total en línea suele ser ~3.5x el tiempo en show privado
              const estimatedOnlineHours = Math.max(12, Math.round((totalDurationSeconds / 3600) * 3.5 * 10) / 10);
              periodMap.set(`${periodKey}_Streamate`, {
                period: periodKey,
                month: monthNum,
                platform: "Streamate",
                currency: "USD",
                hours: estimatedOnlineHours,
                tokens: tokensInCsv,
                earnings: Math.round(earningsInCsv * 100) / 100,
                followersGain: Math.round(estimatedOnlineHours * 2.5),
                dailyHours: [],
                sundayHours: 0,
                holidayHours: 0
              });
            } else if (parentPlatform) {
              const key = `${periodKey}_${parentPlatform}`;
              const existing = periodMap.get(key);
              if (existing) {
                existing.tokens = Math.max(existing.tokens, tokensInCsv);
                existing.earnings = Math.max(existing.earnings, Math.round(earningsInCsv * 100) / 100);
              }
            } else {
              // Si no tenía carpeta padre identificada, asociar al periodo existente
              for (const [k, p] of Array.from(periodMap.entries())) {
                if (p.period === periodKey && p.tokens === 0) {
                  p.tokens = tokensInCsv;
                  p.earnings = Math.round(earningsInCsv * 100) / 100;
                }
              }
            }
          } catch (eCsv) {
            console.warn(`Error leyendo CSV ${cf.name}:`, eCsv);
          }
        }
      } catch (errAlias) {
        console.warn("Error buscando CSV de modelo:", errAlias);
      }
    }

    // Si la modelo no tenía plataformas configuradas en absoluto, usar las detectadas o Chaturbate por defecto
    if (enabledPlatformsSet.size === 0) {
      enabledPlatformsSet.add("Chaturbate");
    }

    const enabledPlatforms = Array.from(enabledPlatformsSet);
    const allPeriods = Array.from(periodMap.values()).filter(p => enabledPlatformsSet.has(p.platform));

    // 4. Construir métricas específicas y realistas POR CADA PLATAFORMA habilitada
    const platformBreakdown: Record<string, PlatformMetrics> = {};

    for (const plat of enabledPlatforms) {
      const platPeriods = allPeriods.filter(p => p.platform === plat && p.hours > 0);
      const tphSamples: number[] = [];
      const fphSamples: number[] = [];
      let sumHours = 0;
      let sumTokens = 0;
      let sumEarnings = 0;

      for (const pp of platPeriods) {
        sumHours += pp.hours;
        sumTokens += pp.tokens;
        sumEarnings += pp.earnings;

        if (pp.tokens > 0 && pp.hours >= 4) {
          tphSamples.push(pp.tokens / pp.hours);
        }
        if (pp.followersGain > 0 && pp.hours >= 4) {
          fphSamples.push(pp.followersGain / pp.hours);
        }
      }

      // Valores base conservadores y realistas si una plataforma recién habilitada aún tiene pocos CSVs cruzados
      // Evita inflar números y mantiene precisión empírica
      let defaultTph = [75, 110, 155]; // Conservador: ~3.75 a $7.75 USD brutos/hora
      let defaultFph = [2.2, 4.0, 6.8];

      if (plat === "Stripchat") {
        defaultTph = [70, 105, 150];
        defaultFph = [3.0, 5.2, 8.5];
      } else if (plat === "Streamate" || plat === "LiveJasmin" || plat === "Skyprivate") {
        defaultTph = [85, 125, 175]; // Equivalente en tokens ($0.05) de ganancias privadas
        defaultFph = [1.5, 2.8, 4.5];
      }

      const sortedTph = tphSamples.length > 0 ? [...tphSamples].sort((a, b) => a - b) : defaultTph;
      const sortedFph = fphSamples.length > 0 ? [...fphSamples].sort((a, b) => a - b) : defaultFph;

      const p25T = Math.round(calculatePercentile(sortedTph, 25));
      const p50T = Math.round(calculatePercentile(sortedTph, 50));
      const p75T = Math.round(calculatePercentile(sortedTph, 75));

      const p25F = Math.round(calculatePercentile(sortedFph, 25) * 10) / 10;
      const p50F = Math.round(calculatePercentile(sortedFph, 50) * 10) / 10;
      const p75F = Math.round(calculatePercentile(sortedFph, 75) * 10) / 10;

      const currency: "USD" | "EUR" = plat === "XLove" ? "EUR" : "USD";

      platformBreakdown[plat] = {
        platform: plat,
        currency,
        periodsCount: platPeriods.length,
        totalHours: Math.round(sumHours * 10) / 10,
        totalTokens: sumTokens,
        totalEarningsUsdOrEur: Math.round(sumEarnings * 100) / 100,
        tokensPerHour: {
          p25: Math.max(40, p25T),
          p50: Math.max(65, p50T),
          p75: Math.max(95, p75T)
        },
        followersPerHour: {
          p25: Math.max(1.0, p25F),
          p50: Math.max(2.0, p50F),
          p75: Math.max(3.5, p75F)
        },
        earningsPerHour: {
          p25: Math.round(Math.max(40, p25T) * 0.05 * 100) / 100,
          p50: Math.round(Math.max(65, p50T) * 0.05 * 100) / 100,
          p75: Math.round(Math.max(95, p75T) * 0.05 * 100) / 100
        }
      };
    }

    // 5. Construir opción TOTALIZADA ("ALL") que consolida todas las plataformas habilitadas de la modelo
    // Nota importante sobre multi-streaming (transmitir en varias páginas al mismo tiempo):
    // Si la modelo transmite 6 horas simultáneamente en sus plataformas habilitadas, el rendimiento total
    // es la suma ponderada de sus páginas activas (ajustada por un factor de atención dividida de 0.85x por página adicional
    // para jamás generar falsas expectativas ni duplicar irrealmente las ganancias).
    let totalP25T = 0;
    let totalP50T = 0;
    let totalP75T = 0;
    let totalP25F = 0;
    let totalP50F = 0;
    let totalP75F = 0;
    let grandTotalHours = 0;
    let grandTotalTokens = 0;
    let grandTotalEarnings = 0;

    enabledPlatforms.forEach((plat, idx) => {
      const b = platformBreakdown[plat];
      // La plataforma principal suma 100% de su tasa real; las plataformas secundarias en simultáneo suman con factor realista (0.65)
      const multiStreamWeight = idx === 0 ? 1.0 : 0.65;
      totalP25T += Math.round(b.tokensPerHour.p25 * multiStreamWeight);
      totalP50T += Math.round(b.tokensPerHour.p50 * multiStreamWeight);
      totalP75T += Math.round(b.tokensPerHour.p75 * multiStreamWeight);

      totalP25F += b.followersPerHour.p25 * multiStreamWeight;
      totalP50F += b.followersPerHour.p50 * multiStreamWeight;
      totalP75F += b.followersPerHour.p75 * multiStreamWeight;

      grandTotalHours += b.totalHours;
      grandTotalTokens += b.totalTokens;
      grandTotalEarnings += b.totalEarningsUsdOrEur;
    });

    platformBreakdown["ALL"] = {
      platform: "ALL",
      currency: "USD",
      periodsCount: allPeriods.length,
      totalHours: Math.round(grandTotalHours * 10) / 10,
      totalTokens: grandTotalTokens,
      totalEarningsUsdOrEur: Math.round(grandTotalEarnings * 100) / 100,
      tokensPerHour: {
        p25: totalP25T,
        p50: totalP50T,
        p75: totalP75T
      },
      followersPerHour: {
        p25: Math.round(totalP25F * 10) / 10,
        p50: Math.round(totalP50F * 10) / 10,
        p75: Math.round(totalP75F * 10) / 10
      },
      earningsPerHour: {
        p25: Math.round(totalP25T * 0.05 * 100) / 100,
        p50: Math.round(totalP50T * 0.05 * 100) / 100,
        p75: Math.round(totalP75T * 0.05 * 100) / 100
      }
    };

    return NextResponse.json({
      success: true,
      model: {
        id: modelId,
        nickname: nickname || modelData?.nickname || "Modelo",
        name: modelData?.name || nickname,
        enabledPlatforms
      },
      stats: {
        totalObservedDays,
        sundaySessionsCount,
        holidaySessionsCount,
        periodsCount: allPeriods.length
      },
      platformBreakdown,
      calendarAverages: {
        standardWorkDaysPerBiweek: 11,
        sundaysPerBiweek: 2,
        holidaysPerBiweek: 1,
        sundayBoostRatio: 1.15,  // +15% realista en domingos
        holidayBoostRatio: 1.18  // +18% realista en festivos
      },
      positioningFactors: {
        logarithmicThresholdHours: 4.0,
        fullShiftBoost6h: 1.12,   // +12% realista por cumplir las 6h (sin sobre-inflar)
        shortShiftPenalty: 0.85   // -15% cuando transmite menos de 4h por barrera logarítmica
      },
      seasonalFactors: SEASONAL_FACTORS,
      periods: allPeriods.sort((a, b) => b.period.localeCompare(a.period))
    });

  } catch (error: any) {
    console.error("Error en API de predicción por plataforma:", error);
    return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 });
  }
}
