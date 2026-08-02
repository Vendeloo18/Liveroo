# Vendeloo — onboarding 75/25 + celebración — Design QA

- Source visual truth: conversación adjunta del 2026-08-02, con la segunda hoja saturada y el control SUBELOO ocupando casi toda la zona blanca.
- Production route: `https://vendeloo.io/onboarding` at commit `de200c9`.
- Target state: dos pasos con 75% de producto / 25% de acción; segundo paso reducido a una instrucción, un control y una nota; celebración de pantalla completa.

## Implementación revisada

- Ambos pasos usan `75dvh + 16px` para el hero y `25dvh` para la hoja, conservando el solape de 16px.
- El segundo paso ahora muestra únicamente `Desliza y recibe $1`, el control `SUBELOO` y `Solo para ofertas · no retirable`.
- El éxito conserva el botón verde y `¡TE GANASTE $1!`.
- La celebración reutilizable dispara confeti desde ambos laterales y desde el centro, con `z-index: 9999`, para cubrir toda la ventana.
- El mismo componente está montado en la victoria de la venta en vivo y en la victoria de la subasta normal.
- TypeScript pasó.
- La compilación de producción pasó; solo reportó advertencias preexistentes de lint.

## Verificación visual

- Captura fuente y estados finales se compararon juntos en el Browser integrado.
- Primer paso: `/tmp/vendeloo-design-qa-25/onboarding-step1.png`.
- Segundo paso: `/tmp/vendeloo-design-qa-25/onboarding-step2.png`.
- Éxito: `/tmp/vendeloo-design-qa-25/onboarding-step2-success.png`.
- Éxito móvil corregido: `/tmp/vendeloo-design-qa-mobile-confetti/mobile-confetti-production-full.png`.
- A 400 × 734, la hoja del primer paso ocupa exactamente 25.00% del viewport y no hay overflow.
- A 504 × 816, la hoja del segundo paso ocupa exactamente 25.00% del viewport y no hay overflow.
- El segundo paso elimina las tres líneas apiladas de la referencia y conserva una sola instrucción, un solo gesto y una sola restricción.
- En éxito existe un canvas de 504 × 816, anclado a `top: 0`, `left: 0` y `z-index: 9999`; el control queda verde y muestra `¡TE GANASTE $1!`.

## Corrección móvil

- [P1 resuelto] El usuario informó que el confeti no aparecía en el teléfono.
- Causas cubiertas: el modo `prefers-reduced-motion` ya no cancela por completo la celebración y la navegación posterior se amplió de 1.8 a 3.2 segundos.
- El canvas ahora se crea de forma explícita con `position: fixed`, `100vw × 100vh`, `pointer-events: none`, `z-index: 9999`, `resize: true` y `useWorker: false` para máxima compatibilidad con navegadores móviles.
- La referencia y la implementación móvil se compararon juntas a 504 × 816 px, CSS 504 × 816 y densidad 1.
- La captura final confirma confeti desde la parte superior hasta la hoja inferior, botón verde y `¡TE GANASTE $1!`, sin modificar la composición 75/25.
- La compilación de producción pasó y el despliegue Vercel de `de200c9` terminó con estado `success`.

## Checklist

- [x] Cambiar ambos pasos a 75/25.
- [x] Simplificar el segundo paso.
- [x] Mantener SUBELOO verde y el mensaje del dólar al completar.
- [x] Respetar que el bono solo sirve para ofertas y no se retira.
- [x] Usar confeti de pantalla completa en onboarding.
- [x] Reutilizar la misma celebración en venta en vivo y subasta normal.
- [x] Capturar y comparar los estados finales en producción.
- [x] Verificar la celebración corregida en viewport móvil y producción.

final result: passed
