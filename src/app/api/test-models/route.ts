import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  if (!adminDb) return NextResponse.json({ error: 'No admin DB' });
  const snapshot = await adminDb.collection('models').limit(5).get();
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json(data);
}
