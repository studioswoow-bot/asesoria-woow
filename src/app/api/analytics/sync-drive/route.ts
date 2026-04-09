import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { getDriveClient } from "@/lib/google-drive";
import * as xlsx from "xlsx";
import fs from 'fs';
import path from 'path';

// Interfaces para tipado estricto
interface SyncRequest {
  modelId: string;
  nickname: string;
  period: string; // ej. "2026-01-01_to_2026-01-15" o "2026-01-01_to_2026-03-15"
  platform?: "Chaturbate" | "Stripchat";
}

export async function POST(req: Request) {
  try {
    // 1. Verificación de Autenticación
    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: "Firebase Admin no inicializado." }, { status: 500 });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado. Token inexistente." }, { status: 401 });
    }

    try {
      await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
    } catch {
      return NextResponse.json({ error: "Token inválido o expirado." }, { status: 401 });
    }

    // 2. Extracción de Parámetros
    const body: SyncRequest = await req.json();
    const { modelId, nickname, period, platform = "Chaturbate" } = body;

    if (!modelId || !nickname || !period) {
      return NextResponse.json({ error: "Faltan parámetros requeridos (modelId, nickname, period)." }, { status: 400 });
    }

    console.log(`[Drive Sync] Iniciando sincronización de ${nickname} para ${period} (${platform})`);
    const drive = await getDriveClient();

    // 3. Obtener ALIASES del perfilamiento (modelos_profile_v2)
    let folderAliases: string[] = [nickname, nickname.toLowerCase(), nickname.replace(/\s+/g, '_'), nickname.replace(/\s+/g, '')];
    
    // Soportar nombres con espacios por defecto (ej. Natalia_Kiss01 -> Natalia Kiss)
    folderAliases.push(nickname.replace(/_/g, ' '));
    folderAliases.push(nickname.replace(/_/g, ' ').toLowerCase());

    try {
      // Intentar obtener datos de modelos_profile_v2 (perfil extendido)
      const profileSnap = await adminDb.collection("modelos_profile_v2").doc(modelId).get();
      if (profileSnap.exists) {
        const pData = profileSnap.data();
        
        // 1. Apodos específicos por plataforma
        const pAliases = pData?.platformAliases?.[platform] || [];
        if (Array.isArray(pAliases)) {
          pAliases.forEach(a => {
            if (a) {
              const cleanA = String(a).trim();
              folderAliases.push(cleanA, cleanA.toLowerCase(), cleanA.replace(/\s+/g, '_'), cleanA.replace(/_/g, ' '));
            }
          });
        }
        
        // 2. Nombre Real (pData.generalInfo.realName)
        const realName = pData?.generalInfo?.realName;
        if (realName) {
            folderAliases.push(realName, realName.toLowerCase(), realName.replace(/\s+/g, '_'), realName.replace(/_/g, ' '));
        }
      }

      // Intentar obtener datos de models (colección base) para asegurar nombre real
      const baseSnap = await adminDb.collection("models").doc(modelId).get();
      if (baseSnap.exists) {
          const bData = baseSnap.data();
          if (bData?.name) {
              folderAliases.push(bData.name, bData.name.toLowerCase(), bData.name.replace(/\s+/g, '_'), bData.name.replace(/_/g, ' '));
          }
      }
    } catch (e) {
      console.warn("[Drive Sync] Error al recuperar aliases del perfil:", e);
    }
    
    // Eliminar duplicados y entries vacías
    folderAliases = Array.from(new Set(folderAliases.filter(Boolean)));
    console.log(`[Drive Sync] Buscando carpetas con los siguientes nombres: ${folderAliases.join(', ')}`);

    // 4. Parsear el rango de fechas del periodo
    const [startStr, endStr] = period.split('_to_');
    const periodStart = startStr ? new Date(`${startStr}T00:00:00`) : null;
    const periodEnd = endStr ? new Date(`${endStr}T23:59:59.999`) : null;
    const periodStartTime = periodStart ? periodStart.getTime() : 0;
    const periodEndTime = periodEnd ? periodEnd.getTime() : Date.now();

    // 5. Navegar la jerarquía de carpetas: Nickname/Alias → Platform (CB/SC)
    const platformCode = platform === "Chaturbate" ? "CB" : "SC";

    // 5a. Buscar carpetas que coincidan con los nombres/aliases (Búsqueda Exacta primero)
    const allModelFolders: any[] = [];
    for (const name of folderAliases) {
        const escapedName = name.replace(/'/g, "\\'");
        const search = await drive.files.list({
            q: `name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            pageSize: 10
        });
        if (search.data.files) {
            allModelFolders.push(...search.data.files);
        }
    }

    // 5b. Si no se encontró nada exacto, intentar búsqueda parcial (Fuzzy) con el nickname
    if (allModelFolders.length === 0) {
        console.log(`[Drive Sync] Sin coincidencias exactas. Iniciando búsqueda parcial para: ${nickname}`);
        const shortNickname = nickname.split(/[_\s]/)[0]; // Tomar la primera palabra (ej. "Hotcakes")
        const escapedShort = shortNickname.replace(/'/g, "\\'");
        
        const fuzzySearch = await drive.files.list({
            q: `name contains '${escapedShort}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            pageSize: 20
        });
        if (fuzzySearch.data.files) {
            allModelFolders.push(...fuzzySearch.data.files);
        }
    }

    // Encontrar la carpeta con subcarpeta Platform (CB/SC)
    let platformFolderId: string | null = null;
    let modelFolderUsed = "";

    for (const folder of allModelFolders) {
      if (!folder.id) continue;
      
      // Intentar primero con el código corto (SC/CB) y luego con el nombre completo
      const possiblePlatformFolders = [platformCode, platform, platform.replace(/chat/i, 'Chat'), "StripChat"];
      if (platformCode === "SC") {
          possiblePlatformFolders.push("ST");
      }
      
      let platformFiles: any[] = [];
      const uniquePossibleFolders = Array.from(new Set(possiblePlatformFolders));
      for (const pName of uniquePossibleFolders) {
          const platformSearch = await drive.files.list({
            q: `name = '${pName}' and '${folder.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          });
          if (platformSearch.data.files && platformSearch.data.files.length > 0) {
              platformFiles = platformSearch.data.files;
              break;
          }
      }

      if (platformFiles.length > 0) {
        platformFolderId = platformFiles[0].id!;
        modelFolderUsed = folder.name!;
        console.log(`[Drive Sync] Carpeta encontrada: ${folder.name} → ${platformFiles[0].name} (${platformFolderId})`);
        break;
      }
    }

    if (!platformFolderId) {
      return NextResponse.json({
        error: `No se encontró la carpeta "${platformCode}" asociada a ${nickname} (o sus apodos: ${folderAliases.join(', ')}) en Google Drive.`,
        debug: { searchedFolders: allModelFolders.map(f => f.name), platformCode }
      }, { status: 404 });
    }

    // 4b. Listar todos los archivos CSV/XLSX dentro de la carpeta de plataforma
    const allFilesRes = await drive.files.list({
      q: `'${platformFolderId}' in parents and (mimeType = 'text/csv' or mimeType = 'text/plain' or mimeType = 'application/csv' or mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType = 'application/vnd.google-apps.spreadsheet') and trashed = false`,
      fields: 'files(id, name, mimeType)',
      orderBy: 'name asc',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageSize: 100
    });

    const allDriveFiles = allFilesRes.data.files || [];
    console.log(`[Drive Sync] Total de archivos en ${platformCode}: ${allDriveFiles.length} → ${allDriveFiles.map(f => f.name).join(', ')}`);

    if (allDriveFiles.length === 0) {
      return NextResponse.json({
        error: `No se encontraron archivos CSV/XLSX en la carpeta ${platformCode} de ${nickname}.`
      }, { status: 404 });
    }

    // 4c. Filtrar archivos cuyo rango de fechas en el nombre se solape con el periodo solicitado
    // Formato esperado: nickname_YYYY-MM-DD_to_YYYY-MM-DD.csv
    const datePattern = /(\d{4}-\d{2}-\d{2})_to_(\d{4}-\d{2}-\d{2})/;

    const relevantFiles = allDriveFiles.filter(file => {
      const match = file.name?.match(datePattern);
      if (!match) return true; // Si no tiene fecha en el nombre, incluirlo de todas formas
      const fileStart = new Date(`${match[1]}T00:00:00`).getTime();
      const fileEnd = new Date(`${match[2]}T23:59:59.999`).getTime();
      // El archivo es relevante si su rango se solapa con el periodo solicitado
      return fileStart <= periodEndTime && fileEnd >= periodStartTime;
    });

    console.log(`[Drive Sync] Archivos relevantes para ${period}: ${relevantFiles.length} → ${relevantFiles.map(f => f.name).join(', ')}`);

    if (relevantFiles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No Data for Period',
        message: `Se encontraron ${allDriveFiles.length} archivos en la carpeta ${platformCode} de ${nickname}, pero ninguno cubre el periodo ${startStr} al ${endStr}. Archivos disponibles: ${allDriveFiles.map(f => f.name).join(', ')}`
      }, { status: 404 });
    }

    // --- Variables de Análisis Global ---
    // 6. Obtener nombres de todas las modelos para excluir propinas entre ellas (Chaturbate)
    const EXCLUDED_STUDIO_USERS = ["woow_studies", "woow_admin", "woow_monitor", "estudioswoow", "woow_estudios", "woow_estudio"];
    
    try {
      const modelsSnap = await adminDb.collection("models").get();
      
      const normalizeUsername = (u: any) => 
          String(u || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^\x20-\x7E]/g, '')
            .toLowerCase()
            .replace(/[\s\xA0\u200B\uFEFF]/g, '')
            .trim();

      modelsSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.name) {
           const norm = normalizeUsername(data.name);
           EXCLUDED_STUDIO_USERS.push(norm);
           EXCLUDED_STUDIO_USERS.push(norm.replace(/\s+/g, '_'));
           EXCLUDED_STUDIO_USERS.push(norm.replace(/_/g, ' '));
        }
        if (data.nickname) {
           EXCLUDED_STUDIO_USERS.push(normalizeUsername(data.nickname));
        }
      });
    } catch (e) {
      console.warn("[Drive Sync] Error recuperando lista de modelos para exclusión:", e);
    }
    let totalTokens = 0;
    let tipTokens = 0;
    let privateTokens = 0;
    const incomeConcepts: Record<string, number> = { private: 0, spy: 0, public: 0, videos: 0, photos: 0, other: 0 };
    const tippersMap: Record<string, number> = {};
    const tippersDetailedMap: Record<string, { totalTokens: number, hours: Record<string, number>, days: Set<string> }> = {};
    let intentionMentions = { privates: 0, requestedVideo: 0 };
    const peakHoursCount: Record<string, number> = {};
    const peakHoursUsers: Record<string, Set<string>> = {};
    const actionTypesFound = new Set<string>();
    let totalHoursStreamed = 0;
    let maxFollowerGrowth = 0;
    let fileFoundAndParsed = false;
    const scannedFiles: any[] = [];
    
    // Almacén para métricas diarias cruzadas
    const dailyStats: Record<string, { total: number, users: Record<string, number> }> = {};

    // Matriz de mapa de calor 7 días (0=Domingo..6=Sábado) x 24 horas (0-23)
    const globalHeatmap = Array.from({length: 7}, (_, dayIndex) => ({
       day: dayIndex,
       hours: Array.from({length: 24}, (_, hIndex) => ({ hour: hIndex, online_snapshots: 0, tokens: 0, average_viewers: 0, viewers_sum: 0 }))
    }));

    // Helper: parsear fechas en español (ej: "31 ene 2026, 19:14" o "15 de enero de 2026 16:33")
    const parseSpanishDate = (dateStr: string): number | null => {
      if (!dateStr || typeof dateStr !== "string") return null;
      const months: Record<string, string> = {
        ene: "Jan", enero: "Jan", "jan": "Jan", "january": "Jan",
        feb: "Feb", febrero: "Feb", "february": "Feb",
        mar: "Mar", marzo: "Mar", "march": "Mar",
        abr: "Apr", abril: "Apr", "april": "Apr",
        may: "May", mayo: "May",
        jun: "Jun", junio: "Jun", "june": "Jun",
        jul: "Jul", julio: "Jul", "july": "Jul",
        ago: "Aug", agosto: "Aug", "august": "Aug",
        sep: "Sep", sept: "Sep", septiembre: "Sep", "september": "Sep",
        oct: "Oct", octubre: "Oct", "october": "Oct",
        nov: "Nov", noviembre: "Nov", "november": "Nov",
        dic: "Dec", diciembre: "Dec", "december": "Dec"
      };
      let clean = dateStr.toLowerCase()
        .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\ufeff]/g, ' ')
        .replace(/ de /g, ' ') 
        .replace(/\b(a\s?m)\b/gi, ' AM') // Soporta "am", "a m", "a.m." (los puntos ya se quitaron o se quitan después)
        .replace(/\b(p\s?m)\b/gi, ' PM')
        .replace(/\./g, ' ')    
        .replace(/,/g, ' ')    
        .replace(/\s+/g, ' ')
        .trim();
      
      // Buscar y reemplazar el mes
      for (const [es, en] of Object.entries(months)) {
        if (clean.includes(es)) {
          // Asegurar que no reemplazamos partes de palabras (ej: "mar" en "marzo")
          // Reemplazamos la palabra completa si es posible
          const regex = new RegExp(`\\b${es}\\b`, 'g');
          if (regex.test(clean)) {
             clean = clean.replace(regex, en);
             break;
          }
        }
      }
      // 1. Intentar parseo nativo de JS (después de limpieza básica)
      const nativeParsed = Date.parse(clean);
      if (!isNaN(nativeParsed)) return nativeParsed;

      // 2. Intentar Regex para formatos con meses en texto (ej: "15 jan 2026")
      const dateParts = clean.match(/(\d{1,2})\s+([a-z]{3,10})\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
      if (dateParts) {
        const day = parseInt(dateParts[1]);
        const monthSlug = dateParts[2].slice(0, 3).toLowerCase();
        const year = parseInt(dateParts[3]);
        const hours = parseInt(dateParts[4] || '0');
        const minutes = parseInt(dateParts[5] || '0');
        
        let ampmOffset = 0;
        if (clean.includes(' pm') && hours < 12) ampmOffset = 12;
        if (clean.includes(' am') && hours === 12) ampmOffset = -12;

        const monthMap: Record<string, number> = { 
          jan: 0, ene: 0, feb: 1, mar: 2, apr: 3, abr: 3, may: 4, jun: 5, 
          jul: 6, aug: 7, ago: 7, sep: 8, oct: 9, nov: 10, dec: 11, dic: 11 
        };
        const month = monthMap[monthSlug] ?? 0;
        return new Date(year, month, day, hours + ampmOffset, minutes).getTime();
      }

      // 3. Fallback para DD/MM/YYYY o DD-MM-YYYY
      const dmyMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(\s+(.*))?$/);
      if (dmyMatch) {
        const day = parseInt(dmyMatch[1]);
        const month = parseInt(dmyMatch[2]) - 1;
        const year = parseInt(dmyMatch[3]);
        const rest = dmyMatch[5] || "";
        const timeMatch = rest.match(/(\d{1,2}):(\d{2})/);
        const hours = timeMatch ? parseInt(timeMatch[1]) : 0;
        const minutes = timeMatch ? parseInt(timeMatch[2]) : 0;
        return new Date(year, month, day, hours, minutes).getTime();
      }

      // 4. Último recurso: intentar con la cadena original si tiene separadores comunes
      if (dateStr.includes('-') || dateStr.includes('/')) {
        const generic = new Date(dateStr);
        if (!isNaN(generic.getTime())) return generic.getTime();
      }

      return null;
    };

    // 5. Procesar cada archivo relevante
    for (const file of relevantFiles) {
      if (!file.id) continue;

      try {
        console.log(`[Drive Sync] Procesando: ${file.name}`);

        let buffer: Buffer;
        if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
          // Google Sheets nativo → exportar como XLSX
          const exportRes = await drive.files.export(
            { fileId: file.id, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
            { responseType: 'arraybuffer' }
          );
          buffer = Buffer.from(exportRes.data as any);
        } else {
          const spreadsheetResponse = await drive.files.get(
            { fileId: file.id, alt: 'media' },
            { responseType: 'arraybuffer' }
          );
          buffer = Buffer.from(spreadsheetResponse.data as any);
        }

        // Auto-detect delimiter for CSV files
        // Auto-detect delimiter for CSV/TSV files
        let workbook: xlsx.WorkBook;
        const isCsv = (file.name || "").endsWith('.csv') || (file.mimeType || "").includes('csv') || (file.mimeType || "").includes('text/plain');
        
        if (isCsv) {
          // Detectar encoding (UTF-8 vs UTF-16LE)
          const isUtf16 = buffer[0] === 0xFF && buffer[1] === 0xFE;
          let rawText = isUtf16 ? buffer.toString('utf16le') : buffer.toString('utf8');
          rawText = rawText.replace(/^\uFEFF/, ''); // Quitar BOM
          
          const firstLine = rawText.split('\n')[0] || '';
          let delimiter = ',';
          if (firstLine.includes('\t')) delimiter = '\t';
          else if (firstLine.includes(';')) delimiter = ';';
          
          console.log(`[Drive Sync] Archivo de texto detectado (UTF-16: ${isUtf16}) | Separador: '${delimiter}'`);

          const lines = rawText.split('\n');
          const firstDataLine = lines.find((l, idx) => idx > 0 && l.trim().length > 0);
          const isStripchatFormat = firstDataLine?.trim().startsWith('"') && firstDataLine?.trim().endsWith('"') && firstDataLine?.includes('""');
          
          if (isStripchatFormat) {
            console.log(`[Drive Sync] Detectado formato Stripchat/Wrapped. Normalizando...`);
            rawText = lines.map((line, idx) => {
              const trimmedLine = line.replace(/\r$/, '').trim(); 
              if (idx === 0) return line.replace(/\r$/, '');
              if (trimmedLine.startsWith('"') && trimmedLine.endsWith('"')) {
                return trimmedLine.slice(1, -1).replace(/""/g, '"');
              }
              return line.replace(/\r$/, '');
            }).join('\n');
          }

          workbook = xlsx.read(rawText, { type: 'string', FS: delimiter, cellDates: true });
        } else {
          workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
        }
        const sheetName = workbook.SheetNames[0];
        const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        console.log(`[Drive Sync] ${file.name}: ${rawData.length} filas parseadas. Primeras keys:`, rawData.length > 0 ? Object.keys(rawData[0] as object) : 'vacío');

        if (rawData.length === 0) {
          console.log(`[Drive Sync] Archivo vacío: ${file.name}`);
          continue;
        }

        let fileTokens = 0;
        // Usado para calcular horas de stream estimadas
        let firstTx: number | null = null;
        let lastTx: number | null = null;

        rawData.forEach((row: any, rowIndex: number) => {
          try {
            // ---------------------------------------------------------------
            // EXTRACCIÓN ROBUSTA DE COLUMNAS (Normalización de cabeceras)
            // ---------------------------------------------------------------
            const normalizedRow: any = {};
            Object.keys(row).forEach(key => {
              // Normalización avanzada: quitar acentos y caracteres no ASCII
              const cleanKey = String(key)
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "") // Quitar acentos (diacríticos)
                .replace(/[^\x20-\x7E]/g, '')    // Quitar otros caracteres raros
                .toLowerCase()
                .trim();
              normalizedRow[cleanKey] = row[key];
            });

            const findValue = (patterns: string[], fallback: any = null) => {
              const keys = Object.keys(normalizedRow);
              // Los patrones ya deben estar en minúsculas y sin acentos para coincidir
              const matchedKey = keys.find(k => 
                patterns.some(p => k.includes(p.toLowerCase()))
              );
              return matchedKey ? normalizedRow[matchedKey] : fallback;
            };

            const rawTokenVal = findValue(["fichas", "token", "gross", "income", "earnings", "value", "monto"], 0);
            const rawUser = findValue(["usuarios", "user", "tipper", "usuario", "sender", "fan", "username", "to", "recipient", "__empty"], "Unknown");
            const rawType = findValue(["type", "tipo", "accion", "transaction", "category"], "");
            const rawTimestamp = findValue(["timestamp", "fecha", "date", "creation", "time"], null);
            const note = String(normalizedRow["Note"] || normalizedRow["note"] || "").toLowerCase();

            const tokensVal = typeof rawTokenVal === 'number' ? rawTokenVal : Number(String(rawTokenVal).replace(/[^\d.-]/g, ''));
            
            // Normalización ROBUSTA de usuario (quita acentos, emojis invisible, BOMs mal leídos, etc)
            const username = String(rawUser)
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^\x20-\x7E]/g, '')   // Quita símbolos como 
              .toLowerCase()
              .replace(/[\s\xA0\u200B\uFEFF]/g, '')
              .trim();
              
            const type = String(rawType)
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase();
            
            // Determinar tiempo de la transacción (Soporta objeto Date, Number o String)
            let txTime: number | null = null;
            if (rawTimestamp instanceof Date) {
              txTime = rawTimestamp.getTime();
            } else if (rawTimestamp && typeof rawTimestamp === 'object' && (rawTimestamp as any).getTime) {
              txTime = (rawTimestamp as any).getTime();
            } else if (typeof rawTimestamp === 'number') {
              if (rawTimestamp < 100000) { // Excel date
                txTime = (rawTimestamp - 25569) * 86400 * 1000;
              } else {
                txTime = rawTimestamp; // Epoch ms
              }
            } else if (rawTimestamp) {
              txTime = parseSpanishDate(String(rawTimestamp));
            }

            // Filtrar por rango
            if (!txTime || isNaN(txTime)) return;
            
            // Track de duración estimada (si está en el periodo solicitado)
            if (txTime >= periodStartTime && txTime <= periodEndTime) {
                if (!firstTx || txTime < firstTx) firstTx = txTime;
                if (!lastTx || txTime > lastTx) lastTx = txTime;
            } else {
                return; // Fuera de rango
            }

            const isEarning = type.includes("propina") || type.includes("tip") || type.includes("token") || 
              (!type.includes("transferencia") && !type.includes("payout") && !type.includes("tasa") && !type.includes("estudio"));
            
            if (tokensVal !== 0 && username !== "Unknown" && !EXCLUDED_STUDIO_USERS.includes(username.toLowerCase()) && isEarning) {
              const absTokens = Math.abs(tokensVal);
              totalTokens += absTokens;
              fileTokens += absTokens;
              tippersMap[username] = (tippersMap[username] || 0) + absTokens;

              // Clasificación Detallada de Conceptos
              if (type.includes("spy") || type.includes("espia") || note.includes("spy") || note.includes("espia")) {
                 incomeConcepts.spy += absTokens;
                 privateTokens += absTokens; // spy is technically private
              } else if (type.includes("private") || type.includes("pm") || type.includes("privada") || type.includes("privado") || type.includes("pvt") || note.includes("private") || note.includes("privado") || type.includes("espiando")) {
                 incomeConcepts.private += absTokens;
                 privateTokens += absTokens;
              } else if (type.includes("video") || note.includes("video") || note.includes("vdo")) {
                 incomeConcepts.videos += absTokens;
                 tipTokens += absTokens;
              } else if (type.includes("foto") || type.includes("photo") || note.includes("foto") || note.includes("photo") || type.includes("pic") || note.includes("pic")) {
                 incomeConcepts.photos += absTokens;
                 tipTokens += absTokens;
              } else {
                 incomeConcepts.public += absTokens;
                 tipTokens += absTokens; // assumed public tip
              }

              actionTypesFound.add(type);

              if (note.includes("pm") || note.includes("privado") || note.includes("private") || type.includes("privada")) {
                intentionMentions.privates += 1;
              }
              if (note.includes("video") || note.includes("vdo")) {
                intentionMentions.requestedVideo += 1;
              }

              // Hora pico
              let hour: string | null = null;
              const dateObj = new Date(txTime);
              hour = dateObj.getHours().toString().padStart(2, "0");

              if (hour) {
                const dayOfWeek = dateObj.getDay();
                const hNum = parseInt(hour, 10);
                if (!isNaN(dayOfWeek) && !isNaN(hNum)) {
                   globalHeatmap[dayOfWeek].hours[hNum].tokens += absTokens;
                }
                peakHoursCount[hour] = (peakHoursCount[hour] || 0) + absTokens;
                if (!peakHoursUsers[hour]) peakHoursUsers[hour] = new Set();
                peakHoursUsers[hour].add(username);

                const txDay = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`;
                
                if (!dailyStats[txDay]) {
                    dailyStats[txDay] = { total: 0, users: {} };
                }
                dailyStats[txDay].total += absTokens;
                dailyStats[txDay].users[username] = (dailyStats[txDay].users[username] || 0) + absTokens;
                
                if (!tippersDetailedMap[username]) {
                  tippersDetailedMap[username] = { totalTokens: 0, hours: {}, days: new Set() };
                }
                tippersDetailedMap[username].totalTokens += absTokens;
                tippersDetailedMap[username].hours[hour] = (tippersDetailedMap[username].hours[hour] || 0) + absTokens;
                tippersDetailedMap[username].days.add(txDay);
              }
            }
          } catch (rowError: any) {
             console.warn(`[Drive Sync] Error en fila ${rowIndex} de ${file.name}:`, rowError.message);
          }
        });

        // Estimar horas (mínimo 15 mins si hay transacciones)
        if (firstTx && lastTx) {
            const diffMs = lastTx - firstTx;
            const diffHours = Math.max(0.25, diffMs / (1000 * 60 * 60));
            totalHoursStreamed += diffHours;
        }
        scannedFiles.push({
          name: file.name || "Unknown",
          headers: rawData.length > 0 ? Object.keys(rawData[0] as object) : [],
          rowCount: rawData.length,
          sampleRows: rawData.slice(0, 3)
        });

        if (fileTokens > 0) {
          console.log(`[Drive Sync] ✅ ${file.name}: ${fileTokens} tokens en el periodo solicitado.`);
          fileFoundAndParsed = true;
        } else {
          console.log(`[Drive Sync] ⚠️ ${file.name}: 0 tokens en el rango ${startStr} a ${endStr}`);
        }

      } catch (e: any) {
        console.error(`[Drive Sync] ❌ Error procesando ${file.name}:`, e.message, e.stack?.split('\n').slice(0, 3).join(' | '));
      }
    }

    // GENERAR DIAGNÓSTICO (Siempre, para auditoría)
    try {
      const debugData = { 
        scannedFiles, 
        actionTypes: Array.from(actionTypesFound),
        period, 
        startStr, 
        endStr, 
        periodStartTime, 
        periodEndTime,
        stats: { totalTokens, tipTokens, privateTokens, fileFoundAndParsed }
      };
      const debugPath = path.join(process.cwd(), 'ULTIMO_ERROR_SYNC.json');
      fs.writeFileSync(debugPath, JSON.stringify(debugData, null, 2));
      console.log(`[Drive Sync] 📁 Diagnóstico actualizado en: ${debugPath}`);
    } catch (err) {
      console.error(`[Drive Sync] Error al escribir diagnóstico:`, err);
    }

    if (!fileFoundAndParsed) {
      const debugDetails = scannedFiles.map(f => 
        `[${f.name} | H: ${f.headers.slice(0,4).join(',')} | Rows: ${f.rowCount} | S: ${JSON.stringify(f.sampleRows?.[0] || {}).slice(0,100)}]`
      ).join(' \n ');

      return NextResponse.json({
        success: false,
        error: 'No Data for Period',
        message: `No se hallaron datos en ${scannedFiles.length} archivos para el periodo ${startStr} → ${endStr}. \n Muestra de datos detectada: \n ${debugDetails}`,
        debug: { 
          scannedFiles, 
          period, 
          startStr, 
          endStr, 
          periodStartTime, 
          periodEndTime 
        }
      }, { status: 404 });
    }

    // 6. Consolidación de Métricas Finales
    const topTippers = Object.entries(tippersMap)
      .map(([name, tokens]) => {
        const details = tippersDetailedMap[name];
        let topHour = { hour: "00", tokens: 0 };
        if (details) {
          Object.entries(details.hours).forEach(([h, t]) => {
            if (t > topHour.tokens) topHour = { hour: h, tokens: t };
          });
        }
        const platformSuffix = platform === "Chaturbate" ? "CB" : "SC";
        return {
          name: `${name} (${platformSuffix})`,
          tokens,
          details: details ? {
            days: Array.from(details.days).sort(),
            topHour,
            hoursDistribution: details.hours
          } : null
        };
      })
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 10);

    // Distribución horaria (garantizando las 24 horas)
    const finalHourlyStats = Array.from({ length: 24 }, (_, i) => {
      const h = i.toString().padStart(2, '0');
      return {
        hour: `${h}:00`,
        tokens: peakHoursCount[h] || 0,
        users: (peakHoursUsers[h] || new Set()).size
      };
    });

    let peakHour = "00:00";
    let maxHourTokens = 0;
    finalHourlyStats.forEach(h => {
      if (h.tokens > maxHourTokens) {
        maxHourTokens = h.tokens;
        peakHour = h.hour;
      }
    });

     let b_followers = 0;
    let b_bestRank = 0;
    let b_bestGrank = 0;
    let b_followerGrowth = 0;
    let b_bestRankDetails: any = null;
    let b_bestGrankDetails: any = null;
    let b_viewersByHour: Record<string, { sum: number; count: number }> = {};
    let b_periodHistory: any[] = [];

    try {
        console.log(`[Drive Sync] Buscando archivos batch globales para el periodo...`);
        
        const batchFilesRes = await drive.files.list({
            q: `name contains 'ALL_MODELS_${platformCode}_' and mimeType = 'application/json' and trashed = false`,
            fields: 'files(id, name)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        });

        const datePattern = /(\d{4}-\d{2}-\d{2})_to_(\d{4}-\d{2}-\d{2})/;
        const relevantBatchFiles = (batchFilesRes.data.files || []).filter(file => {
          const match = file.name?.match(datePattern);
          if (!match) return false;
          const fileStart = new Date(`${match[1]}T00:00:00`).getTime();
          const fileEnd = new Date(`${match[2]}T23:59:59.999`).getTime();
          return fileStart <= periodEndTime && fileEnd >= periodStartTime;
        });

        if (relevantBatchFiles.length > 0) {
            let minFollowers = 99999999;
            let maxFollowers = 0;
            let curBestRank = 999999;
            let curBestGrank = 999999;
            let bestRankDetails: any = null;
            let bestGrankDetails: any = null;
            let foundAny = false;

            for (const batchFile of relevantBatchFiles) {
                console.log(`[Drive Sync] Procesando batch: ${batchFile.name}`);
                const batchResponse = await drive.files.get({ fileId: batchFile.id!, alt: 'media' }, { responseType: 'json' });
                const allData: any = (batchResponse.data as any)?.data || {};
                
                let modelBatchData = null;
                for (const alias of folderAliases) {
                    const searchAlias = alias.toLowerCase().replace(/\s+/g, '_');
                    if (allData[searchAlias]) {
                        modelBatchData = allData[searchAlias];
                        break;
                    }
                    const rawAlias = alias.toLowerCase();
                    if (allData[rawAlias]) {
                        modelBatchData = allData[rawAlias];
                        break;
                    }
                }

                if (modelBatchData && modelBatchData.details) {
                    foundAny = true;
                    Object.entries(modelBatchData.details).forEach(([dateString, dayEntries]: [string, any]) => {
                        if (Array.isArray(dayEntries)) {
                            let dayFollowers = 0;
                            let dayBestRank = 999999;
                            let dayBestGrank = 999999;

                            dayEntries.forEach((entry: any) => {
                                if (entry.followers) {
                                    if (entry.followers > maxFollowers) maxFollowers = entry.followers;
                                    if (entry.followers < minFollowers) minFollowers = entry.followers;
                                    dayFollowers = entry.followers;
                                }
                                if (entry.rank && entry.rank > 0 && entry.rank < curBestRank) {
                                    curBestRank = entry.rank;
                                    bestRankDetails = {
                                       timestamp: entry.timestamp,
                                       viewers: entry.viewers || 0,
                                       followers: entry.followers || 0
                                    };
                                }
                                if (entry.grank && entry.grank > 0 && entry.grank < curBestGrank) {
                                    curBestGrank = entry.grank;
                                    bestGrankDetails = {
                                       timestamp: entry.timestamp,
                                       viewers: entry.viewers || 0,
                                       followers: entry.followers || 0
                                    };
                                }
                                
                                if (entry.rank && entry.rank > 0 && entry.rank < dayBestRank) { dayBestRank = entry.rank; }
                                if (entry.grank && entry.grank > 0 && entry.grank < dayBestGrank) { dayBestGrank = entry.grank; }

                                if (entry.timestamp && entry.viewers !== undefined) {
                                    let hour = "00";
                                    if (entry.timestamp.includes('T')) {
                                        hour = entry.timestamp.split('T')[1].split(':')[0];
                                    }
                                    if (!b_viewersByHour[hour]) b_viewersByHour[hour] = { sum: 0, count: 0 };
                                    b_viewersByHour[hour].sum += Number(entry.viewers || 0);
                                    b_viewersByHour[hour].count += 1;
                                    
                                    const tsObj = new Date(entry.timestamp);
                                    const dow = tsObj.getDay();
                                    const hod = tsObj.getHours();
                                    if (!isNaN(dow) && !isNaN(hod)) {
                                       globalHeatmap[dow].hours[hod].online_snapshots += 1;
                                       globalHeatmap[dow].hours[hod].viewers_sum += Number(entry.viewers || 0);
                                    }
                                }
                            });
                            
                            if (dayBestRank < 999999 || dayBestGrank < 999999 || dayFollowers > 0) {
                                b_periodHistory.push({
                                    date: dateString,
                                    rank: dayBestRank < 999999 ? dayBestRank : null,
                                    grank: dayBestGrank < 999999 ? dayBestGrank : null,
                                    followers: dayFollowers
                                });
                            }
                        }
                    });
                }
            }

            b_periodHistory.sort((a: any, b: any) => a.date.localeCompare(b.date));

            if (foundAny) {
                console.log(`[Drive Sync] Encontrada información histórica en Batch para: ${nickname}`);
                b_bestRank = curBestRank === 999999 ? 0 : curBestRank;
                b_bestGrank = curBestGrank === 999999 ? 0 : curBestGrank;
                b_followers = maxFollowers;
                b_followerGrowth = maxFollowers - minFollowers;
                if (b_followerGrowth < 0 || minFollowers === 99999999) b_followerGrowth = 0;
            }
            
            
            // Helper para obtener top user de un día
            const getDayStats = (timestamp: string) => {
               if (!timestamp) return { total_tokens: 0, top_user: null, top_user_tokens: 0 };
               const day = timestamp.split('T')[0]; // asume formato YYYY-MM-DD...
               if (dailyStats[day]) {
                   const stats = dailyStats[day];
                   let topUser = null;
                   let maxTokens = 0;
                   Object.entries(stats.users).forEach(([user, tokens]) => {
                      const t = tokens as number;
                      if (t > maxTokens) { maxTokens = t; topUser = user; }
                   });
                   return { total_tokens: stats.total, top_user: topUser, top_user_tokens: maxTokens };
               }
               return { total_tokens: 0, top_user: null, top_user_tokens: 0 };
            };
            
            // Pass the details to outer context and enrich
            if (foundAny) {
               if (bestRankDetails && bestRankDetails.timestamp) {
                   const dayInfo = getDayStats(bestRankDetails.timestamp);
                   b_bestRankDetails = { ...bestRankDetails, ...dayInfo };
               }
               if (bestGrankDetails && bestGrankDetails.timestamp) {
                   const dayInfo = getDayStats(bestGrankDetails.timestamp);
                   b_bestGrankDetails = { ...bestGrankDetails, ...dayInfo };
               }
            }
        } else {
             console.log(`[Drive Sync] No se encontraron archivos batch relevantes para el periodo.`);
        }
    } catch (e: any) {
        console.warn("[Drive Sync] Error obteniendo archivos Batch JSON:", e.message);
    }
    
    // Asignar el history desde b_periodHistory (si no existe lo inicializamos vacío)
    let finalPeriodHistory: any[] = [];
    if (typeof b_periodHistory !== 'undefined') {
       finalPeriodHistory = b_periodHistory;
    }

    const augmentedHourlyStats = finalHourlyStats.map((h: any) => {
        const hourPrefix = h.hour.split(':')[0];
        let avg_viewers = 0;
        if (b_viewersByHour[hourPrefix]) {
           const { sum, count } = b_viewersByHour[hourPrefix];
           avg_viewers = count > 0 ? Math.round(sum / count) : 0;
        }
        return { ...h, avg_viewers };
    });

    globalHeatmap.forEach(dayRow => {
        dayRow.hours.forEach(cell => {
            if (cell.online_snapshots > 0) {
               cell.average_viewers = Math.round(cell.viewers_sum / cell.online_snapshots);
            }
        });
    });

    const summaryPayload = {
      model_id: modelId,
      nickname: nickname.toLowerCase(),
      period,
      platform,
      total_tokens: totalTokens,
      tip_tokens: tipTokens,
      private_tokens: privateTokens,
      income_concepts: incomeConcepts,
      top_tippers: topTippers,
      intents: intentionMentions,
      peak_hour: peakHour,
      peak_hour_tokens: maxHourTokens,
      hourly_distribution: augmentedHourlyStats,
      platform_total_hours: Number(totalHoursStreamed.toFixed(2)),
      follower_growth: b_followerGrowth > 0 ? b_followerGrowth : (maxFollowerGrowth > 0 ? maxFollowerGrowth : 0),
      followers_current: b_followers,
      best_rank: b_bestRank,
      best_rank_details: b_bestRankDetails,
      best_grank: b_bestGrank,
      best_grank_details: b_bestGrankDetails,
      history: finalPeriodHistory,
      schedule_matrix: globalHeatmap,
      scanned_files: scannedFiles,
      model_folder_used: modelFolderUsed,
      synced_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 65).toISOString()
    };

    // 7. Guardar en Firestore (modelos_analytics_cache_v2)
    const docId = `${modelId}_${period}_${platform}`;
    await adminDb.collection("modelos_analytics_cache_v2").doc(docId).set(summaryPayload, { merge: true });

    console.log(`[Drive Sync] ✅ Sincronización exitosa para ${nickname} → ${docId} | Total: ${totalTokens} tokens de ${scannedFiles.length} archivos`);

    return NextResponse.json({
      success: true,
      message: `Sincronización exitosa: ${totalTokens.toLocaleString()} tokens de ${scannedFiles.length} archivo(s)`,
      data: summaryPayload
    });

  } catch (error: any) {
    console.error("[Drive Sync] Error Crítico:", error);
    // Incluir stack trace para depuración profunda
    const errorDetails = error.stack || error.message || "Error desconocido";
    return NextResponse.json(
      { 
        success: false, 
        error: `Error de Sincronización: ${error.message || 'Error Interno'}`, 
        details: errorDetails
      },
      { status: 500 }
    );
  }
}
