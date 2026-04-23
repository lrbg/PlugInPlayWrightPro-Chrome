# CLAUDE.md

Este archivo proporciona orientación a Claude Code (claude.ai/code) cuando trabaja con el código de este repositorio.

---

## Comandos de build y desarrollo

### Extensión (Chrome Extension — React + TypeScript + Webpack)

```bash
cd extension
npm install              # instalar dependencias
npm run build            # build de producción → extension/dist/
npm run dev              # modo watch (recompila al guardar)
npm run build:dev        # build de desarrollo (source maps, sin minificación)
```

Tras cualquier cambio en `extension/src/`, ejecutar `npm run build` y recargar la extensión en `chrome://extensions`.

### Companion Server (Node.js + Express + TypeScript)

```bash
cd companion-server
npm install
npm run build            # tsc → companion-server/dist/
npm run dev              # ts-node-dev modo watch
node dist/server.js      # ejecutar el servidor compilado directamente
```

### Atajos desde la raíz del workspace

```bash
npm run install:all      # instala dependencias de raíz + extensión + servidor
npm run build            # compila extensión y servidor
npm run build:extension  # solo extensión
npm run build:server     # solo servidor
npm run start:server     # inicia companion server en puerto 3001
```

### Ejecutar tests Playwright

```bash
npx playwright test                           # todos los tests en generated-tests/
npx playwright test --project=chrome         # solo canal Chrome
npx playwright test --headed                 # con navegador visible
npx playwright test tests/TC-001-*.spec.ts   # un test específico por archivo
npx playwright test --ui                     # modo UI de Playwright
```

### Auto-inicio del servidor (macOS LaunchAgent)

```bash
# Activar auto-inicio al iniciar sesión
launchctl load ~/Library/LaunchAgents/com.playwrightpro.companion.plist

# Desactivar
launchctl unload ~/Library/LaunchAgents/com.playwrightpro.companion.plist

# Ver logs
tail -f /tmp/playwrightpro-companion.log
tail -f /tmp/playwrightpro-companion.error.log

# Verificar que responde
curl http://localhost:3001/health
```

---

## Arquitectura

### Modelo de dos procesos

```
┌─────────────────────────────────────────┐
│  Chrome Extension (extension/dist/)     │
│  ┌────────────────────────────────────┐ │
│  │  Popup UI (React 18)               │ │
│  │  App.tsx — shell de 5 pestañas     │ │
│  │  ├─ TestCaseForm  (pestaña: testcase)  │ │
│  │  ├─ Recorder      (pestaña: recorder)  │ │
│  │  ├─ ScriptLibrary (pestaña: library)   │ │
│  │  ├─ Dashboard     (pestaña: dashboard) │ │
│  │  └─ Settings      (pestaña: settings)  │ │
│  └────────────────────────────────────┘ │
│  background/service-worker.ts           │
│  content/recorder.ts  ← inyectado en   │
│                          cada página    │
└──────────────┬──────────────────────────┘
               │ fetch POST /run
               ▼
┌─────────────────────────────────────────┐
│  Companion Server  (companion-server/)  │
│  Express  :3001                         │
│  POST /run  → escribe .spec.ts, lanza   │
│               npx playwright test       │
│  GET  /health                           │
│  POST /webhook  ← callbacks de CI/CD   │
└─────────────────────────────────────────┘
```

### Flujo de datos: grabar → generar → ejecutar

1. **Grabar**: `content/recorder.ts` escucha eventos DOM (click/input/change) → envía mensajes `ACTION_RECORDED` a `service-worker.ts` → el service worker los reenvía al popup via `chrome.runtime.onMessage`.
2. **Generar**: `utils/scriptGenerator.ts` convierte `RecordedAction[]` a TypeScript de Playwright. `utils/selectorBuilder.ts` convierte strings de spec de selector (ej. `role::button::Login`) a llamadas `page.getByRole(...)`.
3. **Persistir**: `utils/storage.ts` encapsula `chrome.storage.local`. Claves: `ppp_scripts`, `ppp_results`, `ppp_settings`.
4. **Ejecutar**: `ScriptLibrary` hace POST del código generado al `companion-server` → el servidor escribe un `.spec.ts` temporal, lanza `npx playwright test`, retorna resultado pass/fail/error. El archivo temporal se elimina tras la ejecución.

