import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, limit } from 'firebase/firestore';

export async function GET() {
  try {
    const qProfiles = query(collection(db, "modelos_profile_v2"), limit(5));
    const snapshot = await getDocs(qProfiles);
    
    const profiles = snapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data()
    }));

    const qModels = query(collection(db, "models"), limit(5));
    const mSnapshot = await getDocs(qModels);
    const models = mSnapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data()
    }));

    return NextResponse.json({ 
      success: true, 
      profileCount: profiles.length,
      recentProfiles: profiles,
      recentModels: models
    });
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
