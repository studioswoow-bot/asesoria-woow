import * as admin from "firebase-admin";

/**
 * Firebase Admin SDK — WooW Estudios
 * Requiere las siguientes variables de entorno en .env.local:
 *   FIREBASE_PROJECT_ID=estudioswoow-7288e
 *   FIREBASE_CLIENT_EMAIL=<email de la cuenta de servicio de Firebase>
 *   FIREBASE_PRIVATE_KEY=<clave privada de la cuenta de servicio>
 *
 * NOTA: Estas son credenciales DIFERENTES a las de Google Drive.
 * Obtenerlas desde: Firebase Console > Configuración del Proyecto > Cuentas de Servicio.
 */
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || "estudioswoow-7288e";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    console.error(
      "❌ Firebase Admin SDK: Faltan FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY en .env.local. " +
      "Las API Routes de administración no funcionarán correctamente."
    );
  } else {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
      console.log("✅ Firebase Admin SDK inicializado correctamente.");
    } catch (error) {
      console.error("❌ Firebase Admin initialization error:", error);
    }
  }
}

export const adminAuth = admin.apps.length ? admin.auth() : null;
export const adminDb = admin.apps.length ? admin.firestore() : null;
export default admin;
