---
name: diseno
description: Sistema visual de Vendeloo — tipografía, tokens, geometría del recorrido de entrada, movimiento y peso de imagen. Úsala antes de tocar apps/web/src/app/globals.css, las pantallas de onboarding y login, los heroes de campaña o cualquier componente de apps/web/src/components/ui/, y ante pedidos de ajustar el diseño, la tipografía, el espaciado o las animaciones. Incluye las trampas ya descubiertas con las tildes en mayúsculas y con el alto de la hoja blanca, que se rompieron más de una vez.
---

# El sistema visual de Vendeloo

## Tipografía: dos fuentes, sin excepciones

- **Anton** (`var(--f-campaign)`, que mapea a `--font-display`) — **únicamente** titulares de campaña y el logotipo. Nada más.
- **Archivo** — interfaz, cuerpo, botones, cifras, datos y formularios. Es la fuente por defecto.

Iconos: **Phosphor** (`@phosphor-icons/react`) en toda la app, incluido el panel de administración.

## La trampa del español en caja alta

Anton tiene la mayúscula en ~0,73em y la tilde suma ~0,20em por encima. Con interlineado por debajo de ~0,93 **la tilde de una línea entra dentro de la línea de arriba**. Se ve en "ASÍ DE FÁCIL", no se ve en "PUJALOO. GANALOO." — por eso pasa desapercibido hasta que alguien lo mira de cerca.

El titular de hero usa `line-height: 1`. **No lo bajes.** Un titular de campaña en inglés aguanta 0,86; en español no.

Lo mismo con el aire entre el antetítulo y el titular: la Í de MÍRALO se sale por arriba de su caja. Ese aire va en **`em` sobre el titular** (`padding-top: 0.13em`), nunca en un margen fijo en píxeles del antetítulo. Con píxeles se rompe cada vez que cambia la escala — ya pasó dos veces, una de ellas se arregló en el commit `dac7d8d` y volvió a romperse al unificar los tamaños.

## Una sola escala para todo el recorrido

El onboarding (dos pasos) y el login comparten hero. **Los tres usan la misma escala tipográfica**, heredada de la base:

| | |
|---|---|
| Titular | `clamp(2.75rem, 12.6vw, 3.8rem)` |
| Antetítulo | `0.65rem`, `letter-spacing: 0.17em`, `margin-bottom: 16px` |
| Bajada | `0.82rem`, `line-height: 1.4` |

La única que comprime es la vista de **formulario** del login (`.vlo-auth--formulario`), y por una razón física: ahí el hero se encoge a 34dvh para dejarle sitio a los campos.

Antes cada pantalla traía su propia escala —40,8px, 47,25px y 34,5px de titular— y se leían como tres plantillas distintas. Si vas a cambiar un tamaño, cambialo en la base, no por pantalla.

**Los tres niveles del hero llevan sombra de texto.** El antetítulo también: cae sobre la parte más clara de la foto de producto y sin sombra se pierde.

## Geometría del recorrido

```
┌─────────────────────────┐
│  hero: 70dvh + 16px     │   foto de producto a sangre
│                         │   copy absoluto arriba a la izquierda
├─────────────────────────┤   margin-top: -16px, radio 26px 26px 0 0
│  hoja blanca: 30dvh     │   min-height: 215px
│    contenido (flex:1)   │
│    ranura acción  58px  │  ← el naranja SIEMPRE acá
│    ranura apoyo   17px  │
│    ranura cola    36px  │
└─────────────────────────┘
```

**El botón naranja cae en el mismo píxel en las tres pantallas.** Eso no es casualidad: el pie son ranuras de **alto fijo**, y las de abajo reservan su alto aunque el paso no las use. Si una ranura usa `min-height` en vez de `height`, un contenido más alto la estira y —como el pie está anclado abajo— el botón sube. Fue exactamente el bug del salto de 75px.

Las dos puertas del login (`CREAR CUENTA` / `INICIAR SESIÓN`) miden esos mismos 58px.

**Antes de dar por buena una pantalla del recorrido, comprobá que la hoja no se desborde:** el pie tiene que terminar dentro del borde inferior de la hoja. Medí `.vlo-onb__footer` y `.vlo-onb__sheet` con `getBoundingClientRect()` y compará los `bottom`. El desborde no se ve —queda tapado— pero mueve todo lo de arriba.

## Tokens, nunca valores sueltos

`--accent: #ff6a00` · `--accent-strong: #dc5a00` · `--accent-soft: #ffe2ce` · `--accent-tint: #fdeee4` · `--line` · `--r-pill: 999px` · la rampa `--ink-*` para texto.

Hay tema oscuro: `--line` y compañía se redefinen. No escribas colores literales.

## Movimiento

Vocabulario existente, reutilizalo antes de inventar: `vlo-onb-rise` (entrada que sube), `vlo-onb-sello` (el titular cae en escala y se asienta), `vlo-onb-pop` (rebote de icono), `vlo-onb-line` (línea que se dibuja), `vlo-onb-sweep` (barrido de luz), `vlo-onb-copy-in`, `vlo-onb-product-in`.

Reglas:

1. **Solo `transform` y `opacity`.** Se componen en GPU; animar alto, margen o posición provoca reflow en teléfonos de gama baja.
2. **El login toma prestado el vocabulario del onboarding**, no inventa el suyo: el formulario entra con `vlo-onb-rise`, el mismo keyframe del contenido del onboarding. Esa es la sinergia, y está en el código.
3. **Escalonado, no simultáneo.** Los tres pasos del proceso entran a 0,10s / 0,25s / 0,40s.
4. **`transform-origin` a la izquierda** en lo que esté alineado a la izquierda, o al escalar se despega del margen.
5. **Siempre** un bloque `@media (prefers-reduced-motion: reduce)` que apague lo nuevo.
6. Si una animación de entrada tiene que redispararse al cambiar de paso, el nodo necesita `key={paso}` — sin eso React lo recicla y el contenido cambia de golpe.

## Peso de imagen

Los heroes actuales son PNG de entre 1,57 MB y 2,00 MB **cada uno**. Es mucho para la primera pantalla que ve alguien nuevo, y la conectividad es uno de los tres riesgos declarados del plan a diciembre.

Al agregar imágenes nuevas: **WebP**, producto recortado antes que escena compuesta, y el tamaño justo para el envase (los heroes se muestran a ~375-480px de ancho). No sumes otro PNG de 2 MB.

## Verificar, no suponer

El servidor de desarrollo está en el panel del navegador. Para diseño, medí con `getBoundingClientRect()` y `getComputedStyle()` antes de dar algo por resuelto: en esta sesión, "el área blanca no mide igual" resultó ser que medía exactamente igual y lo que fallaba era otra cosa. Una captura de pantalla reducida inventa marcas que no existen — si sospechás de un glifo, comprobalo contra el DOM.
