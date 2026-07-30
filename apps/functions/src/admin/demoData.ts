// =============================================================
// CLOUD FUNCTION: manageDemoAuctions (callable, solo admin)
// =============================================================
// Herramienta de PRE-LANZAMIENTO para llenar y vaciar el catálogo de
// demostración. Existe porque las reglas —correctamente— ya no dejan
// escribir subastas sin autenticar: el script que hacía esto desde
// fuera dejó de funcionar el día que cerramos la base.
//
// Todo lo que crea lleva isDemo: true, así que "purgar" es exacto y no
// puede tocar una subasta real por accidente.
//
// Los datos son honestos: cero pujas, sin líder, y los cierres
// escalonados para que el catálogo no se vacíe de golpe.
//
// Cuando haya vendedores reales, esto se borra junto con la sección del
// panel que lo llama.
// =============================================================

import * as functions from "firebase-functions";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "../constants";

/** title, categoría, foto de Unsplash, precio, incremento, vendedor, horas hasta el cierre */
const CATALOGO: [string, string, string, number, number, string, number][] = [
  ["Set de maquillaje profesional 24 piezas", "Moda y Ropa", "photo-1596462502278-27bfdc403348", 15, 1, "seller007", 12],
  ["Auriculares Bluetooth con cancelación de ruido", "Electronica", "photo-1505740420928-5e560c06d30e", 12, 1, "seller003", 20],
  ["PlayStation 5 Slim 1TB edición estándar", "Electronica", "photo-1606813907291-d86efa9b94db", 10, 5, "seller004", 30],
  ["Tenis Nike Air Max 270 talla 42", "Calzado", "photo-1542291026-7eec264c27ff", 20, 2, "seller001", 42],
  ["Cargador inalámbrico rápido 15W", "Electronica", "photo-1615526675159-e248c3021d3f", 6, 1, "seller003", 56],
  ["Smartwatch deportivo con monitor cardíaco", "Electronica", "photo-1523275335684-37898b6baf30", 18, 1, "seller003", 70],
  ["Kit pesas ajustables 20kg para casa", "Deportes", "photo-1517836357463-d25dfeac3438", 20, 2, "seller008", 86],
  ["Drone mini con cámara HD 1080p plegable", "Electronica", "photo-1473968512647-3e447244af8f", 25, 5, "seller005", 104],
  ["Silla gamer ergonómica con soporte lumbar", "Hogar", "photo-1598550476439-6847785fcea6", 25, 5, "seller005", 124],
  ["Plancha de cabello profesional cerámica", "Moda y Ropa", "photo-1522338242992-e1a54906a8da", 10, 1, "seller007", 146],
  ["Cámara de seguridad WiFi 360° visión nocturna", "Electronica", "photo-1558002038-1055907df827", 14, 1, "seller003", 170],
  ["Licuadora portátil USB para jugos y batidos", "Hogar", "photo-1570222094114-d054a817e56b", 8, 1, "seller006", 196],
  ["Reloj automático acero inoxidable 42mm", "Joyas y Relojes", "photo-1524805444758-089113d48a6d", 35, 5, "seller002", 224],
  ["Mochila antirrobo con puerto USB", "Moda y Ropa", "photo-1553062407-98eeb64c6a62", 9, 1, "seller001", 254],
  ["Teclado mecánico retroiluminado RGB", "Electronica", "photo-1587829741301-dc798b83add3", 16, 2, "seller005", 286],
  ["Balón de fútbol tamaño 5 profesional", "Deportes", "photo-1614632537190-23e4146777db", 7, 1, "seller008", 320],
];

async function esAdmin(uid: string): Promise<boolean> {
  const snap = await db.doc(`${COLLECTIONS.USERS}/${uid}`).get();
  return snap.data()?.role === "admin";
}

