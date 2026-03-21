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

export async function POST(req: Request) {
  try {
    await verifyAdminToken(req);

    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: "Firebase Admin no inicializado." }, { status: 500 });
    }

    const { email, password, displayName, role } = await req.json();

    if (!email || !password || !role) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios: email, password y role." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres." },
        { status: 400 }
      );
    }

    const validRoles = ["admin", "monitor", "coordinador"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Rol inválido. Los roles permitidos son: ${validRoles.join(", ")}.` },
        { status: 400 }
      );
    }

    // 1. Crear usuario en Firebase Auth
    const userRecord = await adminAuth.createUser({ email, password, displayName });

    // 2. Establecer Custom Claims (para reglas de Firestore)
    await adminAuth.setCustomUserClaims(userRecord.uid, { role });

    // 3. Crear perfil en Firestore (colección 'users' — compatible con la app V1)
    await adminDb.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName: displayName || "",
      role,
      username: email,
      createdAt: new Date(),
    });

    return NextResponse.json({
      uid: userRecord.uid,
      message: `Usuario creado exitosamente con el rol: ${role}`,
    });
  } catch (error: any) {
    const isAuthError = error.message?.includes("No autorizado") || error.message?.includes("Acceso denegado");
    return NextResponse.json({ error: error.message }, { status: isAuthError ? 401 : 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await verifyAdminToken(req);

    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: "Firebase Admin no inicializado." }, { status: 500 });
    }

    const { uid } = await req.json();

    if (!uid) {
      return NextResponse.json({ error: "Falta el UID del usuario." }, { status: 400 });
    }

    // Verificar que no se está borrando a sí mismo (doble verificación en el servidor)
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.split("Bearer ")[1];
    const callerToken = await adminAuth.verifyIdToken(token);
    if (callerToken.uid === uid) {
      return NextResponse.json(
        { error: "No puedes eliminar tu propia cuenta." },
        { status: 400 }
      );
    }

    await adminAuth.deleteUser(uid);
    await adminDb.collection("users").doc(uid).delete();

    return NextResponse.json({ message: "Usuario eliminado exitosamente." });
  } catch (error: any) {
    const isAuthError = error.message?.includes("No autorizado") || error.message?.includes("Acceso denegado");
    return NextResponse.json({ error: error.message }, { status: isAuthError ? 401 : 500 });
  }
}
