import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

/**
 * Helper para verificar que el request viene de un Admin autenticado.
 * Lanza un error si la verificación falla.
 */
async function verifyAdminToken(req: Request) {
  if (!adminAuth || !adminDb) {
    throw new Error("Firebase Admin SDK no está inicializado. Revisa las variables de entorno.");
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("No autorizado: Falta el token de autenticación.");
  }

  const token = authHeader.split("Bearer ")[1];
  const decodedToken = await adminAuth.verifyIdToken(token);

  // Verificar el rol en Firestore para asegurar que es admin
  const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== "admin") {
    throw new Error("Acceso denegado: Se requiere rol de Administrador.");
  }

  return decodedToken;
}

export async function GET(req: Request) {
  try {
    await verifyAdminToken(req);

    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: "Firebase Admin no inicializado." }, { status: 500 });
    }

    const listUsersResult = await adminAuth.listUsers(100);
    const users = await Promise.all(
      listUsersResult.users.map(async (userRecord) => {
        const userDoc = await adminDb!.collection("users").doc(userRecord.uid).get();
        const profileData = userDoc.exists ? userDoc.data() : {};

        return {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName || profileData?.displayName || "",
          role: profileData?.role || "Sin rol",
          createdAt: userRecord.metadata.creationTime,
          lastLogin: userRecord.metadata.lastSignInTime,
          disabled: userRecord.disabled,
        };
      })
    );

    return NextResponse.json(users);
  } catch (error: any) {
    const isAuthError = error.message?.includes("No autorizado") || error.message?.includes("Acceso denegado");
    return NextResponse.json({ error: error.message }, { status: isAuthError ? 401 : 500 });
  }
}

// FIX: Se eliminan POST, DELETE y PATCH para proteger la base de datos compartida de 7288e.
// La gestión de usuarios debe realizarse desde el panel principal de administración.
