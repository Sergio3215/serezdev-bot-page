# Performance: metodología y mediciones

Mediciones reproducibles del panel. Solo se registran números que salen de la salida de `next build`
o del código; no hay estimaciones de tiempo de carga.

## Cómo medir

```bash
npm run build          # build de producción (Turbopack)
npm run perf:report    # tabla Markdown; `npm run perf:report -- --json` para JSON
```

`scripts/perf-report.mjs` lee la salida de `.next/` sin dependencias extra:

- **JS inicial por ruta**: `rootMainFiles` de `build-manifest.json` más los `entryJSFiles` del
  `page_client-reference-manifest.js` de cada página. Tamaño en disco y gzip (`zlib`, nivel por defecto).
- **Carga diferida por feature**: busca en los chunks un texto propio de cada feature (marcador) y el
  grupo de `import()` dinámico más chico que contiene ese chunk. La columna "features que arrastra"
  muestra qué otras features se descargan en el mismo grupo.

| Feature | Marcador |
|---|---|
| Custom Commands: lista | `Todavía no hay comandos personalizados` |
| Custom Commands: editor | `Mensaje que activa el comando` |
| Simple Mode | `Responder con una tarjeta` |
| Preview | `Mensaje de prueba` |
| Contrato + motor del lenguaje | `serez-custom-command` |
| CodeMirror | `cm-editor` |

Si se renombra uno de esos textos, actualizar `FEATURES` en el script.

Para inspeccionar el grafo de módulos de forma interactiva, Next 16 trae `npx next experimental-analyze`
(no hace falta instalar nada).

Los requests se verifican en DevTools → Network (filtro `Fetch/XHR`, "Preserve log") con una sesión
real, siguiendo el flujo de abajo. Las tablas de requests salen de leer el código de cada versión.

## Baseline (commit `2526fa1`, Next 16.3.5)

Chunks JS: 24 · 1411.0 KB · gzip 441.9 KB

| Ruta | Archivos | Raw | Gzip |
|---|---:|---:|---:|
| `/` | 7 | 449.6 KB | 133.5 KB |
| `/dashboard` | 9 | 499.4 KB | 151.1 KB |
| `/dashboard/[server]` | 9 | 499.4 KB | 151.1 KB |
| `/docs/comandos` | 7 | 453.4 KB | 135.2 KB |

| Feature | Grupo dinámico | Raw | Gzip | Arrastra |
|---|---:|---:|---:|---|
| Custom Commands: lista | 3 archivos | 166.8 KB | 48.6 KB | lista, editor, Simple Mode, Preview, contrato |
| Custom Commands: editor | (mismo grupo) | 166.8 KB | 48.6 KB | — |
| CodeMirror | 1 archivo | 348.0 KB | 111.5 KB | solo CodeMirror |

Requests al abrir `/dashboard/<id>` y entrar a Comandos Personalizados:

```
GET /api/auth/me
  └─ (espera) GET /api/guilds            ← waterfall
GET /api/billing/<id>                     (al montar ServerDashboard)
[Comandos Personalizados]
GET  backend/customCommand
GET  /api/guilds/<id>/channels            ← la lista no lo usa
GET  /api/guilds/<id>/roles?includeManaged=1
```

## After (Sprint 4)

Chunks JS: 25 · 1413.7 KB · gzip 443.3 KB

| Ruta | Archivos | Raw | Gzip |
|---|---:|---:|---:|
| `/` | 7 | 449.6 KB | 133.5 KB |
| `/dashboard` | 9 | 499.9 KB | 151.2 KB |
| `/dashboard/[server]` | 9 | 499.9 KB | 151.2 KB |
| `/docs/comandos` | 7 | 453.4 KB | 135.2 KB |

| Feature | Grupo dinámico | Raw | Gzip | Arrastra |
|---|---:|---:|---:|---|
| Custom Commands: lista | 1 archivo | 9.9 KB | 3.8 KB | solo la lista |
| Custom Commands: editor | 3 archivos | 159.1 KB | 46.0 KB | editor, Simple Mode, Preview, contrato |
| CodeMirror | 1 archivo | 348.0 KB | 111.5 KB | solo CodeMirror (solo en Modo avanzado) |

Requests:

```
GET /api/auth/me      ┐ en paralelo; el resultado de guilds se aplica
GET /api/guilds       ┘ recién con la sesión confirmada
GET /api/billing/<id>
[Comandos Personalizados]
GET  backend/customCommand
GET  /api/guilds/<id>/roles?includeManaged=1   (la lista cuenta roles efectivos)
[Nuevo / Editar — primera vez]
GET  /api/guilds/<id>/channels                 (se reutiliza al volver a abrir el editor y en el Preview)
```

## Cambios y su verificación

| Problema | Cambio | Costo eliminado | Verificación |
|---|---|---|---|
| Ver la lista de Custom Commands descargaba editor, Simple Mode, Preview y el motor del lenguaje | `CustomCommandManager` queda con la lista; `CustomCommandEditor` se carga con `next/dynamic` al pulsar Nuevo/Editar | 156.9 KB raw / 44.8 KB gzip menos para ver la lista | `npm run perf:report`, fila "Custom Commands: lista" |
| La lista pedía canales sin usarlos | Canales se piden al abrir el editor por primera vez | 1 request en la lista | código de `CustomCommandManager` + Network |
| `/api/guilds` esperaba a `/api/auth/me` | Ambos salen al montar; `lib/guildLoading.ts` aplica guilds/reauth/429 solo con sesión válida y corta reintentos al cancelar o cerrar sesión | 1 round-trip en serie | `tests/bff/guildLoading.test.ts` + Network |

Costo del split: llegar al editor descarga 9.9 KB + 159.1 KB = 169.0 KB raw, 2.2 KB más que el grupo único
del baseline (166.8 KB). Los roles se siguen pidiendo con la lista porque el conteo de "rol(es) permitidos"
descarta roles borrados del servidor y sin ellos mostraría un número incorrecto.
