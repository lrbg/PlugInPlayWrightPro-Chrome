# PlaywrightPro — Extensión de Chrome

Extensión de Chrome para grabar, generar y ejecutar tests **Playwright TypeScript** sin escribir código. Incluye un servidor compañero para ejecución local e integración con CI/CD en GitHub Actions y Azure DevOps.

---

## Funcionalidades

| Funcionalidad | Descripción |
|---|---|
| **Formulario de caso de prueba** | Define: número, nombre, descripción, pasos, resultado esperado/actual, etiquetas |
| **Grabador de acciones** | Captura automáticamente clicks, texto, dropdowns, checkboxes, teclado, navegación |
| **Selectores inteligentes** | Prioriza `data-testid` → `aria-label` → rol+nombre → placeholder → label → ruta CSS |
| **Assertions** | Agrega `expect()` con selector, tipo y valor esperado — todas con timeout de 30 s |
| **Capturas de pantalla** | Evidencia en el test con descripción personalizada |
| **Biblioteca de scripts** | Guarda, previsualiza, edita, exporta `.spec.ts` y sube directamente a GitHub |
| **Reportes HTML** | Genera y descarga reportes HTML completos por script |
| **Dashboard** | Tasa de éxito/fallo, duración promedio, resultados por día, top scripts, historial — con botón Limpiar métricas |
| **Ejecución local** | Corre tests via companion server usando `channel: 'chrome'` |
| **Auto-inicio del servidor** | LaunchAgent de macOS inicia el servidor automáticamente al iniciar sesión |
| **CI/CD** | YAML incluido para GitHub Actions y Azure DevOps |
| **Webhook** | Recibe resultados de CI/CD directamente en el Dashboard |

---

## Requisitos

| Dependencia | Versión | Notas |
|---|---|---|
| **Node.js** | 18+ | Requerido para el servidor compañero y herramientas de build |
| **npm** | 8+ | Incluido con Node.js |
| **Google Chrome** | 120+ | Requerido para la extensión y ejecución con `channel: 'chrome'` |
| **@playwright/test** | 1.49+ | Instalado en la raíz con `npm install` |
| **TypeScript** | 5.7+ | Dependencia de desarrollo — se instala automáticamente |

> Google Chrome debe estar instalado en la máquina donde el companion server ejecuta los tests. Playwright usa el binario de Chrome instalado (no el Chromium incluido) cuando `channel: 'chrome'` está configurado.

---

## Instalación

### macOS / Linux

```bash
# 1. Clonar el repositorio
git clone https://github.com/lrbg/PlugInPlayWrightPro-Chrome.git
cd PlugInPlayWrightPro-Chrome

# 2. Instalar todas las dependencias (raíz + extensión + servidor)
npm run install:all

# 3. Instalar navegadores de Playwright
npx playwright install chromium --with-deps

# 4. Compilar la extensión de Chrome
npm run build:extension
# → Resultado en: extension/dist/

# 5. Cargar la extensión en Chrome
#    Abrir Chrome → chrome://extensions
#    Activar "Modo desarrollador" (interruptor arriba a la derecha)
#    Hacer clic en "Cargar descomprimida"
#    Seleccionar la carpeta extension/dist/

# 6. Iniciar el servidor compañero (requerido para ejecutar tests localmente)
npm run start:server
# → Servidor corriendo en http://localhost:3001
```

### Windows (Chrome)

```powershell
# 1. Instalar Node.js 18+ desde https://nodejs.org (LTS recomendado)
# 2. Instalar Google Chrome desde https://www.google.com/chrome

# 3. Clonar e instalar dependencias
git clone https://github.com/lrbg/PlugInPlayWrightPro-Chrome.git
cd PlugInPlayWrightPro-Chrome
npm run install:all

# 4. Instalar Playwright Chromium
npx playwright install chromium

# 5. Compilar la extensión
npm run build:extension

# 6. Cargar la extensión en Chrome (Windows)
#    Abrir Chrome → ir a chrome://extensions
#    Activar "Modo desarrollador" (interruptor arriba a la derecha)
#    Hacer clic en "Cargar descomprimida"
#    Navegar hasta: C:\ruta\a\PlugInPlayWrightPro-Chrome\extension\dist
#    Hacer clic en "Seleccionar carpeta"

# 7. Iniciar el servidor compañero (ejecutar en PowerShell o cmd)
npm run start:server
```

