# Guía de Renovación del Token de Acceso de GitHub 🔑

¡Hola! GitHub te ha enviado este aviso porque tu **Personal Access Token (classic)** llamado **"Antigravity (repo workflow)"** va a expirar en **6 días**. 

Este token es esencialmente la "contraseña segura" que utiliza tu computadora local (Git en Windows) para conectarse con tu repositorio de GitHub (`studioswoow-bot/asesoria-woow`) y poder subir o descargar código de forma segura. Si el token expira, verás errores de autenticación al intentar subir cambios a producción.

A continuación, tienes los pasos exactos y sumamente sencillos para renovarlo y actualizarlo en tu sistema Windows.

---

## 🛠️ Paso 1: Regenerar el Token en GitHub

1. Abre tu navegador e inicia sesión en GitHub con la cuenta asociada: **`studioswoow-bot`**.
2. Accede directamente al enlace de regeneración que te proporcionó GitHub:
   👉 **[Regenerar Token Antigravity en GitHub](https://github.com/settings/tokens/3922177428/regenerate)**
3. Al ingresar, verás la pantalla de configuración del token. Los alcances obligatorios (`repo` y `workflow`) ya estarán seleccionados por defecto:
   - **`repo`**: Permite interactuar con los repositorios privados y públicos.
   - **`workflow`**: Permite a la herramienta actualizar flujos de trabajo de GitHub Actions si fuera necesario.
4. **Definir la Expiración (Expiration):**
   - Si no quieres volver a recibir este correo cada cierto tiempo, puedes cambiar la expiración a **"No expiration"** (Sin expiración) o elegir un periodo más largo como **90 días** o **1 año** según tus preferencias de seguridad.
5. Desplázate al final de la página y haz clic en el botón verde: **"Regenerate token"** (Regenerar token).
6. **⚠️ ¡MUY IMPORTANTE! ⚠️**
   - GitHub te mostrará una cadena de texto larga que empieza con **`ghp_...`**.
   - **Cópiala de inmediato y no cierres la pestaña** hasta que la hayas guardado o la hayas pegado en el siguiente paso. *Por razones de seguridad, GitHub nunca te volverá a mostrar este código.*

---

## 💻 Paso 2: Actualizar el Token en Windows

Dado que utilizas Windows, tu sistema almacena esta credencial de forma segura para que no tengas que escribirla cada vez. Vamos a actualizarla con el nuevo token que acabas de copiar:

1. Presiona la tecla **Windows** de tu teclado y escribe **"Administrador de credenciales"** (en inglés: *Credential Manager*). Abre la aplicación.
2. Selecciona la opción **"Credenciales de Windows"** (en la derecha, icono de un archivador azul).
3. Desplázate hacia abajo hasta la sección **"Credenciales genéricas"** (Generic Credentials).
4. Busca la entrada que dice: **`git:https://github.com`** (o `github.com` a secas).
5. Haz clic sobre ella para expandirla y selecciona **"Editar"** (Edit).
6. En el campo de **Contraseña** (Password), borra la contraseña anterior y **pega el nuevo token (`ghp_...`)** que copiaste en el Paso 1.
7. Haz clic en **"Guardar"** (Save).

---

## ✅ ¡Todo Listo!

¡Eso es todo! Con estos dos sencillos pasos:
- Tu token de GitHub estará renovado.
- Tu entorno local de desarrollo seguirá autenticándose perfectamente.
- Los despliegues automáticos a **Firebase App Hosting** continuarán funcionando con normalidad (ya que el servicio de hosting de Firebase se vincula directamente a través de una App de GitHub autorizada y no se ve afectado por la expiración de este token clásico individual).

Si tienes alguna pregunta o si te aparece algún error al hacer este proceso, avísame y lo resolvemos juntos de inmediato. 😊
