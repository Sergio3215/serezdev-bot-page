# Arquitectura: panel (BFF) ↔ bot

Dos repositorios con responsabilidades separadas. Este documento es la referencia del límite entre ambos.

```
Navegador ──► serezdev-bot-page (Next.js: UI + BFF) ──► bot-serezdev (API interna + Discord runtime)
              cookies de sesión Discord                 Authorization: Bearer INTERNAL_API_SECRET
```

## serezdev-bot-page

Responsable de:

- Web UI y dashboard.
- Autenticación del dashboard (OAuth de Discord, cookies de sesión).
- BFF: único punto de entrada del navegador hacia el bot (`app/api/guilds/[server]/backend/[...path]`).
- Autorización de administración de guild (`checkGuildAdmin`: owner, `ADMINISTRATOR` o `MANAGE_GUILD`).
- Reglas de negocio: planes, precios, features por plan, límites comerciales (`lib/plans.ts`), checkout y
  webhooks de pago, gating en UI y en el proxy (`planLimitError`, edición de GIFs por defecto) y la lista de
  servidores que pueden reiniciar el bot (`canRestartBot`).
- Contratos JSON del lenguaje de Custom Commands (`contracts/custom-command-language/`): permiten que el
  editor entienda el lenguaje (diagnostics, autocomplete, formatter, Simple Mode). No ejecutan nada.

El proxy del BFF:

- Solo reenvía endpoints de una allowlist (`lib/backendProxy.ts`); el resto responde 404.
- Valida `serverId` como snowflake y lo fija en query y body: el cliente no puede elegir otro servidor.
- Exige cookie de sesión y verifica que el usuario administre el servidor antes de reenviar.
- Agrega `INTERNAL_API_SECRET` del lado del servidor. El secreto nunca llega al navegador; los componentes
  cliente solo conocen `/api/guilds/<id>/backend/...` (`lib/botApi.ts`).

## bot-serezdev

Responsable de:

- Discord runtime (cliente de Discord, eventos, comandos nativos).
- Implementación real del lenguaje de Custom Commands: tokenizer, parser, AST, validación semántica,
  compiler, executor, `NativeRegistry` y natives. No consume los JSON del panel.
- Preview de Custom Commands: usa el mismo compiler/executor/natives con un contexto simulado; las acciones
  (`ReplyMessage`, `SendMessage`, `SendEmbed`, `ReplyEmbed`, `AddRole`) se devuelven como `actions[]` sin
  tocar Discord ni la base de datos.
- Persistencia (Prisma) y API interna protegida por `INTERNAL_API_SECRET`.
- Configuración operativa (cumpleaños, bienvenida, GIFs, reglas de canal, tareas programadas).
- Estado de suscripciones: guarda y expone tier, estado y período por servidor.

## Reglas del límite

- bot-serezdev **no** impone `PLAN_LIMITS` ni límites comerciales, **no** conoce precios y **no** decide
  features por plan. No es una segunda capa comercial: guarda la suscripción y la expone.
- El plan efectivo (activo y no vencido) lo resuelve el BFF (`resolveActivePlan` en `lib/subscriptions.ts`).
- Todo cambio de reglas comerciales se hace en este repo; el bot no necesita desplegarse por eso.
- El navegador nunca llama al bot directamente.
