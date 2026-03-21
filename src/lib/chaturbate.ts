/**
 * PROTOCOLO DE SEGURIDAD Y AISLAMIENTO — COMPLIANT
 * Este archivo contiene ÚNICAMENTE funciones de lectura desde Chaturbate.
 * Las operaciones de escritura en `models` y `daily_metrics` se realizan
 * EXCLUSIVAMENTE en el servidor via `/api/sync-chaturbate` (Admin SDK).
 *
 * @see SEGURIDAD_Y_AISLAMIENTO.md
 */

export interface ChaturbateEvent {
  method: string;
  id: string;
  dateTime: string;
  body: any;
}

export interface ChaturbateSyncResult {
  success: boolean;
  eventsProcessed?: number;
  tokensFound?: number;
  currentStatus?: string;
  error?: string;
}

/**
 * Llama al endpoint de servidor para sincronizar los eventos de un modelo.
 * La escritura real en Firestore ocurre en el servidor (Admin SDK).
 *
 * @param token - Firebase ID Token del usuario autenticado
 */
export async function triggerModelSync(token: string): Promise<ChaturbateSyncResult> {
  try {
    const response = await fetch("/api/sync-chaturbate", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || "Error en el servidor." };
    }

    return data;
  } catch (error: any) {
    console.error("Error al llamar al endpoint de sincronización:", error);
    return { success: false, error: error.message };
  }
}
