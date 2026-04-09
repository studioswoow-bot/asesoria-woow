const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value.length > 0) {
      process.env[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '');
    }
  });
}

// Inicializar Firebase Admin
if (!admin.apps.length) {
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
        console.error("❌ Faltan credenciales de Firebase en .env.local");
        process.exit(1);
    }

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        })
    });
}

const db = admin.firestore();

/**
 * Script Principal para Sembrar / Actualizar la Caché de IA (1 Año Máximo)
 * Costo: Lee métricas históricas de la BD Perpetua (7288e) y escribe UN (1) documento consolidado en la BD de Asesoría.
 */
async function buildAiCache() {
    console.log("====================================================");
    console.log("🤖 INICIANDO CONSTRUCCIÓN DE CACHÉ ANALÍTICA PARA IA 🤖");
    console.log("====================================================\n");

    try {
        // 1. Obtener modelos activos
        console.log("▶️ Leyendo modelos activos (Source: models [Read Only])...");
        const modelsSnap = await db.collection("models").where("status", "==", "active").get();
        if (modelsSnap.empty) {
            console.log("No hay modelos activos.");
            return;
        }

        const models = [];
        modelsSnap.forEach(doc => models.push({ id: doc.id, ...doc.data() }));
        console.log(`✅ ${models.length} modelos encontrados.\n`);

        // Calcular rango de 365 días
        const today = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setDate(today.getDate() - 365);
        const startDateStr = oneYearAgo.toISOString().split("T")[0];

        // 2. Procesar cada modelo
        for (const model of models) {
            console.log(`⏳ Procesando [${model.nickname || model.name}] (ID: ${model.id})...`);

            // 2.1 Leer daily_metrics (Read Only, Filtro de fecha en memoria para evitar índice compuesto)
            const metricsSnap = await db.collection("daily_metrics")
                .where("model_id", "==", model.id)
                .get();

            // 2.2 Leer work_hours (Read Only, Filtro de fecha en memoria)
            const hoursSnap = await db.collection("work_hours")
                .where("model_id", "==", model.id)
                .get();

            const historyMap = new Map();

            // Consolidar Tokens
            metricsSnap.forEach(doc => {
                const data = doc.data();
                if (!data.date || data.date < startDateStr) return; // Filtro manual
                
                const existing = historyMap.get(data.date) || { tokens: 0, hours: 0, dcm: 0 };
                let tokenValue = Number(data.tokens || 0);
                if (data.currency?.toLowerCase() === "usd") {
                    tokenValue *= 20; // Normalización a Tokens si aplica
                }

                historyMap.set(data.date, {
                    ...existing,
                    tokens: existing.tokens + tokenValue,
                });
            });

            // Consolidar Horas
            hoursSnap.forEach(doc => {
                const data = doc.data();
                if (!data.date || data.date < startDateStr) return; // Filtro manual

                const existing = historyMap.get(data.date) || { tokens: 0, hours: 0, dcm: 0 };
                historyMap.set(data.date, {
                    ...existing,
                    hours: existing.hours + Number(data.hours || 0),
                });
            });

            // 3. Formatear y calcular indicadores (TPH, Z-Score)
            const historyArray = [];
            let totalTokensYear = 0;
            let totalHoursYear = 0;

            for (const [date, stats] of historyMap.entries()) {
                const hours = stats.hours || 0;
                const tokens = stats.tokens || 0;
                const tph = hours > 0 ? (tokens / hours) : 0;
                const dcm = tokens * 0.05; // Estándar de ganancias

                // Z-Score Simulado (Asumimos Promedio Estudio = 1200 TPH, StdDev = 450)
                let zscore = hours > 0 ? (tph - 1200) / 450 : 0;
                if (isNaN(zscore) || !isFinite(zscore)) zscore = 0;

                totalTokensYear += tokens;
                totalHoursYear += hours;

                historyArray.push({
                    date,
                    tokens: Math.round(tokens),
                    hours: Number(hours.toFixed(2)),
                    tph: Number(tph.toFixed(2)),
                    dcm: Number(dcm.toFixed(2)),
                    zscore: Number(zscore.toFixed(2))
                });
            }

            // Ordenar de más reciente a más antiguo
            historyArray.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Asegurar límite estricto de 365 días
            const finalHistory = historyArray.slice(0, 365);
            const avgTphYear = totalHoursYear > 0 ? (totalTokensYear / totalHoursYear) : 0;

            // 4. Escribir en la caché (Colección nueva: Write Permitido)
            const cacheData = {
                modelId: model.id,
                modelName: model.name,
                nickname: model.nickname || "",
                lastUpdated: new Date().toISOString(),
                globalMetrics: {
                    daysTracked: finalHistory.length,
                    totalTokensYear: Math.round(totalTokensYear),
                    totalHoursYear: Number(totalHoursYear.toFixed(2)),
                    avgTphYear: Number(avgTphYear.toFixed(2))
                },
                history: finalHistory
            };

            await db.collection("modelos_analytics_cache_v2").doc(model.id).set(cacheData);
            
            console.log(`   ✔️ Caché generada: ${finalHistory.length} días consolidados.`);
        }

        console.log("\n🚀 SEMBRADO DE CACHÉ FINALIZADO CON ÉXITO.");
        console.log("Esta caché de 1 año ya está lista para ser consumida de forma optimizada por Gemini o el Dashboard V2.");
        process.exit(0);

    } catch (error) {
        console.error("❌ Error construyendo la caché:", error);
        process.exit(1);
    }
}

buildAiCache();
