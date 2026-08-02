# Vendeloo — onboarding 75/25 + celebración — Design QA

- Source visual truth: conversación adjunta del 2026-08-02, con la segunda hoja saturada y el control SUBELOO ocupando casi toda la zona blanca.
- Production route: `https://vendeloo.io/onboarding`
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

La captura fuente fue inspeccionada antes de editar. La validación visual final quedó pendiente porque el Browser integrado dejó de estar disponible durante esta iteración. No se sustituyó por otro navegador para no romper la superficie de revisión elegida por el usuario.

## Checklist

- [x] Cambiar ambos pasos a 75/25.
- [x] Simplificar el segundo paso.
- [x] Mantener SUBELOO verde y el mensaje del dólar al completar.
- [x] Respetar que el bono solo sirve para ofertas y no se retira.
- [x] Usar confeti de pantalla completa en onboarding.
- [x] Reutilizar la misma celebración en venta en vivo y subasta normal.
- [ ] Capturar y comparar los estados finales en producción cuando el Browser integrado vuelva a estar disponible.

final result: blocked — visual capture unavailable; source and build verification passed