> **Nota Windows:** El servidor compañero lanza `npx playwright test` con `channel: 'chrome'`.
> Asegúrate de que Google Chrome esté instalado en su ruta por defecto (`C:\Program Files\Google\Chrome\Application\chrome.exe`).
> Si Chrome está en otra ubicación, ajusta la variable de entorno `CHROME_PATH` o modifica `playwright.config.ts`.

### Auto-inicio del servidor al iniciar sesión (solo macOS)

```bash
# Primera ejecución: compila e inicia el servidor
bash start-server.sh

# Activar como servicio en segundo plano (inicia en cada login, se reinicia si falla)
launchctl load ~/Library/LaunchAgents/com.playwrightpro.companion.plist

# Verificar estado
launchctl list | grep playwrightpro

# Ver logs
tail -f /tmp/playwrightpro-companion.log
tail -f /tmp/playwrightpro-companion.error.log

# Detener
launchctl unload ~/Library/LaunchAgents/com.playwrightpro.companion.plist
```

> En **Windows**, puedes lograr lo mismo con el **Programador de tareas**:
> Crea una tarea que ejecute `node C:\ruta\companion-server\dist\server.js` al iniciar sesión.

---

## Cómo usar

### 1. Grabar un test

1. Haz clic en el ícono de **PlaywrightPro** en Chrome
2. Ve a la pestaña **Caso de prueba** — completa: Número (`TC-001`), Nombre, Descripción, Pasos, Resultado esperado
3. Haz clic en **Guardar caso de prueba** → cambia automáticamente a la pestaña **Grabador**
4. Haz clic en **⏺ Iniciar grabación**
5. Interactúa con tu página web — clicks, escritura, dropdowns se capturan automáticamente
6. Haz clic en **⏹ Detener grabación**
7. Agrega assertions con el botón **✅ Assertion** (elige selector, tipo y valor)
8. Captura evidencia con **📸 Captura**
9. Haz clic en **💾 Guardar script**

### 2. Ejecutar un test localmente

1. Asegúrate de que el servidor compañero esté corriendo (`npm run start:server` o via LaunchAgent)
2. Ve a la pestaña **Biblioteca**
3. Haz clic en **▶ Ejecutar** en cualquier script guardado
4. El resultado aparece de inmediato en la fila del script y en la pestaña **Dashboard**

### 3. Exportar y ver reportes

- Pestaña **Biblioteca** → **📄 Reporte** → descarga un reporte `.html` autónomo
- `npx playwright show-report` → abre el reporte HTML de Playwright del último run

### 4. Subir scripts a GitHub

- Configura el Token de GitHub y el Repositorio en la pestaña **⚙️ Configuración**
- Pestaña **Biblioteca** → **⬆ Subir** en cualquier script → hace commit del `.spec.ts` a tu repositorio

---

## Estructura del proyecto

```
PlugInPlayWrightPro-Chrome/
├── extension/                  # Extensión Chrome (React + TypeScript + Webpack)
│   ├── src/
│   │   ├── background/         # Service worker — gestiona sesiones de grabación y mensajes
│   │   ├── content/            # recorder.ts — inyectado en páginas, captura eventos DOM
│   │   ├── popup/              # UI React — App.tsx + 5 componentes de pestaña
│   │   ├── types/              # index.ts — todas las interfaces TypeScript
│   │   └── utils/
│   │       ├── scriptGenerator.ts   # RecordedAction[] → código TypeScript de Playwright
│   │       ├── selectorBuilder.ts   # Spec de selector → page.getByRole() / locator()
│   │       ├── storage.ts           # Wrapper de chrome.storage.local
│   │       └── reportGenerator.ts   # Generador de reportes HTML
│   └── dist/                   # Extensión compilada — cargar esta carpeta en Chrome
│
├── companion-server/           # Node.js + Express — ejecución local de tests
│   ├── src/
│   │   ├── server.ts           # API: POST /run, GET /health, POST /webhook
│   │   ├── runner.ts           # Lanza: npx playwright test {archivo} --project=chrome
│   │   └── webhook.ts          # Recibe callbacks de resultados CI/CD
│   └── dist/                   # Servidor compilado (ejecutar con: node dist/server.js)
│
├── generated-tests/            # Tus archivos .spec.ts se guardan aquí
├── screenshots/                # Capturas de evidencia de los tests
├── playwright.config.ts        # Configuración de Playwright (channel: 'chrome', proyectos)
├── start-server.sh             # Compila e inicia el servidor compañero (macOS/Linux)
├── .github/workflows/          # Pipeline CI/CD de GitHub Actions
├── azure-pipelines/            # YAML de pipeline Azure DevOps
└── docs/CI_CD_SETUP.md         # Guía de configuración CI/CD
```

