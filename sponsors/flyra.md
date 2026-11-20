# Flyra

CRM y back-office para empresas de servicios a domicilio (limpieza de
ventanas, hidrolavado, canaletas, mantención). Cubre leads, agenda y trabajos,
presupuestos, cobros, suscripciones, mapa puerta a puerta, automatizaciones,
nómina y reportes. Su frase: «The infrastructure behind modern service businesses».

Los ejemplos de la documentación usan teléfonos y precios de EE. UU. Precios:
USD 198, 298 y 448 al mes, con **prueba gratis de 7 días**.

## API

- Documentación: https://developers.flyra.io
- Especificación OpenAPI: https://developers.flyra.io/openapi.json
- Versión para LLMs: https://developers.flyra.io/llms.txt
- Base: `https://app.flyra.io/v2026-06-01/…`
- Autenticación: `Authorization: Bearer flr_live_…`. Un administrador crea la
  llave en *Developer* y le activa áreas con permiso de lectura o escritura
  (Jobs read/write, SMS send, etc.). Sin el permiso, la API responde 4xx.
- Más de 200 endpoints en 23 áreas: mensajes y SMS, email, llamadas (con
  transcripción), clientes, leads, trabajos y agenda, presupuestos, facturas y
  pagos, suscripciones, lista de precios, mapa, equipo, automatizaciones,
  reseñas, tareas, formularios, gastos, nómina, contratos, inventario,
  configuración, cambios masivos y búsqueda.
- **Acciones con nombre**: todo lo que hace Flyra tiene un nombre y se llama con
  `POST /actions/{name}` (por ejemplo `find_open_slot`). Es la misma capa que usa su MCP.
- Cada llamada queda registrada (auditoría). Hay webhooks de entrada y salida en
  las automatizaciones, con 225 disparadores.
- Las listas paginan con `limit` y `offset`.

## Servidor MCP

- `mcp.flyra.io`, con 488 acciones, la misma llave y los mismos permisos que la API REST.
- Funciona con Claude y ChatGPT. Instrucciones: https://developers.flyra.io/developers/mcp
- Detalle llamativo: cuando Flyra no puede hacer algo, el agente puede reportar
  esa carencia él mismo.

## Qué significa para el track

Flyra ya es agent-ready: tiene MCP, permisos por área y auditoría. El desafío
probablemente no será «conectar un agente a Flyra», sino algo encima de eso:
agentes que operen el negocio (atender, agendar, cobrar, hacer seguimiento) o que
construyan lo que Flyra no tiene. El CTO ha dicho en público que los clientes
van a construir soluciones propias encima, usando Flyra como backend.

## Para preparar

- [ ] Leer `llms.txt` y recorrer la referencia: clientes, trabajos, presupuestos, facturas, mensajes.
- [ ] Revisar la lista de acciones de la especificación OpenAPI.
- [ ] **No activar la prueba de 7 días todavía.** Si se activa el 1 de
      diciembre dura hasta el 8, y cubre el evento. Es probable que el sponsor dé acceso ahí.
- [ ] Con cuenta: conectar su MCP a Claude y pedirle un flujo completo
      (lead → presupuesto → trabajo agendado → SMS de confirmación).
