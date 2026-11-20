# Spike 02: servidor MCP remoto por HTTP, en Railway

Las mismas 3 tools del [spike 01](../01-mcp-basico/) (indicadores, datos.gob.cl
y conversión CLP↔UF), pero servidas **por HTTP**, protegidas con un **token** y
desplegadas en **Railway**. Así cualquier agente las alcanza desde internet, no
solo desde tu notebook.

| | Spike 01 (stdio) | Spike 02 (HTTP) |
|---|---|---|
| Quién arranca el servidor | El cliente, como proceso hijo | Tú (o Railway); queda escuchando en un puerto |
| Canal | stdin/stdout del proceso | `POST /mcp` |
| Quién puede llamarlo | Solo tu PC | Cualquiera con la URL **y el token** |
| `console.log` | Rompe el protocolo | Se puede: va al log |
| Arranque en el código | `serveStdio(crearServidor)` | `createMcpHandler(crearServidor)` + `toNodeHandler` |

Archivos: [index.js](index.js) (el servidor Express), [herramientas.js](herramientas.js)
(las tools, copiadas del spike 01 porque Railway solo ve esta carpeta),
[probar.js](probar.js) (cliente de prueba) y [.env.example](.env.example).

## Cómo correrlo en local

```bash
npm install
cp .env.example .env    # y pon un MCP_TOKEN (el archivo explica cómo generarlo)
node --env-file=.env index.js              # en una terminal
node --env-file=.env probar.js             # en otra
```

`probar.js` revisa tres cosas: que `GET /` responda, que `POST /mcp` **sin
token** dé 401 y que **con token** las 3 tools funcionen. Para probar el de
Railway: `node --env-file=.env probar.js https://<tu-servicio>.up.railway.app/mcp`.

## Cómo se desplegó en Railway

Proyecto `hack-infra-spikes`, servicio `mcp-http`, conectado a este repo de
GitHub (rama `main`). La configuración se puso **antes** de conectar el repo,
porque al conectarlo Railway construye de inmediato:

| Ajuste | Valor | Para qué |
|---|---|---|
| Root directory | `/spikes/02-mcp-http` | Construir solo esta carpeta |
| Watch paths | `/spikes/02-mcp-http/**` | Que un commit en otro spike no redespliegue |
| Variable | `MCP_TOKEN` | El mismo token del `.env` local |
| Healthcheck | `/` | Railway espera un 200 antes de mandar tráfico |
| Start command | `node index.js` | Ver «Lo que apareció» |
| Serverless | activado | Se duerme tras 5–10 min sin uso |
| Dominio | `*.up.railway.app` generado | HTTPS sin configurar nada |

`PORT` lo define Railway (aquí, 8080); el servidor lo lee de `process.env.PORT`.

**Costo.** Según la documentación de Railway (noviembre de 2026): RAM a
US$10 por GB al mes y CPU a US$20 por vCPU al mes. Este servidor usa unos 80 MB y
casi nada de CPU: ~US$0,85 al mes si estuviera siempre encendido, y centavos en
modo serverless. Cuando ya no sirva, se borra el proyecto completo.

## Cómo conectarlo a Claude Code

Como es un servidor **personal** (quien clone el repo no tiene tu token), va en
el ámbito **local**, que se guarda en tu `~/.claude.json` y no en el repo:

```bash
claude mcp add --transport http mcp-remoto https://<tu-servicio>.up.railway.app/mcp \
  --header "Authorization: Bearer <tu MCP_TOKEN>"
claude mcp get mcp-remoto     # debe decir ✔ Connected
```

Aquí se hizo con el equivalente `claude mcp add-json mcp-remoto '{"type":"http","url":"…","headers":{"Authorization":"Bearer …"}}'`,
desde la raíz del repo. Las tools quedan como `mcp__mcp-remoto__<tool>`. Para
quitarlo: `claude mcp remove mcp-remoto -s local`.

## Conceptos