---

## Configuración CI/CD

Ver [`docs/CI_CD_SETUP.md`](docs/CI_CD_SETUP.md) para instrucciones completas.

### GitHub Actions

Se activa automáticamente al hacer push a `main`/`develop`.

**Secretos requeridos:**
- `WEBHOOK_SECRET` — secreto compartido para autenticación del webhook (opcional)

**Variables requeridas:**
- `BASE_URL` — URL base para los tests (ej. `https://staging.ejemplo.com`)
- `WEBHOOK_URL` — endpoint webhook del servidor compañero (opcional, para resultados en dashboard)

### Azure DevOps

Ver `azure-pipelines/azure-pipelines.yml`.

**Variables de pipeline requeridas:** `BASE_URL`, `WEBHOOK_URL`, `WEBHOOK_SECRET`

---

## Integración por Webhook

Para recibir resultados de CI/CD de vuelta en el Dashboard:

1. Expón tu servidor compañero a internet (ej. ngrok, VPN o servidor público)
2. Configura `WEBHOOK_URL` en tu CI/CD como `http://tu-servidor:3001/webhook`
3. Configura `WEBHOOK_SECRET` en los secretos del CI/CD y en el entorno del servidor
4. Los resultados aparecen automáticamente en la pestaña **Dashboard** tras cada ejecución CI

**Formato del payload del webhook:**
```json
{
  "scriptId": "TC-001",
  "testCaseNumber": "TC-001",
  "scriptName": "Test de login",
  "status": "pass",
  "duration": 3200,
  "startedAt": "2024-01-15T10:30:00Z",
  "finishedAt": "2024-01-15T10:30:03Z",
  "source": "github-actions"
}
```

---

## Referencia de configuración

Configura desde la pestaña **⚙️ Configuración** de la extensión:

| Sección | Parámetro | Descripción |
|---|---|---|
| Almacenamiento | Token de GitHub | Token de acceso personal con alcance `repo` |
| Almacenamiento | Repositorio | `propietario/nombre-repo` |
| Almacenamiento | Rama | Por defecto: `main` |
| Servidor | URL del servidor | Por defecto: `http://localhost` |
| Servidor | Puerto | Por defecto: `3001` |
| Playwright | Canal del navegador | `chrome` / `chromium` / `msedge` |
| Playwright | URL base | URL base predeterminada para todos los tests |
| Playwright | Timeout | Timeout por test en ms (por defecto: 30 000) |
| Playwright | Reintentos | Cantidad de reintentos al fallar (por defecto: 1) |
| Playwright | Workers | Workers paralelos (por defecto: 2) |
| Playwright | Sin cabecera | Ejecutar sin interfaz visual (por defecto: desactivado) |
| CI/CD | Organización Azure | Nombre de organización Azure DevOps |
| CI/CD | PAT Azure | Token de acceso personal de Azure DevOps |
| Webhook | Activar | Activar/desactivar receptor de webhook |
| Webhook | Secreto | Secreto compartido para autenticación de solicitudes |

---

## API del servidor compañero

| Endpoint | Método | Descripción |
|---|---|---|
| `/health` | GET | Retorna estado del servidor, versión de Node y rutas del proyecto |
| `/run` | POST | Recibe código de test, escribe `.spec.ts`, ejecuta Playwright, retorna resultado |
| `/run-file` | POST | Ejecuta un archivo de test existente por ruta |
| `/webhook` | POST | Recibe payloads de resultados de CI/CD |

**Cuerpo del POST /run:**
```json
{
  "scriptId": "TC-001",
  "testCaseNumber": "TC-001",
  "scriptName": "Mi test",
  "code": "import { test, expect } from '@playwright/test'; ...",
  "baseUrl": "https://ejemplo.com",
  "headless": false
}
```
