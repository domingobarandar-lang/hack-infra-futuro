# Ideas por track

Son apuestas para entrenar y para tener un plan B. El desafío real de Flyra y
Payku se anuncia en el kickoff, así que la idea final se ajusta ahí.

## Recomendación: Payku más infraestructura de agentes

**«Agentes que cobran y pagan sin miedo».** Un servidor MCP para Payku con las
salvaguardas que un agente necesita para mover plata, y un caso de uso concreto
encima.

- **Por qué esta:** Payku no tiene MCP. Mover plata obliga a mostrar
  infraestructura seria (límites, aprobación humana, idempotencia, webhooks
  verificados, auditoría). Sirve para el track de Payku y también encaja en
  el de infraestructura.
- **Caso de uso:** cobranza de gastos comunes de un condominio, un mundo que ya
  conoces. El agente manda links de pago, concilia con el webhook, persigue a los
  morosos y paga a proveedores con payout **solo después de tu aprobación**.
- **Demo de 90 segundos:** «Cobra los gastos comunes de diciembre» → salen links
  reales del sandbox → alguien paga con tarjeta de prueba → el webhook lo marca
  pagado → el agente propone pagarle al jardinero → aparece el botón de aprobar →
  payout hecho → log de auditoría con todo.

## Plan B: agent-ready government

**Licitaciones para PyMEs.** Un agente que encuentra licitaciones de Mercado
Público que calzan con una empresa, revisa los requisitos, chequea en Croma que
la empresa no tenga sanciones ni causas que la inhabiliten, y arma el checklist
de la postulación.

- Usa los créditos de Croma que dan a todos.
- Alternativa con guiño a la CChC: un agente de permisología que reúne el estado
  de los permisos y la evaluación ambiental de un proyecto de construcción.

## Plan C: track de Flyra

**Recepcionista de voz para una empresa de servicios.** Atiende la llamada con
ElevenLabs, cotiza con la lista de precios de Flyra, busca un horario libre
(`find_open_slot`), agenda el trabajo, manda el SMS de confirmación y deja el
presupuesto enviado.

- Compite además por «Mejor uso de ElevenLabs».
- Riesgo: Flyra ya trae su propio MCP. El valor tiene que estar en el flujo
  completo y en lo que Flyra no hace.

## Plan D: infraestructura pura

**Puerta de permisos para agentes.** Un proxy MCP que toma cualquier API con
especificación OpenAPI (por ejemplo la de Flyra) y la expone a agentes con
permisos por herramienta, aprobación humana para escrituras, dry-run y auditoría.

- Es lo más genérico. Gana si la demo muestra dos sistemas distintos (Flyra y
  Payku) protegidos por la misma puerta.

## Cómo elegir el día del evento

Puntuar de 1 a 5, a las 14:30, con el desafío ya anunciado:

| Criterio | Pregunta |
|---|---|
| Sistema real | ¿La demo toca un sistema real, sin mocks? |
| 90 segundos | ¿Se entiende en una demo de 90 segundos? |
| 20 horas | ¿El camino feliz se puede tener listo antes de las 20:00? |
| Jueces | ¿Responde a lo que dijeron en la apertura que van a evaluar? |
| Ventaja propia | ¿Usa algo que el equipo sabe y otros no? |
