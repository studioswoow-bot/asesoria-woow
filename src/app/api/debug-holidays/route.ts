import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const list = await adminDb.listCollections();
    const names = list.map(c => c.id);
    
    const possible = ['holidays', 'festivos', 'dias_festivos', 'config', 'public_holidays', 'feriados'];
    const results: any = {};
    for (const p of possible) {
      if (names.includes(p)) {
        const snap = await adminDb.collection(p).limit(5).get();
        results[p] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    }
    
    return NextResponse.json({ names, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
