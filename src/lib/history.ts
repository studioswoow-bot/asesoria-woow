import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * Saves a historical snapshot of a model's profile.
 * Respects isolation by saving to "modelos_profile_history_v2".
 */
export async function saveProfileHistory(modelId: string, profileData: any) {
  try {
    const historyRef = collection(db, "modelos_profile_history_v2");
    await addDoc(historyRef, {
      modelId,
      ...profileData,
      snapshotDate: new Date().toISOString(),
      timestamp: serverTimestamp()
    });
    console.log(`✅ Snapshot histórico guardado para ${modelId}`);
  } catch (error) {
    console.error("❌ Error al guardar histórico de perfil:", error);
  }
}
