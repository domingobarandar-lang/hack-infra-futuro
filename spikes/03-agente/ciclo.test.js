// Pruebas del ciclo con un modelo «guionado»: no llaman a la API ni cuestan nada.
//   node --test

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { correrAgente } from './ciclo.js';

const usageMetadata = { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 2 };
const candidato = (parts, finishReason = 'STOP') => ({
  candidates: [{ content: { role: 'model', parts }, finishReason }],
  usageMetadata,
});
const responde = (text, finishReason) => candidato([{ text }], finishReason);
const pide = (...nombres) =>
  candidato(
    nombres.map((name, i) => ({
      functionCall: { id: `id_${i}`, name, args: { n: i } },
      thoughtSignature: `firma_${i}`,
    })),
  );

// Devuelve las respuestas en orden; la última se repite. Guarda lo que recibió.
function modelo(...respuestas) {
  const recibido = [];
  const llamar = async (contents) => {
    recibido.push(structuredClone(contents));
    return respuestas[Math.min(recibido.length - 1, respuestas.length - 1)];
  };
  return { llamar, recibido };
}

const toolOk = async (name) => ({ texto: `resultado de ${name}`, error: false });

test('responde sin usar tools', async () => {
  const m = modelo(responde('hola'));
  const r = await correrAgente({ tarea: 'x', llamarModelo: m.llamar, ejecutarTool: toolOk });
  assert.equal(r.estado, 'listo');
  assert.equal(r.texto, 'hola');
  assert.equal(r.vueltas, 1);
});

test('no muestra el razonamiento como respuesta', async () => {
  const m = modelo(candidato([{ text: 'pensando', thought: true }, { text: 'hola' }]));
  const r = await correrAgente({ tarea: 'x', llamarModelo: m.llamar, ejecutarTool: toolOk });
  assert.equal(r.texto, 'hola');
});

test('ejecuta una tool y le devuelve el resultado al modelo', async () => {
  const m = modelo(pide('uf'), responde('listo'));
  const r = await correrAgente({ tarea: 'x', llamarModelo: m.llamar, ejecutarTool: toolOk });
  assert.equal(r.estado, 'listo');
  assert.deepEqual(r.uso, { entrada: 20, salida: 14 });

  const [usuario, delModelo, resultados] = m.recibido[1];
  assert.equal(usuario.role, 'user');
  assert.equal(delModelo.role, 'model');
  assert.equal(delModelo.parts[0].thoughtSignature, 'firma_0'); // la firma vuelve intacta
  assert.equal(resultados.role, 'user');
  assert.deepEqual(resultados.parts, [
    { functionResponse: { id: 'id_0', name: 'uf', response: { output: 'resultado de uf' } } },
  ]);
});

test('varias tools en una vuelta: todos los resultados en un solo mensaje', async () => {
  const m = modelo(pide('uf', 'dolar'), responde('listo'));
  await correrAgente({ tarea: 'x', llamarModelo: m.llamar, ejecutarTool: toolOk });
  const ultimo = m.recibido[1].at(-1);
  assert.deepEqual(ultimo.parts.map((p) => p.functionResponse.id), ['id_0', 'id_1']);
});

test('una tool con isError llega al modelo en la clave error', async () => {
  const m = modelo(pide('uf'), responde('no pude'));
  const r = await correrAgente({
    tarea: 'x',
    llamarModelo: m.llamar,
    ejecutarTool: async () => ({ texto: 'la fuente no responde', error: true }),
  });
  assert.equal(r.estado, 'listo');
  const [parte] = m.recibido[1].at(-1).parts;
  assert.deepEqual(parte.functionResponse.response, { error: 'la fuente no responde' });
});

test('una excepción en la tool no mata al agente', async () => {
  const m = modelo(pide('uf'), responde('no pude'));
  const auditoria = [];
  const r = await correrAgente({
    tarea: 'x',
    llamarModelo: m.llamar,
    ejecutarTool: async () => {
      throw new Error('conexión perdida');
    },
    alUsarTool: (l) => auditoria.push(l),
  });
  assert.equal(r.estado, 'listo');
  const [parte] = m.recibido[1].at(-1).parts;
  assert.match(parte.functionResponse.response.error, /conexión perdida/);
  assert.equal(auditoria[0].error, true);
});

test('el tope de vueltas detiene a un agente que no termina', async () => {
  const m = modelo(pide('uf'));
  const r = await correrAgente({ tarea: 'x', llamarModelo: m.llamar, ejecutarTool: toolOk, maxVueltas: 3 });
  assert.equal(r.estado, 'tope_de_vueltas');
  assert.equal(r.vueltas, 3);
  assert.equal(m.recibido.length, 3);
});

for (const motivo of ['MAX_TOKENS', 'SAFETY', 'MALFORMED_FUNCTION_CALL']) {
  test(`con ${motivo} no se ejecuta la tool que venía en la respuesta`, async () => {
    const m = modelo({ ...pide('pagar'), candidates: [{ ...pide('pagar').candidates[0], finishReason: motivo }] });
    let ejecutadas = 0;
    const r = await correrAgente({
      tarea: 'x',
      llamarModelo: m.llamar,
      ejecutarTool: async () => {
        ejecutadas++;
        return { texto: 'pagado', error: false };
      },
    });
    assert.equal(r.estado, motivo);
    assert.equal(ejecutadas, 0);
  });
}

test('una petición bloqueada termina con el motivo', async () => {
  const m = modelo({ promptFeedback: { blockReason: 'SAFETY', blockReasonMessage: 'bloqueado' }, usageMetadata });
  const r = await correrAgente({ tarea: 'x', llamarModelo: m.llamar, ejecutarTool: toolOk });
  assert.equal(r.estado, 'SAFETY');
  assert.equal(r.detalle, 'bloqueado');
});
