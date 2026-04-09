import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") || "silacitex_effys";
    let modelId = id;
    
    // Si pasaron nickname, buscar el ID real
    if (id === "silacitex_effys") {
       const snap = await adminDb.collection("models").where("nickname", "==", "silacitex_effys").get();
       if (!snap.empty) {
         modelId = snap.docs[0].id;
       }
    }

    const modelDoc = await adminDb.collection("models").doc(modelId).get();
    
    const dMetrics = await adminDb.collection("daily_metrics").where("model_id", "==", modelId).orderBy("date", "desc").limit(3).get();
    const metricsData = dMetrics.docs.map(d => d.data());

    const wHours = await adminDb.collection("work_hours").where("model_id", "==", modelId).orderBy("date", "desc").limit(3).get();
    const hoursData = wHours.docs.map(d => d.data());

    // Search anywhere for icj / icr specifically
    // We will just return everything
    return NextResponse.json({
       model: modelDoc.data(),
       daily_metrics: metricsData,
       work_hours: hoursData
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
