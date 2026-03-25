# Auditoría de Sincronización - Sara y Sienna

Este reporte muestra el estado real de la base de datos tras la última sincronización masiva.

## 1. Sara_Love_1 (Detección Positiva)
El sistema detectó correctamente a Sara en línea a través de la señal de video (`m3u8`).

### Registro en Base de Datos (V1/V2 vinculados por ID)
*   **Artistic Name:** `Sara_Love_1` (ID: `9Zh18DbCKI9xyVJRhhfL`)
*   **Estado Sync Reciente:** `public` (en línea)
*   **Última Sincronización:** **2026-03-21 23:00 (Aprox)**
*   **Viewers actualizados:** 0 (en el momento de captura)
*   **Métricas de Hoy:** Se actualizará en cuanto se procesen los primeros tokens (propinas) detectados.

> [!TIP]
> **COMPROBACIÓN:** Si vas al dashboard, Sara debería aparecer como "En Línea" gracias a este registro.

## 2. Sienna_Lux01 (Posible Falso Positivo Legacy)
El sistema reportó a Sienna como `public` en el mensaje de éxito, pero sospechamos que fue por un evento de estado persistente en su API antigua.

### Análisis Técnico
*   **Legacy URL:** `https://eventsapi.chaturbate.com/events/sienna_lux01/IOUe7l2ULa16OFtVw3t86HfD/`
*   **Comportamiento:** Si el búfer de eventos tiene un evento de tipo `room_status: public`, el sistema lo toma como real si el HTML no logra desmentirlo. 

## 3. Registro de Tokens
El sistema solo añade registros a la tabla histórico/gráficas si detecta el evento de tipo `tip`. Si la modelo está conectada pero nadie le da propinas en ese preciso momento, el estado será `public` pero el contador de tokens se mantendrá igual.

---
**¿Cómo saber si está funcionando?**
Solo mira el campo `synced_at` en el detalle de la modelo (o la base de datos). Si la fecha coincide con tu última pulsación del botón, **el motor de sincronización está vivo y activo**.
