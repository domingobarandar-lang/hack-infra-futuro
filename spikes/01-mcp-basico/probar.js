// Cliente MCP de prueba: lanza server.js, lista sus tools y llama cada una.
//
//   node probar.js            llamadas reales a las APIs
//   node probar.js --sin-red  todas las salidas a internet fallan, para ver los isError

import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const sinRed = process.argv.includes('--sin-red');

// El transporte stdio lanza el servidor como proceso hijo y habla por sus stdin/stdout.
// En modo --sin-red, Node manda todo el tráfico HTTP a un proxy que no existe.
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['server.js'],
  cwd: import.meta.dirname,
  env: sinRed ? { ...process.env, NODE_USE_ENV_PROXY: '1', HTTPS_PROXY: 'http://127.0.0.1:9' } : undefined,
});

const client = new Client({ name: 'probar', version: '1.0.0' });
await client.connect(transport);

const { tools } = await client.listTools();
console.log(`Tools del servidor (${tools.length}):`);
for (const t of tools) console.log(`  - ${t.name}: ${t.description}`);

const llamadas = [
  ['indicadores_economicos', { indicador: 'uf' }],
  ['indicadores_economicos', {}],
  ['buscar_datasets', { consulta: 'calidad del aire', max: 2 }],
  ['convertir_clp_uf', { monto: 1_000_000, desde: 'CLP' }],
  ['convertir_clp_uf', { monto: 2.5, desde: 'UF' }],
  ['convertir_clp_uf', { monto: -5, desde: 'CLP' }], // inválido a propósito: lo rechaza zod
];

for (const [name, args] of llamadas) {
  console.log(`\n### ${name} ${JSON.stringify(args)}`);
  const inicio = Date.now();
  try {
    const r = await client.callTool({ name, arguments: args });
    const texto = r.content.map((c) => c.text).join('\n');
    console.log(`${r.isError ? '[isError] ' : ''}(${Date.now() - inicio} ms)\n${texto.slice(0, 1200)}`);
  } catch (e) {
    console.log(`[excepción en el cliente] ${e.message}`);
  }
}

await client.close();
