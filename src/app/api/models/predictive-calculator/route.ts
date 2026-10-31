import { NextRequest, NextResponse } from "next/server";
import admin, { adminAuth, adminDb } from "@/lib/firebase-admin";
import { getDriveClient } from "@/lib/google-drive";
import quincenasHistorical from "@/lib/quincenas-historical-data.json";

interface PlatformMetrics {
  platform: string;
  currency: "USD" | "EUR";
  periodsCount: number;
  totalHours: number;
  totalTokens: number;
  totalEarningsUsdOrEur: number;
  biweeklyTokens: { p25: number; p50: number; p75: number; maxObserved: number };
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

// Factores estacionales empíricos de WooW Estudios (calculados sobre las 109 quincenas
// de Quincenas 2.xlsx y Quincenas 3.xlsx de 2022 a 2026, normalizados por la cantidad exacta de creadoras activas):
// - Enero, Diciembre, Julio, Agosto y Junio son la temporada ALTA real de la agencia.
const SEASONAL_FACTORS: Record<string, any> = quincenasHistorical.seasonalFactors;

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
  if (low.includes("cam4")) return "CAM4";
  if (low.includes("camsoda")) return "CamSoda";
  if (low.includes("bongacams")) return "Bongacams";
  if (low.includes("dreamcam")) return "Dreamcam";
  if (low.includes("myfreecams")) return "MyFreecams";
  if (low.includes("amateur")) return "Amateur";
  return p.trim();
}

function toEquivTokensAndEarnings(platName: string, rawVal: number): { tokens: number; earnings: number; currency: "USD" | "EUR" } {
  const num = Number(rawVal);
  if (!Number.isFinite(num) || num <= 0) {
    return { tokens: 0, earnings: 0, currency: platName === "XLove" ? "EUR" : "USD" };
  }
  const p = platName.toLowerCase();
  // Plataformas cuyo registro en Quincenas 2 y 3 ya está en USD ($)
  if (p.includes("streamate") || p.includes("livejasmin") || p.includes("skyprivate")) {
    return {
      tokens: Math.round(num * 20), // $1 USD = 20 tokens ($0.05)
      earnings: Math.round(num * 100) / 100,
      currency: "USD"
    };
  }
  // XLove cuyo registro en Quincenas 2 y 3 está en EUR (€)
  if (p.includes("xlove")) {
    return {
      tokens: Math.round(num * 21.6), // €1 EUR ~= $1.08 USD = 21.6 tokens
      earnings: Math.round(num * 100) / 100,
      currency: "EUR"
    };
  }
  // Bongacams (45 tokens = $1 USD)
  if (p.includes("bongacams")) {
    const usd = num / 45;
    return {
      tokens: Math.round(usd * 20),
      earnings: Math.round(usd * 100) / 100,
      currency: "USD"
    };
  }
  // Plataformas en tokens de $0.05 USD (Chaturbate, Stripchat, CAM4, CamSoda, Dreamcam, MyFreecams, Amateur)
  return {
    tokens: Math.round(num),
    earnings: Math.round(num * 0.05 * 100) / 100,
    currency: "USD"
  };
}

/**
 * Parser exacto de CSV según el formato de cada plataforma en Drive:
 * - Chaturbate: Fecha;Acción;;Tokens;Saldo de tokens (separado por ';', Tokens en columna 3)
 * - Stripchat: Usuarios,Fecha,Tipo,Tokens (separado por ',', Tokens en última columna)
 * - Streamate: Customer Nickname,Transaction Time (UTC),Duration (Seconds),Type,Performer Earned,... (columna 4)
 */
