# Protocolo de Seguridad y Aislamiento - Estudios WooW

Este documento establece las reglas estrictas para el desarrollo y despliegue de la aplicación de **Registro de Modelos V2**, garantizando la integridad de la aplicación original (`estudioswoow-7288e`).

## 1. Reglas de Base de Datos (Firestore)

### Prohibición de Escritura
Se prohíbe terminantemente realizar operaciones de escritura (`set`, `update`, `delete`, `addDoc`) sobre las siguientes colecciones pertenecientes a la aplicación original:
- `models`
- `daily_metrics`

### Lógica de Conectividad
- La unión entre aplicaciones se realizará exclusivamente mediante el campo **`nickname`** (Apodo) de la modelo.
- Toda consulta a la aplicación original debe ser **estrictamente de solo lectura (Read-Only)**.

### Nuevas Colecciones Exclusivas
Todas las funcionalidades de esta nueva aplicación deben persistirse en colecciones nuevas para evitar colisiones de datos:
- `modelos_profile_v2` (Atributos, sexionario, hashtags)
- `modelos_api_integrations` (Credenciales de APIs de plataformas)
- `modelos_action_plans_v2` (Planes de acción y seguimiento avanzado)

## 2. Reglas de Despliegue (Hosting)

### Multi-site Independiente
- El despliegue de esta aplicación **nunca** debe realizarse sobre el sitio principal de Hosting.
- Se debe utilizar el target `registro-modelos` configurado en `.firebaserc`.
- Comando de despliegue oficial: `firebase deploy --only hosting:registro-modelos`.

## 3. Seguridad a Nivel de Servidor (Rules)

Se deben mantener las reglas de seguridad en `firestore.rules` que bloquean explícitamente el acceso de escritura de esta aplicación a las colecciones antiguas, sirviendo como un "firewall" técnico adicional.

---
**Nota:** Cualquier modificación que requiera alterar datos en `models` debe ser discutida y aprobada explícitamente, evaluando el impacto en la App V1.
