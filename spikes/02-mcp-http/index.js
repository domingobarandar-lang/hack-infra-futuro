// Servidor MCP remoto: las mismas 3 tools del spike 01, servidas por HTTP.
//
//   Local:    node --env-file=.env index.js
//   Railway:  node index.js (Railway define PORT; MCP_TOKEN va en sus variables)

import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { crearServidor } from './herramientas.js';

const PORT = process.env.PORT ?? 3000;
const TOKEN = process.env.MCP_TOKEN ?? '';
if (TOKEN.length < 32) {
  console.error('Falta MCP_TOKEN o es muy corto (mínimo 32 caracteres). Revisa .env o las variables de Railway.');
  process.exit(1);
}

// createMcpHandler crea un servidor nuevo por petición con la fábrica (modo sin
// estado) y habla las dos eras del protocolo. toNodeHandler lo adapta a (req, res).
const mcp = toNodeHandler(createMcpHandler(crearServidor));

// Sin token correcto no se llega a las tools. timingSafeEqual compara en tiempo
// constante: así el tiempo de respuesta no revela cuántos caracteres acertó alguien.
const ESPERADO = Buffer.from(`Bearer ${TOKEN}`);
function exigirToken(req, res, next) {
  const recibido = Buffer.from(req.get('authorization') ?? '');
  if (recibido.length === ESPERADO.length && timingSafeEqual(recibido, ESPERADO)) return next();
  res.status(401).json({ error: 'Falta el token o no es válido' });
}

const app = express();

// Una línea de log por petición. Aquí console.log sí se puede: el protocolo va
// por HTTP, no por stdout.
app.use((req, res, next) => {
  const inicio = Date.now();
  res.on('finish', () => console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - inicio} ms`));
  next();
});

app.get('/', (req, res) => res.json({ servicio: 'mcp-http', mcp: '/mcp' })); // para el healthcheck
app.all('/mcp', exigirToken, mcp);

app.listen(PORT, () => console.log(`mcp-http escuchando en el puerto ${PORT}`));
