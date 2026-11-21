// Pruebas del ciclo con un modelo «guionado»: no llaman a la API ni cuestan nada.
//   node --test

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { correrAgente } from './ciclo.js';

const usage = { input_tokens: 10, output_tokens: 5 };
const responde = (text, stop_reason = 'end_turn') => ({
  stop_reason,
  content: [{ type: 'text', text }],
  usage,
});
const pide = (...nombres) => ({
  stop_reason: 'tool_use',
  content: nombres.map((name, i) => ({ type: 'tool_use', id: `id_${i}`, name, input: { n: i } })),
  usage,
});

// Devuelve las respuestas en orden; la última se repite. Guarda lo que recibió.
function modelo(...respuestas) {
  const recibido = [];
  const llamar = async (messages) => {
    recibido.push(structuredClone(messages));
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

test('ejecuta una tool y le devuelve el resultado al modelo', async () => {
  const m = modelo(pide('uf'), responde('listo'));
  const r = await correrAgente({ tarea: 'x', llamarModelo: m.llamar, ejecutarTool: toolOk });
  assert.equal(r.estado, 'listo');
  assert.deepEqual(r.uso, { entrada: 20, salida: 10 });

  const [usuario, asistente, resultados] = m.recibido[1];
  assert.equal(usuario.role, 'user');
  assert.equal(asistente.role, 'assistant');
  assert.equal(resultados.role, 'user');
  assert.deepEqual(resultados.content, [
    { type: 'tool_result', tool_use_id: 'id_0', content: 'resultado de uf', is_error: false },
  ]);
});

test('varias tools en una vuelta: todos los resultados en un solo mensaje', async () => {
  const m = modelo(pide('uf', 'dolar'), responde('listo'));
  await correrAgente({ tarea: 'x', llamarModelo: m.llamar, ejecutarTool: toolOk });
  const ultimo = m.recibido[1].at(-1);
  assert.deepEqual(ultimo.content.map((b) => b.tool_use_id), ['id_0', 'id_1']);
});

test('una tool con isError llega al modelo como is_error', async () => {
  const m = modelo(pide('uf'), responde('no pude'));
  const r = await correrAgente({
    tarea: 'x',
    llamarModelo: m.llamar,
    ejecutarTool: async () => ({ texto: 'la fuente no responde', error: true }),
  });
  assert.equal(r.estado, 'listo');
  const [resultado] = m.recibido[1].at(-1).content;
  assert.equal(resultado.is_error, true);
  assert.equal(resultado.content, 'la fuente no responde');
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
  const [resultado] = m.recibido[1].at(-1).content;
  assert.equal(resultado.is_error, true);
  assert.match(resultado.content, /conexión perdida/);
  assert.equal(auditoria[0].error, true);
});

test('el tope de vueltas detiene a un agente que no termina', async () => {
  const m = modelo(pide('uf'));
  const r = await correrAgente({ tarea: 'x', llamarModelo: m.llamar, ejecutarTool: toolOk, maxVueltas: 3 });
  assert.equal(r.estado, 'tope_de_vueltas');
  assert.equal(r.vueltas, 3);
  assert.equal(m.recibido.length, 3);
});

for (const stop_reason of ['max_tokens', 'refusal']) {
  test(`con ${stop_reason} no se ejecuta la tool que venía en la respuesta`, async () => {
    const m = modelo({ ...pide('pagar'), stop_reason, stop_details: { category: null } });
    let ejecutadas = 0;
    const r = await correrAgente({
      tarea: 'x',
      llamarModelo: m.llamar,
      ejecutarTool: async () => {
        ejecutadas++;
        return { texto: 'pagado', error: false };
      },
    });
    assert.equal(r.estado, stop_reason);
    assert.equal(ejecutadas, 0);
  });
}

test('pause_turn continúa con la misma conversación', async () => {
  const m = modelo(responde('sigo', 'pause_turn'), responde('listo'));
  const r = await correrAgente({ tarea: 'x', llamarModelo: m.llamar, ejecutarTool: toolOk });
  assert.equal(r.estado, 'listo');
  assert.equal(r.vueltas, 2);
  assert.equal(m.recibido[1].at(-1).role, 'assistant');
});
