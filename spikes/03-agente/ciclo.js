// El ciclo del agente: preguntar al modelo, ejecutar las tools que pida,
// devolverle los resultados y repetir hasta que termine o se acabe el tope.
//
// No sabe nada de MCP ni de cómo se conecta a Gemini: recibe dos funciones
// (`llamarModelo` y `ejecutarTool`). Por eso se puede probar gratis (ciclo.test.js).

export async function correrAgente({
  tarea,
  llamarModelo,
  ejecutarTool,
  maxVueltas = 8,
  alUsarTool = () => {},
}) {
  // La API no recuerda nada: en cada vuelta se manda la conversación completa.
  const contents = [{ role: 'user', parts: [{ text: tarea }] }];
  const uso = { entrada: 0, salida: 0 };

  for (let vuelta = 1; vuelta <= maxVueltas; vuelta++) {
    const respuesta = await llamarModelo(contents);
    const tokens = respuesta.usageMetadata;
    uso.entrada += tokens?.promptTokenCount ?? 0;
    uso.salida += (tokens?.candidatesTokenCount ?? 0) + (tokens?.thoughtsTokenCount ?? 0);

    // Sin candidato: Gemini bloqueó la petición antes de responder.
    const candidato = respuesta.candidates?.[0];
    if (!candidato) {
      return {
        estado: respuesta.promptFeedback?.blockReason ?? 'sin_respuesta',
        texto: '',
        vueltas: vuelta,
        uso,
        detalle: respuesta.promptFeedback?.blockReasonMessage ?? null,
      };
    }

    const partes = candidato.content?.parts ?? [];
    const texto = partes
      .filter((p) => p.text && !p.thought)
      .map((p) => p.text)
      .join('');

    // `finishReason` dice por qué paró. Si no es STOP (MAX_TOKENS, SAFETY...) se
    // termina SIN ejecutar nada: una llamada cortada puede traer argumentos incompletos.
    if (candidato.finishReason !== 'STOP') {
      return {
        estado: candidato.finishReason ?? 'sin_motivo',
        texto,
        vueltas: vuelta,
        uso,
        detalle: candidato.finishMessage ?? null,
      };
    }

    // En Gemini, pedir una tool también termina en STOP: se distingue por las partes.
    const pedidas = partes.filter((p) => p.functionCall).map((p) => p.functionCall);
    if (pedidas.length === 0) return { estado: 'listo', texto, vueltas: vuelta, uso };

    // Se guarda `content` completo y sin tocar: trae las firmas de razonamiento
    // (thought signatures) que la API necesita de vuelta.
    contents.push(candidato.content);
    // Todos los resultados van juntos, en un solo mensaje y en el mismo orden.
    contents.push({ role: 'user', parts: await ejecutarTools(pedidas, ejecutarTool, alUsarTool) });
  }

  // El tope evita que un agente confundido gaste sin fin.
  return { estado: 'tope_de_vueltas', texto: '', vueltas: maxVueltas, uso };
}

// Una tool que falla no mata al agente: el error vuelve al modelo en la clave
// `error`, y él decide si reintenta, cambia de camino o avisa.
async function ejecutarTools(pedidas, ejecutarTool, alUsarTool) {
  const partes = [];

  for (const { id, name, args = {} } of pedidas) {
    const inicio = Date.now();
    let texto;
    let error;
    try {
      ({ texto, error } = await ejecutarTool(name, args));
    } catch (e) {
      texto = `No se pudo ejecutar la tool: ${e.message}`;
      error = true;
    }

    alUsarTool({ tool: name, input: args, error: Boolean(error), ms: Date.now() - inicio });
    partes.push({
      functionResponse: {
        ...(id && { id }), // así el modelo sabe a cuál de sus llamadas corresponde
        name,
        response: error ? { error: texto } : { output: texto },
      },
    });
  }

  return partes;
}
