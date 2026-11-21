# Plan de preparación (viernes 20 de noviembre → sábado 5 de diciembre)

Quedan 15 días. El desafío de cada sponsor se conoce recién en el kickoff, así
que no conviene casarse con una idea. La meta es llegar con **soltura en las
piezas** que cualquier proyecto va a necesitar, y con un plan para las 20 horas.

## Estrategia

1. **La demo en la mesa decide.** Los jueces pasan por cada mesa entre las 13:00
   y las 15:30 del domingo. Gana lo que funciona en vivo contra un sistema real,
   no lo que se ve bien en slides.
2. **«Sistema real» es el filtro.** El evento existe porque los agentes se
   traban al entrar a sistemas reales. Nada de mocks en la demo: sandbox de
   Payku, cuenta de Flyra o datos oficiales.
3. **Los tracks de sponsor suelen tener menos competencia.** Con 500 personas,
   la mayoría va a los tracks abiertos. Y un proyecto de sponsor puede tener
   también ángulo de infraestructura.
4. **Lo que ya sabes es tu ventaja.** Llevas un sistema en producción con
   incidentes reales. Permisos, auditoría, reintentos y aprobaciones humanas son
   justo lo que le falta a la mayoría de los demos de agentes, y lo que el track
   de infraestructura premia.

## Qué aprender, por prioridad

| # | Tema | Meta concreta | Por qué |
|---|---|---|---|
| 1 | **MCP** (Model Context Protocol) | Servidor MCP propio en Node con 3 tools, conectado a Claude, primero local (stdio) y después remoto (HTTP) desplegado en Railway | Es como los agentes «entran» a sistemas. Flyra ya tiene uno; Payku no |
| 2 | **Uso de herramientas con la API de Claude** | Un loop de agente en Node que llama tools, maneja errores y termina | La base de cualquier agente propio |
| 3 | **Patrones de producción para agentes** | Aprobación humana antes de acciones con plata, llaves de idempotencia, log de auditoría, permisos por tool, modo dry-run | Es lo que separa un demo de algo que «llega a producción» |
| 4 | **Webhooks firmados** | Recibir y verificar el `urlnotify` de Payku y firmar con HMAC-SHA256 | Los sistemas reales responden asíncrono |
| 5 | **Evals mínimas** | 10 tareas de prueba y un script que diga cuántas resuelve el agente sin ayuda | Un número («9 de 10») convence a un juez técnico |
| 6 | Voz (opcional) | Agente de ElevenLabs que llama a una tool tuya | Tiene premio propio y luce en vivo |

Material base: documentación de MCP (modelcontextprotocol.io) y su SDK de
TypeScript (la v2, `@modelcontextprotocol/server` y `@modelcontextprotocol/client`;
la mayoría de los ejemplos en internet son de la v1, `@modelcontextprotocol/sdk`), la guía de tool use de la API de Claude, el Agent SDK de Claude y
la documentación de agentes de ElevenLabs.

## Calendario

| Días | Foco | Entregable |
|---|---|---|
| **Vie 20 – dom 22 nov** | MCP y tool use | Servidor MCP propio con 3 tools usado desde Claude. Pedir el ticket de Mercado Público. Crear la cuenta sandbox de Payku |
| **Lun 23** | Spike Payku (2–3 h) | Transacción creada, pagada con tarjeta de prueba y confirmada por webhook, con la firma `Sign` en Node |
| **Mar 24** | Spike gobierno (2–3 h) | Una consulta real a Mercado Público o datos.gob.cl, envuelta como tool MCP. Revisar Croma |
| **Mié 25** | Spike Flyra (2 h) | Leer `llms.txt` y la especificación. Lista de 10 acciones útiles para un agente |
| **Jue 26 – vie 27** | Patrones de producción | Aprobación humana y auditoría probadas sobre el spike de Payku (payout que espera tu OK) |
| **Sáb 28 – dom 29** | **Mini-hackathon de ensayo, 8 h cronometradas** | Una idea de [IDEAS.md](IDEAS.md) de punta a punta. Retro: qué te frenó |
| **Lun 30 nov – mié 2 dic** | Corregir lo que frenó y armar equipo | Roles definidos, guion de demo, plantilla de pitch. Activar la prueba de Flyra el 1 de diciembre |
| **Jue 3 – vie 4 dic** | Logística y descanso | Checklist de abajo completo. Nada de temas nuevos |

