import { NextResponse } from 'next/server';
import { findOrCreateFolder, uploadFileToFolder } from '@/lib/google-drive';

export async function GET() {
  try {
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    if (!rootFolderId) {
      return NextResponse.json({ error: "No root folder ID in .env.local" }, { status: 500 });
    }

    const testNickname = "SIM_Sary_Test";
    const historyBaseFolderId = await findOrCreateFolder("DEBUG_SIMULATIONS", rootFolderId);
    const modelFolderId = await findOrCreateFolder(testNickname, historyBaseFolderId);

    // Simulamos 20 movimientos (textos, usuarios, tokens)
    const mockEvents = [];
    const names = ["VIP_John", "Toxico_Lander", "Stud_Lucas", "Fan_Maria", "King_Beto", "Dark_Knight", "Sweet_Angie", "Crypto_Papi"];
    const actions = ["tipped", "sent_message", "private_chat", "public_chat", "toy_vibrated"];

    for (let i = 1; i <= 20; i++) {
        const user = names[Math.floor(Math.random() * names.length)];
        const action = actions[Math.floor(Math.random() * actions.length)];
        const tokens = action.includes("tip") || action.includes("chat") || action.includes("toy") ? Math.floor(Math.random() * 500) + 1 : 0;
        
        mockEvents.push({
            id: `evt_${Date.now()}_${i}`,
            timestamp: new Date(Date.now() - (20 - i) * 60000).toISOString(),
            user: user,
            action: action,
            tokens: tokens,
            message: action === "sent_message" ? `Hello! Simulation message ${i}` : null,
            details: `Simulated event ${i} for test purposes`
        });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `simulation_${testNickname}_${timestamp}.json`;

    const result = await uploadFileToFolder(modelFolderId, fileName, {
      simulationDate: new Date().toISOString(),
      nickname: testNickname,
      totalMovements: mockEvents.length,
      totalTokensSimulated: mockEvents.reduce((acc, e) => acc + e.tokens, 0),
      data: mockEvents
    });

    return NextResponse.json({
      success: true,
      message: "Simulación de 20 movimientos subida correctamente.",
      fileName: fileName,
      driveId: result.id,
      mockDataSnippet: mockEvents.slice(0, 3) 
    });

  } catch (error: any) {
    console.error("Error en debug-drive:", error);
    return NextResponse.json({ 
        error: error.message,
        details: error.stack 
    }, { status: 500 });
  }
}