**HTTP «sin estado».** `createMcpHandler(crearServidor)` llama a la fábrica en
**cada petición**: cada `POST /mcp` lo atiende un servidor nuevo, que no recuerda
nada de la anterior. Es simple y escala sin problemas, pero no hay memoria entre
llamadas (por ejemplo, de qué fuente de indicadores falló hace un rato). Si un
día hace falta estado, se guarda afuera (base de datos o caché).

**Qué se ve en el log de una conexión** (cliente de la era 2025):

| Petición | Qué es |
|---|---|
| `POST /mcp 200` | `initialize` |
| `POST /mcp 202` | La notificación `initialized`. **202 Accepted**: las notificaciones no llevan respuesta |
| `GET /mcp 405` | El cliente intenta abrir un canal SSE para avisos del servidor; sin estado no existe. Es normal |
| `POST /mcp 200` | `tools/list` y cada `tools/call` |

Claude Code hizo menos pasos (5 `POST` seguidos, sin el 202 ni el 405), lo que
calza con que use la era 2026-07-28 del protocolo. El servidor atiende las dos.

**El token.** `/mcp` exige `Authorization: Bearer <MCP_TOKEN>` y responde 401 si
falta. Se compara con `timingSafeEqual`, en tiempo constante, para que el tiempo
de respuesta no revele cuántos caracteres acertó alguien. El servidor no arranca
si el token tiene menos de 32 caracteres. Nunca va en el repo: va en `.env`
(local) y en las variables de Railway.

**401 = «haz login».** Cuando Claude Code recibe un 401, supone que el servidor
usa OAuth y va a buscar cómo iniciar sesión. En el log aparece como `GET
/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`
y `POST /register`, todos 404. Si ves eso, el token no está llegando.

**Serverless y arranque en frío.** Dormido no cuesta casi nada; la primera
petición lo despierta en unos 2 segundos y, según Railway, puede devolver 502
mientras arranca. Para una demo en vivo conviene despertarlo antes (un `GET /`)
o desactivar el modo serverless ese día.

## Lo que apareció

- **El token no se puede leer de un archivo con `headersHelper` en esta app.**
  La idea era dejar en el `.mcp.json` del repo un `headersHelper` (un comando
  que imprime los headers) que leyera el token del `.env`. Claude Code no lo
  ejecuta si la carpeta no está marcada como confiable («persisted trust»), ni
  en ámbito proyecto ni en local, y la app de escritorio no deja esa marca. Es
  una protección: un repo clonado podría traer un `headersHelper` que ejecute
  cualquier cosa. Se resolvió con el header fijo en el ámbito local.
- **El adaptador de Express está pensado para OAuth.** `requireBearerAuth`
  exige tokens con fecha de expiración y responde con un desafío que manda al
  cliente a buscar un servidor OAuth. Para un token fijo bastan 6 líneas
  propias. OAuth de verdad (`requireBearerAuth` + `mcpAuthMetadataRouter`)
  queda para cuando haya usuarios.
- **Hacen falta dos paquetes para Express.** El README de
  `@modelcontextprotocol/express` muestra el transporte antiguo (solo era 2025).
  Para las dos eras se usa `createMcpHandler` de `@modelcontextprotocol/server`
  envuelto con `toNodeHandler` de `@modelcontextprotocol/node`. Sin
  `express.json()`: `toNodeHandler` lee el cuerpo él mismo.
- **`npm start` ensucia el log.** Railway arrancaba con `npm start`; cuando el
  servicio se duerme, npm recibe SIGTERM y escribe `npm error signal SIGTERM`,
  que no es un error real. Con start command `node index.js` desaparece.
- **mindicador.cl seguía caída**, así que las llamadas de indicadores tardaban
  6–7 s (el tiempo límite más findic.cl). Como el servidor no tiene estado, cada
  petición vuelve a esperar. Un caché de unos minutos lo arreglaría.
- **La herramienta `fetch-docs` del conector de Railway no abría ninguna
  página**; la documentación se leyó directo desde docs.railway.com.

## Siguiente paso

El ciclo de agente propio en Node con la API de Claude (tool use): mandar las
tools, ejecutar las que pida el modelo, devolverle los resultados y repetir. En
la hackathon el agente probablemente sea tuyo (WhatsApp, web), no Claude Code.