export const manageDemoAuctions = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 120, memory: "256MB" })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Debes estar autenticado");
    }
    if (!(await esAdmin(context.auth.uid))) {
      throw new functions.https.HttpsError("permission-denied", "Solo un administrador");
    }

    const { action } = (data ?? {}) as { action?: "seed" | "purge" };

    if (action === "purge") {
      // Solo lo marcado como demo. Una subasta real no puede caer aquí.
      const demo = await db.collection(COLLECTIONS.AUCTIONS).where("isDemo", "==", true).get();

      // Las que llegaron a venderse tienen una orden apuntándoles. Borrarlas
      // dejaría esa orden señalando a una subasta que ya no existe, y la
      // pantalla del pedido sin nada que mostrar. Se quedan.
      const borrables = demo.docs.filter((d) => !d.data().orderId);
      const conVenta = demo.size - borrables.length;

      let borradas = 0;
      // En lotes de 400: el límite de un batch de Firestore es 500
      for (let i = 0; i < borrables.length; i += 400) {
        const lote = db.batch();
        for (const d of borrables.slice(i, i + 400)) { lote.delete(d.ref); borradas++; }
        await lote.commit();
      }
      functions.logger.info("Demo purgada", { borradas, conVenta, por: context.auth.uid });
      return { action: "purge", borradas, conVenta };
    }

    if (action !== "seed") {
      throw new functions.https.HttpsError("invalid-argument", 'action debe ser "seed" o "purge"');
    }

    // Los vendedores demo tienen que existir; si no, las subastas quedan
    // huérfanas y el perfil del vendedor sale vacío.
    const vendedores = [...new Set(CATALOGO.map(c => c[5]))];
    const perfiles = await db.getAll(...vendedores.map(v => db.doc(`${COLLECTIONS.USERS}/${v}`)));
    const nombreDe: Record<string, string> = {};
    const faltantes: string[] = [];
    perfiles.forEach((p, i) => {
      if (p.exists) nombreDe[vendedores[i]] = (p.data()?.displayName as string) ?? vendedores[i];
      else faltantes.push(vendedores[i]);
    });
    if (faltantes.length) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Faltan estos vendedores en /users: ${faltantes.join(", ")}`
      );
    }

    const ahora = Timestamp.now();
    const lote = db.batch();

    // Las que ya se vendieron no se tocan: reescribirlas las devolvería a
    // "active" con winnerId en null, y su orden quedaría apuntando a una
    // subasta que dice que nunca se vendió.
    const refs = CATALOGO.map((_, i) =>
      db.doc(`${COLLECTIONS.AUCTIONS}/demo_${String(i).padStart(2, "0")}`)
    );
    const existentes = await db.getAll(...refs);
    const vendidas = new Set(
      existentes.filter((d) => d.exists && d.data()?.orderId).map((d) => d.id)
    );

    // Ids fijos: sembrar dos veces reescribe las mismas 16 y les renueva el
    // reloj, en vez de apilar otra tanda. Antes el id llevaba un prefijo
    // distinto en cada corrida "para no sobreescribir", y el resultado fue
    // un catálogo con 120 subastas: los mismos 16 productos repetidos siete
    // veces. Volver a apretar el botón ahora significa "refrescá la demo",
    // que es lo que uno espera que haga.
    CATALOGO.forEach(([title, category, foto, precio, incremento, sellerId, horas], i) => {
      const ref = refs[i];
      if (vendidas.has(ref.id)) return;
      const url = `https://images.unsplash.com/${foto}?w=600&q=80`;
      lote.set(ref, {
        mode: "standalone",
        showId: null,
        title,
        description: "",
        category,
        imageURL: url,
        imageURLs: [url],
        sellerId,
        sellerName: nombreDe[sellerId],
        startingPriceUsd: precio,
        currentBidUsd: precio,
        minIncrementUsd: incremento,
        status: "active",
        endsAt: Timestamp.fromMillis(ahora.toMillis() + horas * 3600_000),
        bidsCount: 0,
        currentBidderId: null,
        currentBidderName: null,
        winnerId: null,
        orderId: null,
        sortOrder: null,
        isDemo: true,
        createdAt: ahora,
        updatedAt: ahora,
      });
    });

    await lote.commit();
    const creadas = CATALOGO.length - vendidas.size;
    functions.logger.info("Demo sembrada", { creadas, respetadas: vendidas.size, por: context.auth.uid });
    return { action: "seed", creadas, respetadas: vendidas.size };
  });
