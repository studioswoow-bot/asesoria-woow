# Análisis de la API de Sara_love_1

Este documento detalla la estructura y los valores actuales que arroja la Events API de Chaturbate para la modelo **Sara_love_1**.

## URL de la API
`https://eventsapi.chaturbate.com/events/sara_love_1/wIHqFjoDmRhW7fuGmoIPH4UB/`

## Última Respuesta Capturada (Batch Actual)
Respuesta obtenida el: **2026-03-21 23:03:00**

```json
{
  "events": [],
  "nextUrl": "https://eventsapi.chaturbate.com/events/sara_love_1/wIHqFjoDmRhW7fuGmoIPH4UB/?i=1774152151818&timeout=10"
}
```

### Interpretación de la respuesta vacía:
*   `events: []`: Significa que no han ocurrido eventos significativos (propinas, cambios de estado, mensajes de sistema) desde la última vez que el servidor sincronizó (hace unos segundos).
*   `nextUrl`: Es el puntero que el sistema debe usar para la siguiente consulta. El parámetro `i` indica la posición en la línea de tiempo de eventos.

## Estructura Esperada de Eventos (Formatos Posibles)

Cuando la modelo está activa y recibiendo actividad, los objetos dentro del array `events` siguen este formato:

### 1. Recibo de Propinas (Tips)
```json
{
  "method": "tip",
  "body": {
    "tokens": 25,
    "user": "ejemplo_user",
    "is_fan": true,
    "message": "Que linda eres!"
  }
}
```

### 2. Cambio de Estado de Sala (Room Status)
```json
{
  "method": "room_status",
  "body": {
    "status": "public",
    "viewers": 142
  }
}
```

### 3. Mensajes de Chat / Sistema
```json
{
  "method": "chat_message",
  "body": {
    "user": "ejemplo_user",
    "message": "Hola!",
    "is_mod": false
  }
}
```

## Monitor de Detección en Tiempo Real
En la última sincronización masiva:
*   **Sara_love_1**: Detectada como `public` (en línea) mediante la detección de stream de video en el HTML.
*   **natalia_kiss01**: Detectada como `offline` (sin señal de video detectada).
*   **Sienna_Lux01**: Detectada como `offline` (sin señal de video actual).

> [!NOTE]
> La Events API de Chaturbate es un "stream". Solo devuelve lo que ha pasado en el pequeño hueco de tiempo entre una llamada y otra. Por eso es normal ver la lista de eventos vacía si no hay propinas constantes en ese preciso segundo.
