// Agente de línea de comandos: Gemini decide, las tools MCP actúan.
//
//   node --env-file=.env agente.js "¿Cuánto son 3 UF en pesos?"
//   node --env-file=.env agente.js --remoto "¿A cuánto está el dólar?"
//
// Por defecto usa el servidor del spike 01 (stdio). Con --remoto, el del spike 02.

import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { ApiError, GoogleGenAI } from '@google/genai';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { correrAgente } from './ciclo.js';

const MODELO = process.env.GEMINI_MODEL ?? 'gemini-3.8-flash';
const MAX_VUELTAS = Number(process.env.MAX_VUELTAS ?? 8);
// US$ por millón de tokens en la capa de pago, vigente hasta el 31-12-2026.
const PRECIOS = { 'gemini-3.8-flash': { entrada: 0.75, salida: 3.75 } };
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
if (!process.env.GEMINI_API_KEY) salir('Falta GEMINI_API_KEY. Cópiala en .env (ver .env.example).');

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

// 1. Conectarse al servidor MCP y traducir sus tools al formato de Gemini.
const mcp = new Client({ name: 'agente', version: '1.0.0' });
let toolsMcp;
try {
  await mcp.connect(crearTransporte());
  ({ tools: toolsMcp } = await mcp.listTools());
} catch (e) {
  salir(`No se pudo conectar al servidor MCP: ${e.message}`);
}
const functionDeclarations = toolsMcp.map((t) => ({
  name: t.name,
  description: t.description,
  parametersJsonSchema: t.inputSchema,
}));

// 2. Cómo se llama al modelo. Los errores 408, 429 y 5xx se reintentan solos.
const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { retryOptions: { attempts: 3 } },
});
const llamarModelo = (contents) =>
  gemini.models.generateContent({
    model: MODELO,
    contents,
    config: {
      systemInstruction: SISTEMA,
      maxOutputTokens: 16000,
      tools: [{ functionDeclarations }],
    },
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
  const precio = PRECIOS[MODELO];
  const costo = precio
    ? `, ~US$${((r.uso.entrada * precio.entrada + r.uso.salida * precio.salida) / 1e6).toFixed(4)} en capa de pago`
    : '';
  console.error(
    `[${r.estado}] ${MODELO}, ${r.vueltas} vuelta(s), ${r.uso.entrada} tokens de entrada, ` +
      `${r.uso.salida} de salida${costo}`,
  );
} catch (e) {
  process.exitCode = 1;
  if (e instanceof ApiError && e.status === 429) console.error('Límite de uso de Gemini: espera un momento y reintenta.');
  else if (e instanceof ApiError) console.error(`Error de la API de Gemini (${e.status}): ${e.message}`);
  else throw e;
} finally {
  await mcp.close();
}
