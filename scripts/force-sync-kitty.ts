import { adminDb } from "../src/lib/firebase-admin";
import { getDriveClient } from "../src/lib/google-drive";
import * as xlsx from "xlsx";

async function forceSync() {
    const modelId = "jjmth5UdzPIsqbIIpnKW"; // Natalia_Kiss01 / Luisa Fernanda
    const nickname = "Natalia_Kiss01";
    const period = "2026-01-01_to_2026-01-15";
    const platform = "Stripchat";

    console.log(`[Force Sync] Iniciando para ${nickname} (${platform}) - Periodo: ${period}`);

    const drive = await getDriveClient();
    const folderAliases = [nickname, "SWEET_KITTY_01", "sweet_kitty_01"];
    
    const [startStr, endStr] = period.split('_to_');
    const periodStart = new Date(`${startStr}T00:00:00`);
    const periodEnd = new Date(`${endStr}T23:59:59.999`);
    const periodStartTime = periodStart.getTime();
    const periodEndTime = periodEnd.getTime();

    const platformCode = "SC";
    let platformFolderId: string | null = null;
    let modelFolderUsed = "";

    // 1. Buscar carpeta
    for (const name of folderAliases) {
        const search = await drive.files.list({
            q: `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
        });
        const folders = search.data.files || [];
        for (const folder of folders) {
            const platformSearch = await drive.files.list({
                q: `name = '${platformCode}' and '${folder.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                fields: 'files(id, name)',
                supportsAllDrives: true,
                includeItemsFromAllDrives: true,
            });
            if (platformSearch.data.files && platformSearch.data.files.length > 0) {
                platformFolderId = platformSearch.data.files[0].id!;
                modelFolderUsed = folder.name!;
                break;
            }
        }
        if (platformFolderId) break;
    }

    if (!platformFolderId) {
        console.error("No se encontró la carpeta SC para ningún alias.");
        return;
    }

    // 2. Listar archivos
    const filesRes = await drive.files.list({
        q: `'${platformFolderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
    });
    const allFiles = filesRes.data.files || [];
    
    let totalTokens = 0;
    const peakHoursCount: Record<string, number> = {};
    const scannedFiles: string[] = [];

    // 3. Procesar archivos (Simplificado para este script de fuerza bruta)
    for (const file of allFiles) {
        if (!file.name?.includes("2026-01-01") && !file.name?.includes("SWEET_KITTY")) continue;
        console.log(`Procesando archivo: ${file.name}`);
        scannedFiles.push(file.name!);

        const res = await drive.files.get({ fileId: file.id!, alt: 'media' }, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(res.data as any);
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const data: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        data.forEach(row => {
            const tokens = Number(String(row["Tokens"] || row["tokens"] || 0).replace(/\s+/g, ''));
            const type = String(row["Tipo"] || "").toLowerCase();
            if (tokens !== 0 && !type.includes("transferencia") && !type.includes("tasa")) {
                totalTokens += Math.abs(tokens);
            }
        });
    }

    console.log(`Total Sincronizado: ${totalTokens} tokens.`);

    // 4. Guardar cache básica para que el dashboard lo vea
    const docId = `${modelId}_${period}_${platform}`;
    await adminDb.collection("modelos_analytics_cache_v2").doc(docId).set({
        model_id: modelId,
        nickname: nickname.toLowerCase(),
        period,
        platform,
        total_tokens: totalTokens,
        synced_at: new Date().toISOString()
    }, { merge: true });

    console.log("Cache de analíticas actualizada.");
}

forceSync().catch(console.error);