function parseCsvContent(text: string, hintPlatform: string | null): {
  platform: string;
  tokens: number;
  earnings: number;
  durationSeconds: number;
} {
  const lines = text.split('\n');
  if (lines.length === 0) {
    return { platform: hintPlatform || "Chaturbate", tokens: 0, earnings: 0, durationSeconds: 0 };
  }

  const header = lines[0].toLowerCase();

  // 1. Formato Streamate
  if (header.includes("performer earned") || header.includes("customer nickname") || hintPlatform === "Streamate") {
    let earn = 0;
    let durationSec = 0;
    for (const l of lines.slice(1)) {
      if (!l.trim()) continue;
      const cols = l.split(',');
      if (cols[2] && cols[2] !== "N/A") {
        durationSec += parseInt(cols[2], 10) || 0;
      }
      if (cols[4]) {
        const val = parseFloat(cols[4].replace('$', '').trim()) || 0;
        if (val > 0) earn += val;
      }
    }
    return {
      platform: "Streamate",
      tokens: Math.round(earn / 0.05),
      earnings: Math.round(earn * 100) / 100,
      durationSeconds: durationSec
    };
  }

  // 2. Formato Chaturbate (separado por punto y coma ';')
  if (header.includes("saldo de tokens") || lines[0].includes(";")) {
    let tkSum = 0;
    for (const l of lines.slice(1)) {
      if (!l.trim()) continue;
      const parts = l.split(';');
      if (parts.length >= 4) {
        const rawTk = parts[3].replace(/["\s\u00a0]/g, '');
        const val = parseInt(rawTk, 10);
        if (!isNaN(val) && val > 0) {
          tkSum += val;
        }
      }
    }
    return {
      platform: "Chaturbate",
      tokens: tkSum,
      earnings: Math.round(tkSum * 0.05 * 100) / 100,
      durationSeconds: 0
    };
  }

  // 3. Formato Stripchat ("Usuarios,Fecha,Tipo,Tokens")
  if (header.includes("usuarios") || header.includes("tipo,tokens") || hintPlatform === "Stripchat") {
    let tkSum = 0;
    for (const l of lines.slice(1)) {
      if (!l.trim()) continue;
      const parts = l.split(',');
      const lastCol = parts[parts.length - 1];
      if (lastCol) {
        const rawTk = lastCol.replace(/["\s\u00a0]/g, '');
        const val = parseInt(rawTk, 10);
        if (!isNaN(val) && val > 0) {
          tkSum += val;
        }
      }
    }
    return {
      platform: "Stripchat",
      tokens: tkSum,
      earnings: Math.round(tkSum * 0.05 * 100) / 100,
      durationSeconds: 0
    };
  }

  return { platform: hintPlatform || "Chaturbate", tokens: 0, earnings: 0, durationSeconds: 0 };
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

    // 1. Obtener datos, cuentas activas y aliases de Firestore + Mapa de Usuarios Activos de Quincenas 3
    let modelData: any = null;
    const enabledPlatformsSet = new Set<string>();
    let searchAliases: string[] = [nickname, nickname.toLowerCase(), nickname.replace(/\s+/g, '_')];

    if (modelId && adminDb) {
      try {
        const docSnap = await adminDb.collection("models").doc(modelId).get();
        if (docSnap.exists) {
          modelData = docSnap.data();
          if (modelData.nickname) {
            searchAliases.push(modelData.nickname, modelData.nickname.toLowerCase());
          }
          if (modelData.name) {
            searchAliases.push(modelData.name, modelData.name.toLowerCase());
          }
          // Extraer plataformas y usernames de accounts activas
          if (Array.isArray(modelData.accounts)) {
            modelData.accounts.forEach((acc: any) => {
              if (acc && acc.status === "active" && acc.platformName) {
                const normPlat = normalizePlatformName(acc.platformName);
                enabledPlatformsSet.add(normPlat);
                if (acc.username && !acc.username.includes("@")) {
                  const cleanUser = String(acc.username).trim();
                  searchAliases.push(cleanUser, cleanUser.toLowerCase());
                }
              }
            });
          }
          if (Array.isArray(modelData.platforms)) {
            modelData.platforms.forEach((p: string) => {
              const normPlat = normalizePlatformName(p);
              enabledPlatformsSet.add(normPlat);
            });
          }
        }

        const profileSnap = await adminDb.collection("modelos_profile_v2").doc(modelId).get();
        if (profileSnap.exists) {
          const pData = profileSnap.data();
          if (pData?.platformAliases) {
            Object.entries(pData.platformAliases).forEach(([, arr]: [string, any]) => {
              if (Array.isArray(arr)) {
                arr.forEach(a => {
                  if (a) {
                    const clean = String(a).trim();
                    searchAliases.push(clean, clean.toLowerCase());
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

    // Cruzar también con la hoja "Usuarios activos" de Quincenas 3 (ej. Aleja_Hill <-> Engel_boss, SweetKitty <-> Natalia_Kiss01)
    const activeGroups = (quincenasHistorical as any).activeUsersMap || [];
    for (const group of activeGroups) {
      const matchGroup = group.some((gAlias: string) => {
        const gClean = gAlias.toLowerCase().replace(/[^a-z0-9]/g, "");
        return searchAliases.some(sa => sa.toLowerCase().replace(/[^a-z0-9]/g, "") === gClean);
      });
      if (matchGroup) {
        group.forEach((gAlias: string) => searchAliases.push(gAlias, gAlias.toLowerCase()));
      }
    }

    searchAliases = Array.from(new Set(searchAliases.filter(a => a && a.length >= 3)));

    const periodMap = new Map<string, PeriodDetail>();
    let totalObservedDays = 0;
    let sundaySessionsCount = 0;
    let holidaySessionsCount = 0;

    // 2. Precargar el historial completo de Quincenas 2.xlsx y Quincenas 3.xlsx para esta modelo
    const historicalModels: Record<string, { rawName: string; records: any[] }> = (quincenasHistorical as any).models || {};
    const matchedHistKeys = new Set<string>();

    for (const [mKey, mObj] of Object.entries(historicalModels)) {
      const isMatch = searchAliases.some(alias => {
        const aClean = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
        return aClean.length >= 4 && (mKey === aClean || (aClean.length >= 6 && (mKey.includes(aClean) || aClean.includes(mKey))));
      });
      if (isMatch) {
        matchedHistKeys.add(mKey);
      }
    }

    for (const mKey of Array.from(matchedHistKeys)) {
      const records = historicalModels[mKey]?.records || [];
      for (const rec of records) {
        const periodKey = rec.period; // ej. "2026-07-01_to_2026-07-15"
        const monthNum = rec.month || 1;
        const platformsObj = rec.platforms || {};

        for (const [rawPlat, rawVal] of Object.entries(platformsObj)) {
          const plat = normalizePlatformName(rawPlat);
          const conv = toEquivTokensAndEarnings(plat, Number(rawVal));
          if (conv.tokens > 0) {
            // Si la quincena es reciente (2025 o 2026), habilitar automáticamente esa plataforma para la modelo
            if (periodKey.startsWith("2025") || periodKey.startsWith("2026")) {
              enabledPlatformsSet.add(plat);
            }
            const mapKey = `${periodKey}_${plat}`;
            const existing = periodMap.get(mapKey);
            if (!existing || conv.tokens > existing.tokens) {
              periodMap.set(mapKey, {
                period: periodKey,
                month: monthNum,
                platform: plat,
                currency: conv.currency,
                hours: existing?.hours || 60, // Base quincenal si aún no hay telemetría horaria
                tokens: conv.tokens,
                earnings: conv.earnings,
                followersGain: existing?.followersGain || Math.round(60 * 1.8),
                dailyHours: existing?.dailyHours || [],
                sundayHours: existing?.sundayHours || 0,
                holidayHours: existing?.holidayHours || 0
              });
            }
          }
        }
      }
    }

    // 3. Extraer horas exactas históricas del Drive (BATCH_MENSUAL) y enriquecer las quincenas
    const batchFolders = [
      { id: '1NHOLMCekNrrOUjrRgOxkUfsjC-M76C4n', platform: 'Chaturbate', currency: 'USD' as const },
      { id: '1HrtxbSUgDJP04VxKkOmIAJELkbrYilrP', platform: 'Stripchat', currency: 'USD' as const }
    ];

    for (const bf of batchFolders) {
      try {
        const batchList = await drive.files.list({
          q: `'${bf.id}' in parents and trashed = false`,
          fields: 'files(id, name)',
          pageSize: 40,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        });

        const files = batchList.data.files || [];
        for (const file of files) {
          if (!file.id || !file.name) continue;
          const matchPeriod = file.name.match(/(\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2})/);
          const periodKey = matchPeriod ? matchPeriod[1] : file.name;
          const monthNum = parseInt(periodKey.substring(5, 7), 10) || 1;
          // Normalizar llave quincenal (01_to_15 o 16_to_30) para cruzar con Quincenas 2 y 3
          const startDay = parseInt(periodKey.substring(8, 10), 10) || 1;
          const yearMonth = periodKey.substring(0, 7);
          const normPeriodKey = startDay <= 15 ? `${yearMonth}-01_to_${yearMonth}-15` : `${yearMonth}-16_to_${yearMonth}-30`;

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
              if (searchAliases.some(a => {
                const aClean = a.toLowerCase().replace(/[^a-z0-9]/g, "");
                return aClean === kClean || (aClean.length > 4 && (kClean.includes(aClean) || aClean.includes(kClean)));
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
              const mapKey = `${normPeriodKey}_${bf.platform}`;
              const existing = periodMap.get(mapKey);

              if (existing) {
                if (totalHours > 0) existing.hours = Math.round(totalHours * 10) / 10;
                if (followersDiff > 0) existing.followersGain = followersDiff;
                existing.dailyHours = dailyHoursArr;
                existing.sundayHours = Math.round(periodSundayHours * 10) / 10;
                existing.holidayHours = Math.round(periodHolidayHours * 10) / 10;
              } else if (totalHours > 0) {
                periodMap.set(mapKey, {
                  period: normPeriodKey,
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
            }
          } catch (eInner) {
            console.warn(`Error procesando batch ${file.name}:`, eInner);
          }
        }
      } catch (eBf) {
        console.warn(`Error listando batch ${bf.platform}:`, eBf);
      }
    }

    // 4. Cruzar también con los archivos CSV nuevos en Historico APIS de Drive (por si hay quincenas aún no pasadas al Excel)
    const seenCsvFileIds = new Set<string>();
    const folderPlatformCache = new Map<string, string>();

    for (const alias of searchAliases) {
      try {
        const csvSearch = await drive.files.list({
          q: `name contains '${alias.replace(/'/g, "\\'")}' and mimeType = 'text/csv' and trashed = false`,
          fields: 'files(id, name, parents)',
          pageSize: 50,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        });

        const csvFiles = csvSearch.data.files || [];
        for (const cf of csvFiles) {
          if (!cf.id || !cf.name || seenCsvFileIds.has(cf.id)) continue;
          seenCsvFileIds.add(cf.id);

          const matchPeriod = cf.name.match(/(\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2})/);
          if (!matchPeriod) continue;
          const rawPeriodKey = matchPeriod[1];
          const monthNum = parseInt(rawPeriodKey.substring(5, 7), 10) || 1;
          const startDay = parseInt(rawPeriodKey.substring(8, 10), 10) || 1;
          const yearMonth = rawPeriodKey.substring(0, 7);
          const periodKey = startDay <= 15 ? `${yearMonth}-01_to_${yearMonth}-15` : `${yearMonth}-16_to_${yearMonth}-30`;

          let hintPlat: string | null = null;
          if (cf.parents && cf.parents[0]) {
            const pId = cf.parents[0];
            if (folderPlatformCache.has(pId)) {
              hintPlat = folderPlatformCache.get(pId)!;
            } else {
              try {
                const parentMeta = await drive.files.get({ fileId: pId, fields: 'name', supportsAllDrives: true });
                const pName = (parentMeta.data.name || "").toUpperCase();
                if (pName === "CB" || pName.includes("CHATURBATE")) hintPlat = "Chaturbate";
                else if (pName === "SC" || pName.includes("STRIPCHAT")) hintPlat = "Stripchat";
                else if (pName === "SM" || pName.includes("STREAMATE")) hintPlat = "Streamate";
                if (hintPlat) folderPlatformCache.set(pId, hintPlat);
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
            const parsedCsv = parseCsvContent(text, hintPlat);
            const plat = parsedCsv.platform;

            if (parsedCsv.tokens > 0 || parsedCsv.earnings > 0) {
              enabledPlatformsSet.add(plat);
            }

            const mapKey = `${periodKey}_${plat}`;
            const existing = periodMap.get(mapKey);

            const cbSamePeriod = periodMap.get(`${periodKey}_Chaturbate`);
            const fallbackHours = cbSamePeriod && cbSamePeriod.hours > 0 ? cbSamePeriod.hours : 60;

            if (existing) {
              existing.tokens = Math.max(existing.tokens, parsedCsv.tokens);
              existing.earnings = Math.max(existing.earnings, parsedCsv.earnings);
              if (existing.hours === 0) existing.hours = fallbackHours;
            } else if (parsedCsv.tokens > 0) {
              periodMap.set(mapKey, {
                period: periodKey,
                month: monthNum,
                platform: plat,
                currency: plat === "XLove" ? "EUR" : "USD",
                hours: fallbackHours,
                tokens: parsedCsv.tokens,
                earnings: parsedCsv.earnings,
                followersGain: Math.round(fallbackHours * 1.8),
                dailyHours: [],
                sundayHours: 0,
                holidayHours: 0
              });
            }
          } catch (eCsv) {
            console.warn(`Error leyendo CSV ${cf.name}:`, eCsv);
          }
        }
      } catch (errAlias) {
        console.warn("Error buscando CSV de modelo:", errAlias);
      }
    }

    // Sincronizar las horas simultáneas de Chaturbate a las demás páginas de la misma quincena
    for (const p of Array.from(periodMap.values())) {
      const cbSame = periodMap.get(`${p.period}_Chaturbate`);
      if (cbSame && cbSame.hours > 0 && (p.hours === 60 || p.hours === 0)) {
        p.hours = cbSame.hours;
      }
    }

    // Filtrar solo las plataformas donde realmente tiene actividad o están habilitadas
    const allPeriods = Array.from(periodMap.values()).filter(p => p.tokens > 0 || p.hours > 0);
    const platformsWithData = new Set(allPeriods.filter(p => p.tokens > 0).map(p => p.platform));

    const finalEnabledPlatforms = Array.from(enabledPlatformsSet).filter(
      p => platformsWithData.has(p) || ["Chaturbate", "Stripchat", "Streamate"].includes(p)
    );
    if (finalEnabledPlatforms.length === 0) finalEnabledPlatforms.push("Chaturbate");

    // 5. Construir métricas específicas POR CADA PLATAFORMA basadas directamente en sus quincenas reales
    const platformBreakdown: Record<string, PlatformMetrics> = {};
    const STANDARD_BIWEEK_HOURS = 66; // 6 horas x 11 días hábiles

    for (const plat of finalEnabledPlatforms) {
      const platPeriods = allPeriods.filter(p => p.platform === plat && (p.tokens > 0 || p.hours > 0));
      const biweeklyTokensSamples: number[] = [];
      const fphSamples: number[] = [];
      let sumHours = 0;
      let sumTokens = 0;
      let sumEarnings = 0;

      for (const pp of platPeriods) {
        sumHours += pp.hours;
        sumTokens += pp.tokens;
        sumEarnings += pp.earnings;

        if (pp.tokens > 0) {
          biweeklyTokensSamples.push(pp.tokens);
        }
        if (pp.followersGain > 0 && pp.hours >= 15) {
          fphSamples.push(pp.followersGain / pp.hours);
        }
      }

      const sortedBiweeklyTokens = biweeklyTokensSamples.length > 0
        ? [...biweeklyTokensSamples].sort((a, b) => a - b)
        : [1800, 3200, 4800];

      const sortedFph = fphSamples.length > 0
        ? [...fphSamples].sort((a, b) => a - b)
        : [1.5, 2.8, 4.5];

      const bwP25 = Math.round(calculatePercentile(sortedBiweeklyTokens, 25));
      const bwP50 = Math.round(calculatePercentile(sortedBiweeklyTokens, 50));
      const bwP75 = Math.round(calculatePercentile(sortedBiweeklyTokens, 75));
      const bwMax = sortedBiweeklyTokens[sortedBiweeklyTokens.length - 1] || bwP75;

      // Anclar la tasa por hora a los percentiles quincenales reales divididos por las 66h estándar
      const p25T = Math.max(5, Math.round(bwP25 / STANDARD_BIWEEK_HOURS));
      const p50T = Math.max(10, Math.round(bwP50 / STANDARD_BIWEEK_HOURS));
      const p75T = Math.max(15, Math.round(bwP75 / STANDARD_BIWEEK_HOURS));

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
        biweeklyTokens: {
          p25: bwP25,
          p50: bwP50,
          p75: bwP75,
          maxObserved: bwMax
        },
        tokensPerHour: {
          p25: p25T,
          p50: p50T,
          p75: p75T
        },
        followersPerHour: {
          p25: Math.max(0.8, p25F),
          p50: Math.max(1.5, p50F),
          p75: Math.max(2.5, p75F)
        },
        earningsPerHour: {
          p25: Math.round(p25T * 0.05 * 100) / 100,
          p50: Math.round(p50T * 0.05 * 100) / 100,
          p75: Math.round(p75T * 0.05 * 100) / 100
        }
      };
    }

    // 6. Construir opción TOTALIZADA ("ALL") sumando los tokens reales de todas sus páginas en cada quincena
    const combinedByPeriod = new Map<string, { tokens: number; hours: number; followers: number }>();
    for (const p of allPeriods) {
      const curr = combinedByPeriod.get(p.period) || { tokens: 0, hours: 0, followers: 0 };
      curr.tokens += p.tokens;
      curr.hours = Math.max(curr.hours, p.hours);
      curr.followers += p.followersGain;
      combinedByPeriod.set(p.period, curr);
    }

    const totalBiweeklyTokensArr = Array.from(combinedByPeriod.values())
      .map(v => v.tokens)
      .filter(t => t >= 200)
      .sort((a, b) => a - b);

    const allBwP25 = totalBiweeklyTokensArr.length > 0 ? Math.round(calculatePercentile(totalBiweeklyTokensArr, 25)) : 6500;
    const allBwP50 = totalBiweeklyTokensArr.length > 0 ? Math.round(calculatePercentile(totalBiweeklyTokensArr, 50)) : 10500;
    const allBwP75 = totalBiweeklyTokensArr.length > 0 ? Math.round(calculatePercentile(totalBiweeklyTokensArr, 75)) : 15500;
    const allBwMax = totalBiweeklyTokensArr.length > 0 ? totalBiweeklyTokensArr[totalBiweeklyTokensArr.length - 1] : 22000;

    const allTphP25 = Math.max(20, Math.round(allBwP25 / STANDARD_BIWEEK_HOURS));
    const allTphP50 = Math.max(35, Math.round(allBwP50 / STANDARD_BIWEEK_HOURS));
    const allTphP75 = Math.max(50, Math.round(allBwP75 / STANDARD_BIWEEK_HOURS));

    const grandTotalTokens = allPeriods.reduce((acc, c) => acc + c.tokens, 0);
    const grandTotalEarnings = allPeriods.reduce((acc, c) => acc + c.earnings, 0);
    const grandTotalHours = Array.from(combinedByPeriod.values()).reduce((acc, c) => acc + c.hours, 0);

    platformBreakdown["ALL"] = {
      platform: "ALL",
      currency: "USD",
      periodsCount: combinedByPeriod.size,
      totalHours: Math.round(grandTotalHours * 10) / 10,
      totalTokens: grandTotalTokens,
      totalEarningsUsdOrEur: Math.round(grandTotalEarnings * 100) / 100,
      biweeklyTokens: {
        p25: allBwP25,
        p50: allBwP50,
        p75: allBwP75,
        maxObserved: allBwMax
      },
      tokensPerHour: {
        p25: allTphP25,
        p50: allTphP50,
        p75: allTphP75
      },
      followersPerHour: {
        p25: 2.2,
        p50: 3.8,
        p75: 6.2
      },
      earningsPerHour: {
        p25: Math.round(allTphP25 * 0.05 * 100) / 100,
        p50: Math.round(allTphP50 * 0.05 * 100) / 100,
        p75: Math.round(allTphP75 * 0.05 * 100) / 100
      }
    };

    return NextResponse.json({
      success: true,
      model: {
        id: modelId,
        nickname: nickname || modelData?.nickname || "Modelo",
        name: modelData?.name || nickname,
        enabledPlatforms: finalEnabledPlatforms
      },
      stats: {
        totalObservedDays,
        sundaySessionsCount,
        holidaySessionsCount,
        periodsCount: combinedByPeriod.size
      },
      platformBreakdown,
      calendarAverages: {
        standardWorkDaysPerBiweek: 11,
        sundaysPerBiweek: 2,
        holidaysPerBiweek: 1,
        sundayBoostRatio: 1.15,
        holidayBoostRatio: 1.18
      },
      positioningFactors: {
        logarithmicThresholdHours: 4.0,
        fullShiftBoost6h: 1.0,
        shortShiftPenalty: 0.82
      },
      seasonalFactors: SEASONAL_FACTORS,
      periods: allPeriods.sort((a, b) => b.period.localeCompare(a.period))
    });

  } catch (error: any) {
    console.error("Error en API de predicción por plataforma:", error);
    return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 });
  }
}