### Avance

- **20 nov:** servidor MCP local por stdio con 3 tools (indicadores, datos.gob.cl
  y conversión CLP↔UF), probado con un cliente propio, con MCP Inspector y
  desde Claude Code, que lo carga por `.mcp.json` y usa sus 3 tools:
  [spikes/01-mcp-basico](spikes/01-mcp-basico/).
- **20 nov:** el mismo servidor por HTTP con token, desplegado en Railway
  (proyecto `hack-infra-spikes`, modo serverless) y usado desde Claude Code:
  [spikes/02-mcp-http](spikes/02-mcp-http/).
- **20 nov:** ciclo de agente propio con Gemini (`gemini-3.8-flash`) que usa las
  tools MCP, local y remoto, con manejo de errores, tope de vueltas y auditoría:
  [spikes/03-agente](spikes/03-agente/). Siguiente: patrones de producción
  (prioridad 3).

## Checklist antes del evento

**Cuentas y llaves** (cada una la creas tú; las llaves van en un gestor de contraseñas, nunca en el repo)
- [ ] API de Claude con saldo y límite de gasto
- [ ] Railway (ya la tienes) con un proyecto vacío listo
- [ ] Payku sandbox: token público y privado
- [ ] Ticket de Mercado Público
- [ ] Flyra: prueba activada el 1 de diciembre
- [ ] ElevenLabs, Firecrawl, Croma y Wispr Flow: reclamar los créditos cuando los entreguen
- [ ] GitHub: plantilla de repo vacía con `.gitignore` y `.env.example`

**Equipo**
- [ ] Definir equipo (máximo 4). Mezcla ideal: 2 que programen (backend y agente,
      frontend y demo) y 1 que cuide el problema, el pitch y hable con los mentores
- [ ] Repartir roles antes de llegar

**Físico**
- [ ] Notebook y cargador, alargador o zapatilla, mouse, audífonos
- [ ] Teléfono cargado (para demos por WhatsApp o voz) y hotspot de respaldo
- [ ] Algo para dormir un par de horas (polerón, antifaz)

## Reglas que faltan

Hasta que expliquen las reglas (sábado 13:00), lo seguro es:

- **El código del proyecto se escribe en el evento**, en un repo nuevo creado ahí.
  Este repo es solo de preparación.
- Lo que sí se puede traer: conocimiento, cuentas listas, llaves, apuntes y
  ejemplos de la documentación pública.
- Si al final permiten plantillas previas, se declaran en el README del proyecto.

## Plan de las 20 horas (sábado 14:30 → domingo 10:30)

| Hora | Qué | Regla |
|---|---|---|
| 14:30–15:30 | Elegir track y escribir el **guion de la demo de 90 segundos** antes de programar. Repo nuevo y un «hola mundo» desplegado | Si no cabe en 90 segundos, es demasiado grande |
| 15:30–20:00 | Camino feliz de punta a punta contra el sistema real, aunque sea feo | Nada de UI bonita todavía |
| 20:00–01:00 | Robustez: errores, aprobaciones, auditoría. UI mínima para mostrar | Congelar alcance a las 01:00 |
| 01:00–05:00 | Dormir por turnos (2 personas a la vez) | Alguien siempre despierto con el deploy |
| 05:00–08:30 | Pulir la demo, correr las evals, **grabar un video de respaldo** | Si el wifi falla, el video salva |
| 08:30–10:30 | Entregar con margen. El cierre es a las 10:30 | No dejarlo para el último minuto |
| 10:30–13:00 | Ensayar el pitch de mesa: 2 minutos más demo más preguntas | Cada integrante puede presentarlo solo |
