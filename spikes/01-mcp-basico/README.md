# Spike 01: servidor MCP básico por stdio

Un servidor MCP en Node con 3 tools sobre datos públicos de Chile, sin llaves:

| Tool | Qué hace | Fuente |
|---|---|---|
| `indicadores_economicos` | UF, dólar, euro, UTM, IPC y otros, valor del día | [mindicador.cl](https://mindicador.cl/api), con respaldo en [findic.cl](https://findic.cl/api/) |
| `buscar_datasets` | Busca en el catálogo de datos abiertos del Estado | API CKAN de [datos.gob.cl](https://datos.gob.cl/api/3/action/package_search?q=aire) |
| `convertir_clp_uf` | Convierte pesos a UF o UF a pesos con la UF de hoy | La misma de los indicadores |

Archivos: [server.js](server.js) (el servidor) y [probar.js](probar.js) (un cliente
de prueba). El registro para Claude Code está en [`.mcp.json`](../../.mcp.json),
en la raíz del repo.

## Cómo correrlo

Requisitos: Node 24 y npm. Desde esta carpeta:

```bash
npm install
node probar.js            # lista las tools y llama cada una contra las APIs reales
node probar.js --sin-red  # corta internet al servidor para ver los isError
```

`node server.js` solo no muestra nada útil: queda esperando mensajes JSON por
stdin. Un servidor stdio lo lanza su cliente.

### Con MCP Inspector

```bash
# Interfaz web en el navegador
npx @modelcontextprotocol/inspector node server.js

# Modo línea de comandos (probado)
npx @modelcontextprotocol/inspector --cli node server.js --method tools/list
npx @modelcontextprotocol/inspector --cli node server.js --method tools/call \
  --tool-name convertir_clp_uf --tool-arg monto=50000 --tool-arg desde=CLP
```

### Con Claude Code

El repo trae un `.mcp.json` en la raíz (ámbito *proyecto*):

```json
{ "mcpServers": { "mcp-basico": { "type": "stdio", "command": "node",
  "args": ["spikes/01-mcp-basico/server.js"] } } }
```

1. Abre una sesión **nueva** de Claude Code en la raíz del repo. Los servidores
   MCP se cargan al iniciar la sesión, así que una sesión abierta antes no los ve.
2. La primera vez, Claude Code pide **aprobar** el servidor, porque un
   `.mcp.json` ejecuta código en tu máquina. Mientras no lo apruebes queda en
   `⏸ Pending approval`.
3. Pregunta algo como «¿cuánto vale hoy la UF?». Las tools aparecen con el
   nombre `mcp__mcp-basico__<tool>`.

La alternativa sin tocar el repo es `claude mcp add`, que guarda el servidor en
tu configuración personal (`~/.claude.json`) y no pide aprobación:

```bash
claude mcp add mcp-basico --scope user -- node C:/ruta/al/repo/spikes/01-mcp-basico/server.js
claude mcp list   # debe decir ✓ Connected
```

**Si `claude` no se encuentra** en Git Bash ni en PowerShell: la app de escritorio
trae su propio `claude.exe` en una carpeta que cambia con cada versión
(`%LOCALAPPDATA%\Claude-Data\...\claude-code\<versión>\...\claude.exe`), así que
no conviene ponerla en el PATH. Para tener el comando, instala el CLI aparte
(en PowerShell: `irm https://claude.ai/install.ps1 | iex`), que queda en
`%USERPROFILE%\.local\bin`, y abre una terminal nueva. Ese CLI pide su propio
login (`claude auth login`).

## Conceptos

**Tool.** Es una función que el modelo puede pedir que se ejecute. Tiene
nombre, descripción, esquema de entrada y handler. La descripción es lo que el
modelo lee para decidir *cuándo* usarla, así que funciona como un prompt.

**Esquema con zod.** `inputSchema: z.object({...})` cumple dos funciones. El SDK
lo convierte en JSON Schema para el catálogo de tools (por ejemplo,
`.positive()` pasa a ser `exclusiveMinimum: 0` y `.describe()` pasa a ser
`description`). Y además valida cada llamada: con `monto: -5` el handler no
llega a ejecutarse.

**Transporte stdio.** El cliente lanza el servidor como proceso hijo y le
escribe JSON-RPC por stdin, un mensaje por línea. El servidor responde por
stdout. Por eso **un `console.log` en el servidor rompe el protocolo**: los
logs van a stderr con `console.error`.

**Cómo Claude descubre y llama las tools.** Se ve mandando los mensajes a mano:

```bash
{ echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"a-mano","version":"0"}}}'
  echo '{"jsonrpc":"2.0","method":"notifications/initialized"}'
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'; sleep 2; } | node server.js
```

1. `initialize`: el cliente y el servidor acuerdan la versión del protocolo y el
   servidor anuncia sus capacidades (`tools`).
2. `tools/list`: el cliente recibe nombres, descripciones y esquemas, y Claude
   Code los pone en el contexto del modelo.
3. Cuando el modelo decide usar una tool, el cliente manda `tools/call` con
   `{ name, arguments }` y le pasa el resultado al modelo.

**Errores.** Hay dos tipos:
- **Error de la tool** (`isError: true` en el resultado): la tool corrió y algo
  falló, como una API caída o un argumento inválido. El modelo ve el mensaje y
  puede corregirse o explicarlo. En el SDK basta con lanzar un `Error` en el
  handler; el SDK lo convierte y el servidor sigue vivo. Por eso los mensajes
  tienen que ser claros: «mindicador.cl no respondió en 6 s» y no «fetch failed».
- **Error del protocolo** (JSON-RPC `error`): por ejemplo, una tool que no existe.

**Annotations.** `readOnlyHint: true` y `openWorldHint: true` le dicen al
cliente que la tool solo lee y que consulta sistemas externos. Una tool que cobra
con Payku no es de solo lectura, y el cliente puede tratarla distinto (por
ejemplo, pedir confirmación).

## Lo que apareció

- **El SDK cambió de versión mayor.** `@modelcontextprotocol/sdk` (1.32.x) ya es
  la línea de *mantenimiento*. La estable es la v2 (2.4.0), dividida en
  `@modelcontextprotocol/server` y `@modelcontextprotocol/client`, que
  implementa la especificación 2026-07-28. Este spike usa la v2. La mayoría de
  los ejemplos en internet son de la v1, así que conviene reconocer los dos
  estilos:

  | | v1 (`@modelcontextprotocol/sdk`) | v2 (este spike) |
  |---|---|---|
  | Servidor | `.../sdk/server/mcp.js` | `@modelcontextprotocol/server` |
  | Arranque stdio | `server.connect(new StdioServerTransport())` | `serveStdio(() => crearServidor())` |
  | Esquema | `inputSchema: { monto: z.number() }` (objeto suelto) | `inputSchema: z.object({ monto: z.number() })` |
  | Cliente | `.../sdk/client/index.js` y `.../sdk/client/stdio.js` | `@modelcontextprotocol/client` y `.../client/stdio` |

  `serveStdio` recibe una *fábrica* que crea el servidor, y responde tanto a
  clientes que saludan con `initialize` (era 2025) como a los de la era
  2026-07-28. Conectar a mano `McpServer` con `StdioServerTransport` también
  funciona, pero solo habla la era 2025.
- **mindicador.cl se cayó durante el spike.** Aceptaba la conexión TLS pero no
  respondía, ni con curl ni con `fetch`. Por eso: tiempo límite de 6 s con
  `AbortSignal.timeout` y respaldo en findic.cl, que publica el mismo formato.
  Cada respuesta dice qué `fuente` contestó. Con mindicador intermitente se ven
  las dos.
- **Los datos reales traen sorpresas.** El IPC de mindicador venía con fecha
  2025-12-01. Las tools devuelven siempre la `fecha` junto al valor para que se
  note.
- **Claude Code ve el `.mcp.json`, pero lo deja en «Pending approval»** hasta que
  lo apruebes. Es una protección, no un error.
- **El `claude.exe` de la app no sirve como CLI suelto**: conecta el servidor y
  lista sus tools (`--mcp-config .mcp.json` muestra `mcp-basico: connected`),
  pero al llamar al modelo falla por login. Para usar el CLI fuera de la app hay
  que instalarlo y hacer login aparte.
- **MCP Inspector 2.16** pide Node `^24.22.1` y avisa con la 24.21, pero funciona.

## Siguiente paso

El mismo servidor, pero remoto por HTTP y desplegado en Railway (spike 02). La
v2 trae `createMcpHandler` y adaptadores para Express y Node.
