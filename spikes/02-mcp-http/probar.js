// Cliente de prueba por HTTP. Lee MCP_TOKEN (y MCP_URL, opcional) del entorno:
//
//   node --env-file=.env probar.js                                   servidor local
//   node --env-file=.env probar.js https://xxx.up.railway.app/mcp    servidor en Railway

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const url = new URL(process.argv[2] ?? process.env.MCP_URL ?? 'http://localhost:3000/mcp');
console.log(`Servidor: ${url}`);

// 1. Ruta de salud y 2. /mcp sin token, con fetch a secas.
const salud = await fetch(new URL('/', url));
console.log(`GET /           -> ${salud.status} ${await salud.text()}`);
const sinToken = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
console.log(`POST /mcp sin token -> ${sinToken.status} ${await sinToken.text()}`);

// 3. El cliente MCP, con el token en el header Authorization.
const transport = new StreamableHTTPClientTransport(url, {
  requestInit: { headers: { Authorization: `Bearer ${process.env.MCP_TOKEN}` } },
});
const client = new Client({ name: 'probar-http', version: '1.0.0' });
await client.connect(transport);

const { tools } = await client.listTools();
console.log(`\nTools (${tools.length}): ${tools.map((t) => t.name).join(', ')}`);

const llamadas = [
  ['indicadores_economicos', { indicador: 'dolar' }],
  ['convertir_clp_uf', { monto: 3, desde: 'UF' }],
  ['buscar_datasets', { consulta: 'title:transporte', max: 2 }],
];
for (const [name, args] of llamadas) {
  const inicio = Date.now();
  const r = await client.callTool({ name, arguments: args });
  const texto = r.content.map((c) => c.text).join('\n').replace(/\s+/g, ' ');
  console.log(`\n${name} ${JSON.stringify(args)} ${r.isError ? '[isError] ' : ''}(${Date.now() - inicio} ms)\n  ${texto.slice(0, 300)}`);
}

await client.close();
