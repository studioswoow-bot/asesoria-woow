# Contexto del Módulo de Analíticas - Stitch

Este documento sirve como guía de referencia para el desarrollo y mantenimiento del módulo de analíticas de modelos en la aplicación Next.js.

## Arquitectura y Componentes Clave

### 1. Página Principal de Analíticas
- **Ruta**: `src/app/models/analytics/page.tsx`
- **Función**: Orquestador principal de la vista de analíticas. Maneja el estado de las pestañas (Chaturbate, Stripchat, Global y Comparativa) y la selección de periodos.
- **Variables Críticas**:
  - `id`: ID del modelo (obtenido de `searchParams`).
  - `activeTab`: Controla qué vista se renderiza.
  - `startDate` / `endDate`: Rango de fechas para las métricas actuales.

### 2. Componente de Comparativa Evolutiva
- **Ruta**: `src/components/analytics/QuincenaComparison.tsx`
- **Función**: Realiza un análisis histórico comparando múltiples quincenas (default: 6).
- **Lógica de Periodos**: Implementa un algoritmo nativo para generar rangos de fechas quincenales (Q1: 1-15, Q2: 16-fin de mes) hacia atrás desde la fecha actual.

## Orígenes de Datos

### API de Métricas Globales
- **Endpoint**: `/api/action-plans/metrics`
- **Parámetros**: `modelId`, `start`, `end`.
- **Uso**: Obtiene TPH, ICJ e ICR consolidados (facturación real de 7288e).

### Firestore (Caché de Plataformas)
- **Colección**: `modelos_analytics_cache_v2`
- **ID del Documento**: `${modelId}_${periodo}_${plataforma}`
- **Uso**: Obtiene datos específicos de cada plataforma como Rank, Seguidores y crecimiento de audiencia.

## Flujo de Despliegue
- El código se almacena en **GitHub** (`main`).
- Cualquier cambio debe ser commiteado y pusheado para que el entorno de producción (Vercel/Firebase) lo procese.
- **Comando típico**: `git add .; git commit -m "..."; git push origin main`.

## Tecnologías y Estándares
- **Estilos**: Vanilla CSS y Tailwind (clases directas).
- **Iconos**: Material Symbols Outlined (`material-symbols-outlined`).
- **Fechas**: Se utiliza el objeto `Date` nativo de JavaScript para evitar dependencias pesadas como `date-fns` si no están instaladas.
- **Autenticación**: Firebase Auth (se requiere pasar el Bearer Token en los headers de los fetch).

---
*Última actualización: 16 de mayo de 2026*
