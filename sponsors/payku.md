# Payku

Pasarela de pagos de Chile, Perú y Venezuela con más de 10.000 comercios.
Cobros (Webpay, Mach, Etpay y tarjetas en Chile; Yape, PLIN y tarjetas en
Perú), suscripciones con reintentos, pagos masivos a terceros (payouts),
donaciones, marketplace y mall. Tiene certificación PCI DSS y SOC 2.

## API

- Documentación: https://docs.payku.com (Chile: https://docs.payku.com/cl/introduction/)
- **Documentación completa en Markdown para usar con IA**: https://docs.payku.com/ai/payku-docs-es.md
- Colección de Postman (calcula la firma sola):
  https://docs.payku.com/postman/payku-cl-es.postman_collection.json y su
  entorno https://docs.payku.com/postman/payku-environment.postman_environment.json
- Sandbox: `https://des.payku.cl/` y ambiente de pruebas https://testing-apirest.payku.cl/,
  con tarjetas de prueba de Webpay y Oneclick.
- La API es la misma en los tres países; cambian los medios de pago, la moneda y algunos campos.

### Autenticación y firma

- Al registrarse en https://app.payku.cl se reciben dos tokens.
- El **token público** va como `Authorization: Bearer TOKEN`.
- El **token privado** nunca se envía: firma con HMAC-SHA256 el header `Sign`.
  Lo exigen las suscripciones, anulaciones, mall y pagos a terceros.

### Flujo básico

1. **Cobro (PayIn)**: `POST /api/transaction` crea la orden y devuelve la URL de pago.
2. **Confirmación**: Payku avisa a tu `urlnotify` (webhook). Se verifica con
   `GET /api/transaction/{id}`. Hay que revisar el campo `status` del JSON, no
   solo el código HTTP.
3. **Pago a terceros (PayOut)**: `POST /api/wallet/payout` envía plata desde la wallet.

Otras áreas en Chile: transacción escrow, anulación, marketplace, mall,
eventos, suscripción, suscripción de consumo, wallet, conciliación, bancos y
medios de pago.

## Qué significa para el track

En la documentación no aparece un servidor MCP. Payku ofrece Markdown y Postman
para que una IA lo integre, pero no deja a un agente operar pagos directamente.
Ahí hay espacio, y calza con el track de infraestructura: un agente que mueve
plata necesita límites, aprobación humana, idempotencia, verificación de webhooks
y auditoría.

El escrow y los payouts son las piezas más interesantes para agentes: permiten
cobrar, retener y pagar a terceros en un mismo flujo.

## Para preparar

- [ ] Crear la cuenta de pruebas (la crea uno mismo, con sus datos) y guardar los dos tokens fuera del repo.
- [ ] Con Postman, en sandbox: crear una transacción, pagarla con una tarjeta de prueba y consultar su estado.
- [ ] Implementar en Node la firma `Sign` y un endpoint `urlnotify` que reciba la confirmación.
- [ ] Probar un payout en sandbox y una anulación.
- [ ] Leer las secciones de escrow, suscripción y conciliación.
