// Agente de línea de comandos: Claude decide, las tools MCP actúan.
//
//   node --env-file=.env agente.js "¿Cuánto son 3 UF en pesos?"
//   node --env-file=.env agente.js --remoto "¿A cuánto está el dólar?"
//
// Por defecto usa el servidor del spike 01 (stdio). Con --remoto, el del spike 02.

import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { correrAgente } from './ciclo.js';

const MODELO = 'claude-opus-5-5';
const MAX_VUELTAS = Number(process.env.MAX_VUELTAS ?? 8);
const PRECIO_POR_MILLON = { entrada: 4, salida: 20 }; // US$, Opus 5.5
const AUDITORIA = join(import.meta.dirname, 'auditoria.log');

const SISTEMA = `Eres un asistente de datos de Chile. Responde en español, breve y directo.
Para cualquier cifra usa las tools: nunca la inventes ni la saques de memoria.
Indica la fecha de cada indicador que cites.
Si una tool falla, reintenta solo si el error sugiere que puede servir; si no, di qué no pudiste obtener.`;

const argumentos = process.argv.slice(2);
const remoto = argumentos.includes('--remoto');
const tarea = argumentos.filter((a) => a !== '--remoto').join(' ');

function salir(mensaje) {
  console.error(mensaje);
  process.exit(1);
}

if (!tarea) salir('Falta la tarea. Ejemplo: node --env-file=.env agente.js "¿A cuánto está la UF?"');
if (!process.env.ANTHROPIC_API_KEY) salir('Falta ANTHROPIC_API_KEY. Cópiala en .env (ver .env.example).');

function crearTransporte() {
  if (!remoto) {
    return new StdioClientTransport({
      command: process.execPath,
      args: ['server.js'],
      cwd: join(import.meta.dirname, '..', '01-mcp-basico'),
    });
  }
  const { MCP_URL, MCP_TOKEN } = process.env;
  if (!MCP_URL || !MCP_TOKEN) salir('Con --remoto hacen falta MCP_URL y MCP_TOKEN en .env.');
  return new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${MCP_TOKEN}` } },
  });
}

// 1. Conectarse al servidor MCP y traducir sus tools al formato de la API de Claude.
const mcp = new Client({ name: 'agente', version: '1.0.0' });
await mcp.connect(crearTransporte());
const { tools: toolsMcp } = await mcp.listTools();
const tools = toolsMcp.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: t.inputSchema,
}));

// 2. Cómo se llama al modelo. `fallbacks` es para que, si el modelo rechaza
//    la petición por política, la API la reintente con otro modelo en la misma llamada.
const claude = new Anthropic(); // lee ANTHROPIC_API_KEY; reintenta solo los 429 y 5xx
const llamarModelo = (messages) =>
  claude.beta.messages.create({
    model: MODELO,
    max_tokens: 16000,
    output_config: { effort: 'medium' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SISTEMA,
    tools,
    messages,
  });

// 3. Cómo se ejecuta una tool: se la pide al servidor MCP.
async function ejecutarTool(name, input) {
  const r = await mcp.callTool({ name, arguments: input });
  const texto = r.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
  return { texto, error: Boolean(r.isError) };
}

// 4. Auditoría: cada llamada queda en pantalla y en un archivo (no se versiona).
function registrar(llamada) {
  const marca = llamada.error ? 'ERROR' : 'ok';
  console.error(`  [tool] ${llamada.tool} ${JSON.stringify(llamada.input)} → ${marca} (${llamada.ms} ms)`);
  appendFileSync(AUDITORIA, `${JSON.stringify({ fecha: new Date().toISOString(), tarea, ...llamada })}\n`);
}

// 5. Correr el ciclo y mostrar cómo terminó.
try {
  const r = await correrAgente({
    tarea,
    llamarModelo,
    ejecutarTool,
    maxVueltas: MAX_VUELTAS,
    alUsarTool: registrar,
  });

  if (r.texto) console.log(`\n${r.texto}\n`);
  if (r.estado !== 'listo') {
    console.error(`El agente no terminó: ${r.estado}`, r.detalle ?? '');
    process.exitCode = 1;
  }
  const costo =
    (r.uso.entrada * PRECIO_POR_MILLON.entrada + r.uso.salida * PRECIO_POR_MILLON.salida) / 1e6;
  console.error(
    `[${r.estado}] ${r.vueltas} vuelta(s), ${r.uso.entrada} tokens de entrada, ` +
      `${r.uso.salida} de salida, ~US$${costo.toFixed(4)}`,
  );
} catch (e) {
  process.exitCode = 1;
  if (e instanceof Anthropic.AuthenticationError) console.error('La API rechazó la llave: revisa ANTHROPIC_API_KEY.');
  else if (e instanceof Anthropic.RateLimitError) console.error('Límite de uso de la API: espera un momento y reintenta.');
  else if (e instanceof Anthropic.APIError) console.error(`Error de la API (${e.status ?? 'sin conexión'}): ${e.message}`);
  else throw e;
} finally {
  await mcp.close();
}
