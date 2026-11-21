# Spike 03: ciclo de agente propio con Gemini

Un agente en Node escrito a mano, sin framework. **Gemini decide** qué hacer y
**tu código ejecuta** las tools del servidor MCP de los spikes
[01](../01-mcp-basico/) (local) o [02](../02-mcp-http/) (Railway).

Archivos: [ciclo.js](ciclo.js) (el ciclo), [agente.js](agente.js) (lo conecta a
Gemini y a MCP), [ciclo.test.js](ciclo.test.js) (pruebas sin costo) y
[.env.example](.env.example).

## Cómo correrlo

```bash
npm install
cp .env.example .env    # y pon tu GEMINI_API_KEY
node --test             # pruebas del ciclo, no llaman a la API
node --env-file=.env agente.js "¿Cuánto son 3 UF en pesos?"
```

Para usar el servidor de Railway, agrega `MCP_URL` y `MCP_TOKEN` al `.env` y
corre `node --env-file=.env agente.js --remoto "¿A cuánto está el euro?"`.

Cada llamada a una tool se muestra en pantalla y queda en `auditoria.log`, que
no se versiona.

## El ciclo

```text
tarea → Gemini ─┬─ responde con texto ─────────→ fin
                ├─ pide tools → tu código las ejecuta → resultados → Gemini (otra vuelta)
                ├─ se cortó o lo bloquearon ───→ fin, sin ejecutar nada
                └─ se acabó el tope de vueltas → fin
```

**El modelo nunca ejecuta nada: solo pide.** Por eso los permisos, la auditoría
y la aprobación humana van en tu código, justo antes de ejecutar la tool.

| Cómo termina una vuelta | Qué hace el ciclo |
|---|---|
| `STOP` con texto | Termina: `listo` |
| `STOP` con `functionCall` | Ejecuta las tools y sigue |
| `MAX_TOKENS`, `SAFETY`, `MALFORMED_FUNCTION_CALL`, etc. | Termina **sin ejecutar**: los argumentos pueden venir incompletos |
| Sin candidatos (`promptFeedback.blockReason`) | Termina con el motivo del bloqueo |
| Se llegó a `MAX_VUELTAS` | Termina: `tope_de_vueltas` |

## Conceptos

**La API no tiene memoria.** En cada vuelta se manda la conversación completa.
Por eso cada vuelta cuesta más que la anterior.

**Hay que devolver `content` sin tocarlo.** La respuesta del modelo trae firmas
de razonamiento (*thought signatures*) que la API necesita de vuelta.

**Un error de tool no es un error del agente.** Vuelve al modelo como
`response: { error: "..." }`, y él decide si reintenta, cambia de camino o avisa.

**El tope de vueltas es un freno de costo.** Un agente confundido puede pedir
tools para siempre. Cuenta llamadas al modelo: con `MAX_VUELTAS=1` la tool se
ejecuta, pero el modelo ya no alcanza a responder.

## Qué se probó

11 pruebas del ciclo con un modelo simulado, y con `gemini-3.8-flash` real:

| Prueba | Resultado |
|---|---|
| Una tool (3 UF a pesos) | Respuesta correcta en 2 vueltas |
| Dos tools en la misma vuelta (indicadores y conversión) | Respuesta correcta en 2 vueltas |
| Servidor remoto en Railway | Respuesta correcta en 2 vueltas |
| Argumentos inválidos (monto negativo) | zod lo rechaza y el modelo explica el error |
| Tool que siempre falla | No inventa la cifra: avisa que no pudo obtenerla |
| `MAX_VUELTAS=1` | Se detiene con `tope_de_vueltas` |
| Llave inválida | Mensaje claro, código de salida 1 |
| Servidor MCP caído | Mensaje claro, código de salida 1 |

**Costo.** Cada pregunta usó entre 1.250 y 2.200 tokens de entrada y entre 140 y
340 de salida: de US$0,0015 a US$0,003 a precio de pago (US$0,75 y US$3,75 por
millón, vigente hasta el 31-12-2026). Según la página de precios de Gemini, en
la **capa gratuita** el contenido se puede usar para mejorar los productos de
Google: no le mandes datos privados.

## Lo que apareció

- **En Gemini, pedir una tool también termina en `STOP`.** No hay un motivo
  propio como el `tool_use` de Claude: se distingue mirando si hay `functionCall`
  en las partes. El primer borrador de este spike era para Claude, y este fue el
  cambio de fondo; el resto del ciclo quedó igual.
- **`mcpToTool` del SDK haría el ciclo solo**, pero es experimental y deja fuera
  el punto donde van la auditoría y las aprobaciones. Por eso el ciclo es manual.
- **Una llave inválida da 400, no 401.** El detalle viene en `API_KEY_INVALID`.
- **La documentación actual de Gemini se centra en la Interactions API.** Aquí se
  usó `generateContent`, que es la que muestra el README del SDK 3.6.1.

## Siguiente paso

Patrones de producción (prioridad 3 del [plan](../../PLAN.md)): aprobación humana
antes de una acción con plata, llaves de idempotencia, permisos por tool y modo
dry-run, todo en `ejecutarTools` de [ciclo.js](ciclo.js).
