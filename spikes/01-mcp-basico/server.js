// Servidor MCP de práctica: 3 tools sobre datos públicos de Chile, por stdio.
//
// Regla de oro de stdio: stdout es el canal del protocolo. Nunca uses
// console.log aquí (rompe los mensajes JSON); para depurar, console.error.

import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';

// mindicador.cl primero; findic.cl publica el mismo formato y sirve de respaldo.
const FUENTES_INDICADORES = ['https://mindicador.cl/api', 'https://findic.cl/api'];
const INDICADORES = ['uf', 'dolar', 'euro', 'utm', 'ipc', 'ivp', 'imacec', 'tpm',
  'libra_cobre', 'tasa_desempleo', 'dolar_intercambio', 'bitcoin'];
const SOLO_LECTURA = { readOnlyHint: true, openWorldHint: true };

// --- Acceso a las APIs ---------------------------------------------------

// fetch con tiempo límite y errores legibles.
async function getJson(url, ms = 6000) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(ms) });
  } catch (e) {
    const motivo = e.name === 'TimeoutError' ? `no respondió en ${ms / 1000} s` : 'no se pudo conectar';
    throw new Error(`${new URL(url).host} ${motivo}`);
  }
  if (!res.ok) throw new Error(`${new URL(url).host} respondió HTTP ${res.status}`);
  return res.json();
}

// Indicadores del día, de la primera fuente que responda.
async function leerIndicadores() {
  const fallas = [];
  for (const base of FUENTES_INDICADORES) {
    try {
      const datos = await getJson(base);
      const indicadores = {};
      for (const codigo of INDICADORES) {
        const i = datos[codigo];
        if (i) indicadores[codigo] = { nombre: i.nombre, valor: i.valor, unidad: i.unidad_medida, fecha: i.fecha.slice(0, 10) };
      }
      return { fuente: new URL(base).host, indicadores };
    } catch (e) {
      fallas.push(e.message);
    }
  }
  throw new Error(`No hay indicadores disponibles: ${fallas.join('; ')}. Intenta de nuevo en unos minutos.`);
}

// Lo que devuelve una tool: una lista de bloques de contenido. Aquí, un texto con JSON.
const json = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });

// --- El servidor y sus tools -----------------------------------------------

function crearServidor() {
  const server = new McpServer({ name: 'mcp-basico', version: '1.0.0' });

  server.registerTool('indicadores_economicos', {
    title: 'Indicadores económicos de Chile',
    description: 'Valor del día de la UF, dólar, euro, UTM, IPC y otros indicadores de Chile. '
      + 'Sin "indicador" devuelve todos.',
    inputSchema: z.object({
      indicador: z.enum(INDICADORES).optional().describe('Código del indicador, por ejemplo "uf" o "dolar"'),
    }),
    annotations: SOLO_LECTURA,
  }, async ({ indicador }) => {
    const { fuente, indicadores } = await leerIndicadores();
    if (!indicador) return json({ fuente, indicadores });
    if (!indicadores[indicador]) throw new Error(`${fuente} no trae el indicador "${indicador}" hoy.`);
    return json({ fuente, indicador, ...indicadores[indicador] });
  });

  server.registerTool('buscar_datasets', {
    title: 'Buscar datos abiertos del Estado',
    description: 'Busca conjuntos de datos en datos.gob.cl, el catálogo de datos abiertos del Estado de Chile. '
      + 'Devuelve título, institución, descripción y archivos descargables.',
    inputSchema: z.object({
      consulta: z.string().min(2).describe('Palabras a buscar, por ejemplo "licitaciones" o "calidad del aire"'),
      max: z.number().int().min(1).max(20).default(5).describe('Cuántos resultados devolver (1 a 20)'),
    }),
    annotations: SOLO_LECTURA,
  }, async ({ consulta, max }) => {
    const qs = new URLSearchParams({ q: consulta, rows: String(max) });
    const { success, result } = await getJson(`https://datos.gob.cl/api/3/action/package_search?${qs}`, 15000);
    if (!success) throw new Error('datos.gob.cl rechazó la búsqueda.');
    return json({
      total: result.count,
      datasets: result.results.map((d) => ({
        titulo: d.title,
        institucion: d.organization?.title ?? 'sin institución',
        descripcion: (d.notes ?? '').replace(/\s+/g, ' ').trim().slice(0, 300),
        actualizado: d.metadata_modified?.slice(0, 10),
        url: `https://datos.gob.cl/dataset/${d.name}`,
        archivos: d.resources.slice(0, 5).map((r) => ({ nombre: r.name, formato: r.format, url: r.url })),
      })),
    });
  });

  server.registerTool('convertir_clp_uf', {
    title: 'Convertir entre pesos y UF',
    description: 'Convierte un monto de pesos chilenos (CLP) a UF o de UF a CLP, con el valor de la UF de hoy.',
    inputSchema: z.object({
      monto: z.number().positive().describe('Monto a convertir'),
      desde: z.enum(['CLP', 'UF']).describe('Moneda del monto: "CLP" convierte a UF y "UF" convierte a CLP'),
    }),
    annotations: SOLO_LECTURA,
  }, async ({ monto, desde }) => {
    const { fuente, indicadores } = await leerIndicadores();
    const uf = indicadores.uf;
    if (!uf) throw new Error(`${fuente} no trae el valor de la UF hoy.`);
    const resultado = desde === 'CLP'
      ? { monto: Math.round((monto / uf.valor) * 10000) / 10000, moneda: 'UF' }
      : { monto: Math.round(monto * uf.valor), moneda: 'CLP' };
    return json({ entrada: { monto, moneda: desde }, resultado, valor_uf: uf.valor, fecha_uf: uf.fecha, fuente });
  });

  return server;
}

// serveStdio crea el servidor y lo conecta a stdin/stdout. Atiende clientes que
// hablan la versión 2025 del protocolo (initialize) y la 2026-07-28.
serveStdio(crearServidor);
console.error('mcp-basico listo por stdio');
