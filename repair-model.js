import { db } from './src/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

async function repair() {
  console.log("Iniciando reparación de Sienna_Lux01...");
  const q = query(collection(db, 'models'), where('nickname', '==', 'Sienna_Lux01'));
  const snap = await getDocs(q);
  
  if (!snap.empty) {
    const docRef = doc(db, 'models', snap.docs[0].id);
    await updateDoc(docRef, { status: 'active' });
    console.log("¡ÉXITO! Sienna_Lux01 restaurada a estado 'active'.");
  } else {
    console.log("No se pudo encontrar a Sienna_Lux01 para reparar.");
  }
}

repair().catch(console.error);