### Formato de spec de selectores

Los selectores se almacenan como strings estructurados que `buildLocatorCode()` interpreta:

| Prefijo spec | Localizador generado |
|---|---|
| `testid::VALOR` | `page.getByTestId('VALOR')` |
| `arialabel::VALOR` | `page.getByLabel('VALOR')` |
| `label::VALOR` | `page.getByLabel('VALOR')` |
| `role::ROL::NOMBRE` | `page.getByRole('ROL', { name: 'NOMBRE', exact: false })` |
| `placeholder::VALOR` | `page.getByPlaceholder('VALOR')` |
| `text::VALOR` | `page.getByText('VALOR', { exact: false })` |
| `css::SELECTOR` | `page.locator('SELECTOR')` |

`buildSelector()` en `recorder.ts` asigna prioridades: testId → ariaLabel → role+texto (solo si es único) → clase CSS como desambiguador → placeholder → label → name → texto → ruta CSS.

### Decisiones de diseño clave

- **`isUniqueByText()`** se ejecuta en tiempo de grabación para prevenir violaciones de modo estricto de Playwright: si varios elementos comparten el mismo role+texto, el grabador cae al siguiente selector más específico.
- **`deduplicateActions()`** en `scriptGenerator.ts` colapsa fills consecutivos en el mismo campo y detecta navegaciones SPA automáticas (dentro de 8 s de una acción de usuario) → emite `waitForLoadState('load')` en lugar de `goto()`.
- **Estrategia de `waitForLoadState`**: `'domcontentloaded'` en `beforeEach`, `'load'` tras cada acción navigate, `'domcontentloaded'` tras cada click.
- **Timeout de assertions**: Todas las llamadas `expect()` usan `{ timeout: 30_000 }` para manejar contenido cargado por AJAX.
- **Sanitización de entrada**: `ws()` elimina saltos de línea y bytes nulos de todos los campos de acción antes de generar código; `escapeString()` escapa para literales TypeScript; `escapeUrl()` para `page.goto()`.

### Estructura de almacenamiento (`chrome.storage.local`)

| Clave | Tipo | Notas |
|---|---|---|
| `ppp_scripts` | `Script[]` | Scripts guardados (incluyen código generado + estadísticas de ejecución) |
| `ppp_results` | `TestResult[]` | Últimas 500 ejecuciones (más reciente primero) |
| `ppp_settings` | `AppSettings` | Configuración de la extensión |

### Archivos a modificar según la tarea

| Tarea | Archivos |
|---|---|
| Cambiar cómo se graban los selectores | `extension/src/content/recorder.ts` → `buildSelector()` |
| Cambiar el código Playwright generado | `extension/src/utils/scriptGenerator.ts` → `generateActionCode()` |
| Agregar un nuevo tipo de localizador | `extension/src/utils/selectorBuilder.ts` → `buildLocatorCode()` |
| Agregar un nuevo tipo de acción | `extension/src/types/index.ts` + recorder + scriptGenerator |
| Agregar un nuevo tipo de assertion | `types/index.ts` (AssertionType) + `buildAssertionLine()` en scriptGenerator |
| Cambiar el comportamiento del runner | `companion-server/src/runner.ts` |
| Agregar un nuevo endpoint de API | `companion-server/src/server.ts` |
| Cambiar métricas del dashboard | `extension/src/popup/components/Dashboard.tsx` |
| Agregar una nueva configuración | `types/index.ts` (AppSettings) + `storage.ts` (DEFAULT_SETTINGS) + `Settings.tsx` |

---

## Dos directorios locales del repositorio

El proyecto existe en **dos copias locales** apuntando al mismo remoto (`github.com/lrbg/PlugInPlayWrightPro-Chrome`):

- `/Users/luisrogelio/Documents/Plug-InPlaywrightPro/` — **copia activa cargada en Chrome** — siempre editar esta
- `/Users/luisrogelio/Documents/PlugInPlayWrightPro-Chrome/` — copia secundaria (CWD en algunas sesiones)

Tras editar y compilar en `Plug-InPlaywrightPro`, sincronizar cambios a `PlugInPlayWrightPro-Chrome` si es necesario y hacer commit desde `Plug-InPlaywrightPro`.
