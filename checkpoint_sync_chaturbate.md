# Checkpoint: Sincronización Chaturbate Dinámica

Este documento sirve como punto de retorno para continuar con el desarrollo de la lógica de sincronización de Chaturbate.

## Estado Actual
1.  **API Dinámica Realizada:** El endpoint `/api/sync-chaturbate` ahora recorre automáticamente todos los perfiles en `modelos_profile_v2` que tengan habilitada la plataforma "Chaturbate".
2.  **Detección de Estado Optimizada:**
    *   **HTML Stream Check:** Se utiliza la presencia de fragmentos de video (`m3u8`, `hls`) para confirmar que el stream está activo. Es mucho más fiable que el flag `is_live`.
    *   **Double Check:** Se prioriza el chequeo de stream. Solo se marca como `public` si el HTML da positivo O si el API de eventos detecta propinas nuevas (`tokensFound > 0`).
3.  **Vinculación V1 - V2:** El sistema busca el documento en la colección legacy `models` comparando el `nickname` (con insensibilidad a mayúsculas) para actualizar los campos `is_online` y `stream_stats`.
4.  **Verificación Sara_Love_1:** Confirmado que el ID `9Zh18DbCKI9xyVJRhhfL` se actualiza correctamente con el estado de sincronización.

## Próximos Pasos Pendientes
*   **Depuración de Sienna_Lux01:** Validar si tras el último cambio de "Double Check" ya aparece como `offline` correctamente (debería ser así ya que su HTML no tiene `m3u8`).
*   **Automatización:** Considerar un Cron Job o Intervalo para que esta sincronización no dependa solo del click manual si se requiere tiempo real constante.
*   **Métricas de Ingresos:** Asegurar que los tokens se sumen correctamente en `daily_metrics` cuando se detecten eventos de tipo `tip`.

## Archivos Clave
*   `src/app/api/sync-chaturbate/route.ts`: Motor principal de sincronización.
*   `auditoria_sync.md`: Resultados de la última auditoría de base de datos.
*   `api_debug_sara_love_1.md`: Estructura técnica de la API de Chaturbate.

**Para retomar:** Simplemente solicita "continuar donde íbamos" y usaré este documento para recuperar el contexto exacto.
