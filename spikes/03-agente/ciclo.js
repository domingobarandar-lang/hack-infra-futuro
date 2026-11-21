// El ciclo del agente: preguntar al modelo, ejecutar las tools que pida,
// devolverle los resultados y repetir hasta que termine o se acabe el tope.
//
// No sabe nada de Claude ni de MCP: recibe dos funciones (`llamarModelo` y
// `ejecutarTool`). Por eso se puede probar sin gastar en la API (ciclo.test.js).

export async function correrAgente({
  tarea,
  llamarModelo,
  ejecutarTool,
  maxVueltas = 8,
  alUsarTool = () => {},
}) {
  // La API no recuerda nada: en cada vuelta se manda la conversación completa.
  const messages = [{ role: 'user', content: tarea }];
  const uso = { entrada: 0, salida: 0 };

  for (let vuelta = 1; vuelta <= maxVueltas; vuelta++) {
    const respuesta = await llamarModelo(messages);
    uso.entrada += respuesta.usage?.input_tokens ?? 0;
    uso.salida += respuesta.usage?.output_tokens ?? 0;

    const texto = respuesta.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    // `stop_reason` dice por qué paró el modelo, y de eso depende el siguiente paso.
    switch (respuesta.stop_reason) {
      case 'end_turn':
        return { estado: 'listo', texto, vueltas: vuelta, uso };

      case 'pause_turn':
        // El servidor pausó el turno: se devuelve tal cual para que siga.
        messages.push({ role: 'assistant', content: respuesta.content });
        continue;

      case 'tool_use': {
        // Se guarda `content` completo: incluye el razonamiento del modelo,
        // que la API necesita de vuelta junto con las llamadas a tools.
        messages.push({ role: 'assistant', content: respuesta.content });
        const pedidas = respuesta.content.filter((b) => b.type === 'tool_use');
        const resultados = await ejecutarTools(pedidas, ejecutarTool, alUsarTool);
        // Todos los resultados van juntos, en un solo mensaje de usuario.
        messages.push({ role: 'user', content: resultados });
        continue;
      }

      default:
        // `refusal`, `max_tokens` u otro: se termina SIN ejecutar nada, porque
        // una llamada a tool cortada a la mitad puede traer argumentos incompletos.
        return {
          estado: respuesta.stop_reason,
          texto,
          vueltas: vuelta,
          uso,
          detalle: respuesta.stop_details ?? null,
        };
    }
  }

  // El tope evita que un agente confundido gaste sin fin.
  return { estado: 'tope_de_vueltas', texto: '', vueltas: maxVueltas, uso };
}

// Una tool que falla no mata al agente: el error vuelve al modelo con
// `is_error: true`, y él decide si reintenta, cambia de camino o avisa.
async function ejecutarTools(pedidas, ejecutarTool, alUsarTool) {
  const resultados = [];

  for (const { id, name, input } of pedidas) {
    const inicio = Date.now();
    let texto;
    let error;
    try {
      ({ texto, error } = await ejecutarTool(name, input));
    } catch (e) {
      texto = `No se pudo ejecutar la tool: ${e.message}`;
      error = true;
    }

    alUsarTool({ tool: name, input, error: Boolean(error), ms: Date.now() - inicio });
    resultados.push({
      type: 'tool_result',
      tool_use_id: id, // así el modelo sabe a cuál de sus llamadas corresponde
      content: texto,
      is_error: Boolean(error),
    });
  }

  return resultados;
}
