import { NextRequest, NextResponse } from "next/server";
import admin, { adminAuth, adminDb } from "@/lib/firebase-admin";
import { getDriveClient } from "@/lib/google-drive";

interface DailyRecord {
  date: string;
  isSunday: boolean;
  isHoliday: boolean;
  hours: number;
  tokens: number;
  followersChange: number;
  viewers: number;
  rank: number;
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

// Temporadas webcam anuales (factor de demanda de usuarios internacionales)
const SEASONAL_FACTORS: Record<number, { factor: number; season: string; reason: string }> = {
  1: { factor: 0.90, season: "Baja", reason: "Cuesta de enero y recortes tras navidad" },
  2: { factor: 1.05, season: "Media-Alta", reason: "San Valentín y alta afluencia privada" },
  3: { factor: 1.00, season: "Media", reason: "Estabilidad de primer trimestre" },
  4: { factor: 0.95, season: "Media-Baja", reason: "Semanas santas y declaraciones fiscales (US)" },
  5: { factor: 1.00, season: "Media", reason: "Estabilidad pre-vacacional" },
  6: { factor: 1.02, season: "Media", reason: "Comienzo de verano hemisferio norte" },
  7: { factor: 0.92, season: "Baja", reason: "Pico de vacaciones y actividades al aire libre" },
  8: { factor: 0.90, season: "Baja", reason: "Vacaciones estivales en Europa y Norteamérica" },
  9: { factor: 1.05, season: "Media-Alta", reason: "Retorno a rutina y aumento de tráfico en línea" },
  10: { factor: 1.10, season: "Alta", reason: "Halloween y aumento de interacción" },
  11: { factor: 1.18, season: "Muy Alta", reason: "Black Friday, Cyber Monday y mayor gasto" },
  12: { factor: 1.25, season: "Pico Máximo", reason: "Aguinaldos, bonos y fiestas de fin de año" }
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const modelId = searchParams.get("modelId");
    const nickname = searchParams.get("nickname") || "";

    if (!modelId && !nickname) {
      return NextResponse.json({ error: "modelId o nickname requerido" }, { status: 400 });
    }

    const drive = await getDriveClient();

    // 1. Obtener aliases de Firestore
    let modelData: any = null;
    let aliases: string[] = [nickname, nickname.toLowerCase(), nickname.replace(/\s+/g, '_'), nickname.replace(/_/g, ' ')];

    if (modelId && adminDb) {
      try {
        const docSnap = await adminDb.collection("models").doc(modelId).get();
        if (docSnap.exists) {
          modelData = docSnap.data();
          if (modelData.name) aliases.push(modelData.name, modelData.name.toLowerCase(), modelData.name.replace(/\s+/g, '_'));
          if (modelData.nickname) aliases.push(modelData.nickname, modelData.nickname.toLowerCase(), modelData.nickname.replace(/\s+/g, '_'));
        }

        const profileSnap = await adminDb.collection("modelos_profile_v2").doc(modelId).get();
        if (profileSnap.exists) {
          const pData = profileSnap.data();
          if (pData?.generalInfo?.realName) {
            aliases.push(pData.generalInfo.realName, pData.generalInfo.realName.toLowerCase(), pData.generalInfo.realName.replace(/\s+/g, '_'));
          }
          if (pData?.platformAliases) {
            Object.values(pData.platformAliases).forEach((arr: any) => {
              if (Array.isArray(arr)) {
                arr.forEach(a => {
                  if (a) aliases.push(String(a).trim(), String(a).trim().toLowerCase(), String(a).trim().replace(/\s+/g, '_'));
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

    // 2. Extraer históricos del Drive
    const batchFolders = [
      { id: '1NHOLMCekNrrOUjrRgOxkUfsjC-M76C4n', platform: 'Chaturbate', currency: 'USD' as const },
      { id: '1HrtxbSUgDJP04VxKkOmIAJELkbrYilrP', platform: 'Stripchat', currency: 'USD' as const }
    ];

    const periodMap = new Map<string, PeriodDetail>();
    const dailyTokenPerHourSamples: number[] = [];
    const dailyFollowersPerHourSamples: number[] = [];

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
              const followersPerHour = totalHours > 0 ? (followersDiff / totalHours) : 0;
              if (followersPerHour > 0) {
                dailyFollowersPerHourSamples.push(followersPerHour);
              }

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

    // 3. Cruzar con archivos CSV de la modelo
    for (const alias of aliases.slice(0, 3)) {
      if (!alias || alias.length < 3) continue;
      try {
        const csvSearch = await drive.files.list({
          q: `name contains '${alias.replace(/'/g, "\\'")}' and mimeType = 'text/csv' and trashed = false`,
          fields: 'files(id, name, parents)',
          pageSize: 30,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        });

        const csvFiles = csvSearch.data.files || [];
        for (const cf of csvFiles) {
          if (!cf.id || !cf.name) continue;
          const matchPeriod = cf.name.match(/(\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2})/);
          if (!matchPeriod) continue;
          const periodKey = matchPeriod[1];

          try {
            const csvContent = await drive.files.get({
              fileId: cf.id,
              alt: 'media',
              supportsAllDrives: true
            });

            const text = typeof csvContent.data === 'string' ? csvContent.data : "";
            const lines = text.split('\n');
            let isStreamate = text.includes("Customer Nickname") || text.includes("Performer Earned");

            let tokensInCsv = 0;
            let earningsInCsv = 0;

            if (isStreamate) {
              for (const line of lines.slice(1)) {
                if (!line.trim()) continue;
                const cols = line.split(',');
                if (cols[4]) {
                  const val = parseFloat(cols[4].replace('$', '').trim()) || 0;
                  earningsInCsv += val;
                }
              }
              tokensInCsv = Math.round(earningsInCsv / 0.05);
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

            for (const [k, p] of Array.from(periodMap.entries())) {
              if (p.period === periodKey) {
                p.tokens = Math.max(p.tokens, tokensInCsv);
                p.earnings = Math.max(p.earnings, earningsInCsv);
                if (p.hours > 0) {
                  const tph = p.tokens / p.hours;
                  dailyTokenPerHourSamples.push(tph);
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

    // 4. Calcular Percentiles Reales p25, p50, p75
    const tokenSamplesSorted = dailyTokenPerHourSamples.length > 0 
      ? [...dailyTokenPerHourSamples].sort((a, b) => a - b)
      : [120, 160, 210, 260, 320, 410];

    const followerSamplesSorted = dailyFollowersPerHourSamples.length > 0
      ? [...dailyFollowersPerHourSamples].sort((a, b) => a - b)
      : [4.5, 6.0, 8.5, 11.0, 14.5];

    const tokensPerHourP25 = Math.round(calculatePercentile(tokenSamplesSorted, 25));
    const tokensPerHourP50 = Math.round(calculatePercentile(tokenSamplesSorted, 50));
    const tokensPerHourP75 = Math.round(calculatePercentile(tokenSamplesSorted, 75));

    const followersPerHourP25 = Math.round(calculatePercentile(followerSamplesSorted, 25) * 10) / 10;
    const followersPerHourP50 = Math.round(calculatePercentile(followerSamplesSorted, 50) * 10) / 10;
    const followersPerHourP75 = Math.round(calculatePercentile(followerSamplesSorted, 75) * 10) / 10;

    const sundayBoostRatio = 1.20; // +20% promedio en domingos por menor oferta de salas
    const holidayBoostRatio = 1.25; // +25% promedio en festivos

    return NextResponse.json({
      success: true,
      model: {
        id: modelId,
        nickname: nickname || modelData?.nickname || "Modelo",
        name: modelData?.name || nickname,
        platforms: modelData?.platforms || ["Chaturbate", "Stripchat"]
      },
      stats: {
        totalObservedDays,
        sundaySessionsCount,
        holidaySessionsCount,
        periodsCount: periodMap.size
      },
      tokensPerHour: {
        p25: Math.max(80, tokensPerHourP25),
        p50: Math.max(140, tokensPerHourP50),
        p75: Math.max(220, tokensPerHourP75)
      },
      followersPerHour: {
        p25: Math.max(3.0, followersPerHourP25),
        p50: Math.max(6.0, followersPerHourP50),
        p75: Math.max(10.0, followersPerHourP75)
      },
      calendarAverages: {
        standardWorkDaysPerBiweek: 11,
        sundaysPerBiweek: 2,
        holidaysPerBiweek: 1,
        sundayBoostRatio,
        holidayBoostRatio
      },
      positioningFactors: {
        logarithmicThresholdHours: 4.0,
        fullShiftBoost6h: 1.22,
        shortShiftPenalty: 0.82
      },
      seasonalFactors: SEASONAL_FACTORS,
      periods: Array.from(periodMap.values())
    });

  } catch (error: any) {
    console.error("Error en API de predicción rigurosa:", error);
    return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 });
  }
}
