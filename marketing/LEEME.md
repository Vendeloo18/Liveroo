# Material de marca — Vendeloo

Piezas listas para usar (Instagram, WhatsApp, impresión):

- `post-lanzamiento.png` — 1080×1080, post cuadrado "Entra al vivo. Puja. Gana."
- `post-vendedores.png` — 1080×1080, reclutamiento de vendedores
- `story-teaser.png` — 1080×1920, story vertical (estado de WhatsApp / IG)
- `flyer-vendedores.pdf` — A4, one-pager para reclutar vendedores

Fuente: los `.html` + `build.mjs` / `flyer-build.mjs`. Para reconstruir, primero
regenerar `_fuentes.css` (Anton + Archivo en base64):

    UA="Mozilla/5.0 ... Chrome/120.0 Safari/537.36"
    curl -s -A "$UA" "https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;500;600;700;800;900&display=swap" -o gf.css
    # luego el snippet de node que descarga cada woff2 y lo mete en base64 (ver historial de git)

Se rasteriza con Chrome headless: `--screenshot` para PNG, `--print-to-pdf` para el flyer.
