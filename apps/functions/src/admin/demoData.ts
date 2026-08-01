// =============================================================
// CLOUD FUNCTION: manageDemoAuctions (callable, solo admin)
// =============================================================
// Herramienta de PRE-LANZAMIENTO para llenar y vaciar el catálogo de
// demostración: vendedores ficticios + sus productos, para que la app no
// se vea vacía mientras llegan vendedores reales.
//
// "seed" hace dos cosas:
//   1. Crea/actualiza los vendedores demo (perfil + perfil público) con
//      nombre de tienda, categoría, ciudad y foto.
//   2. Crea/actualiza sus subastas con foto, precio de salida e incremento.
//
// Datos HONESTOS a propósito: cero pujas inventadas, sin líder, y cero
// calificaciones falsas (ratingCount 0). El atractivo sale de las fotos y
// los productos, no de números fabricados. Todo lleva isDemo: true, así
// que "purgar" es exacto y no toca nada real por accidente.
//
// Cuando haya vendedores reales, esto se borra junto con la sección del
// panel que lo llama.
// =============================================================

import * as functions from "firebase-functions";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../firebase";
import { COLLECTIONS } from "../constants";

const foto = (id: string, w = 600) => `https://images.unsplash.com/${id}?w=${w}&q=80`;
const avatar = (id: string) => `https://images.unsplash.com/${id}?w=200&h=200&fit=crop&q=80`;

/** id, nombre de tienda, categoría, ciudad, foto de avatar (Unsplash) */
const VENDEDORES: [string, string, string, string, string][] = [
  ["seller001", "Tecno Carlos", "Electronica", "Caracas", "photo-1587829741301-dc798b83add3"],
  ["seller002", "María Joyas", "Joyas y Relojes", "Valencia", "photo-1515562141207-7a88fb7ce338"],
  ["seller003", "Tech Venezuela", "Electronica", "Maracaibo", "photo-1496181133206-80ce9b88a853"],
  ["seller004", "Moda Caracas", "Moda y Ropa", "Caracas", "photo-1548036328-c9fa89d128fa"],
  ["seller005", "Gaming VE", "Electronica", "Maracay", "photo-1598550476439-6847785fcea6"],
  ["seller006", "Hogar VIP", "Hogar", "Barquisimeto", "photo-1570222094114-d054a817e56b"],
  ["seller007", "Belleza VE", "Moda y Ropa", "Caracas", "photo-1596462502278-27bfdc403348"],
  ["seller008", "Deportes VE", "Deportes", "Valencia", "photo-1571019613454-1cb2f99b2d8b"],
  ["seller009", "Sneakers Premium", "Calzado", "Maracaibo", "photo-1595950653106-6c9ebd614d3a"],
  ["seller010", "Relojería VE", "Joyas y Relojes", "Caracas", "photo-1611652022419-a9419f74343d"],
  ["seller011", "Colecciones Vintage", "Colecciones", "Mérida", "photo-1526170375885-4d8ecf77b99f"],
  ["seller012", "Arte Vzla", "Arte", "Caracas", "photo-1547891654-e66ed7ebb968"],
  ["seller013", "Moto Center", "Autos y Motos", "Ciudad Guayana", "photo-1558981806-ec527fa84c39"],
  ["seller014", "Cocina Total", "Hogar", "San Cristóbal", "photo-1585515320310-259814833e62"],
  ["seller015", "Audio Pro", "Electronica", "Puerto La Cruz", "photo-1589003077984-894e133dabab"],
  ["seller016", "Ciclismo VE", "Deportes", "Mérida", "photo-1485965120184-e220f721d03e"],
];

/** title, categoría, foto de Unsplash, precio, incremento, vendedor, horas hasta el cierre.
 *  Precios de salida CREÍBLES: un poco por debajo del valor real de mercado,
 *  para que la vitrina se sienta de verdad (antes un iPhone salía en $15). */
const CATALOGO: [string, string, string, number, number, string, number][] = [
  ["PlayStation 5 Slim edición estándar", "Electronica", "photo-1606813907291-d86efa9b94db", 260, 10, "seller005", 8],
  ["Control inalámbrico para PlayStation", "Electronica", "photo-1592840496694-26d035b52b48", 30, 2, "seller005", 14],
  ["Nintendo Switch OLED blanca", "Electronica", "photo-1578303512597-81e6cc155b3e", 180, 5, "seller005", 22],
  ["iPhone 13 128GB liberado", "Electronica", "photo-1592750475338-74b7b21085ab", 230, 10, "seller003", 30],
  ["AirPods Pro 2da generación", "Electronica", "photo-1600294037681-c80b4cb5b434", 110, 5, "seller003", 40],
  ["MacBook Air M1 13 pulgadas", "Electronica", "photo-1496181133206-80ce9b88a853", 340, 10, "seller003", 52],
  ["Teclado inalámbrico slim", "Electronica", "photo-1587829741301-dc798b83add3", 15, 1, "seller001", 12],
  ["Mouse gamer 16000 DPI", "Electronica", "photo-1527814050087-3793815479db", 12, 1, "seller001", 18],
  ["PC gamer torre con luces RGB", "Electronica", "photo-1587202372775-e229f172b9d7", 380, 10, "seller001", 64],
  ["Audífonos Bluetooth con cancelación de ruido", "Electronica", "photo-1505740420928-5e560c06d30e", 32, 2, "seller015", 20],
  ["Parlante JBL portátil resistente al agua", "Electronica", "photo-1589003077984-894e133dabab", 45, 2, "seller015", 36],
  ["Smartwatch con monitor cardíaco", "Electronica", "photo-1546868871-7041f2a55e12", 22, 1, "seller015", 48],
  ["Drone con cámara 4K plegable", "Electronica", "photo-1473968512647-3e447244af8f", 130, 5, "seller003", 76],
  ["Termostato inteligente WiFi", "Hogar", "photo-1558002038-1055907df827", 35, 2, "seller006", 90],
  ["Cámara Canon con lente 50mm", "Electronica", "photo-1516035069371-29a1b244cc32", 240, 10, "seller003", 16],
  ["Cartera de cuero para dama", "Moda y Ropa", "photo-1548036328-c9fa89d128fa", 18, 1, "seller004", 28],
  ["Mochila antirrobo con puerto USB", "Moda y Ropa", "photo-1553062407-98eeb64c6a62", 15, 1, "seller004", 44],
  ["Set de maquillaje profesional 24 piezas", "Moda y Ropa", "photo-1596462502278-27bfdc403348", 20, 1, "seller007", 10],
  ["Set de brochas de maquillaje profesional", "Moda y Ropa", "photo-1522338242992-e1a54906a8da", 10, 1, "seller007", 26],
  ["Tenis Nike Air Max rojos talla 42", "Calzado", "photo-1542291026-7eec264c27ff", 65, 5, "seller009", 24],
  ["Sneakers urbanas edición limitada", "Calzado", "photo-1595950653106-6c9ebd614d3a", 55, 2, "seller009", 42],
  ["Tenis Nike Air Max blancos talla 41", "Calzado", "photo-1600185365483-26d7a4cc7519", 70, 5, "seller009", 70],
  ["Reloj automático acero inoxidable 42mm", "Joyas y Relojes", "photo-1524805444758-089113d48a6d", 70, 5, "seller002", 32],
  ["Anillo de compromiso con circonia", "Joyas y Relojes", "photo-1605100804763-247f67b3557e", 30, 2, "seller002", 58],
  ["Collar elegante chapado en oro", "Joyas y Relojes", "photo-1611652022419-a9419f74343d", 45, 2, "seller010", 84],
  ["Monitor gamer curvo 27 pulgadas", "Electronica", "photo-1598550476439-6847785fcea6", 110, 5, "seller005", 34],
  ["Café en grano premium 1kg", "Comida", "photo-1517668808822-9ebb02f2a0e6", 7, 1, "seller014", 60],
  ["Jarra de vidrio para jugos", "Hogar", "photo-1585515320310-259814833e62", 5, 1, "seller014", 46],
  ["Cafetera con molino integrado", "Hogar", "photo-1570222094114-d054a817e56b", 50, 2, "seller014", 100],
  ["Leggings deportivos de alto impacto", "Deportes", "photo-1571019613454-1cb2f99b2d8b", 8, 1, "seller008", 38],
  ["Kit de mancuernas ajustables 20kg", "Deportes", "photo-1534438327276-14e5300c3a48", 40, 2, "seller008", 120],
  ["Balón de fútbol profesional #5", "Deportes", "photo-1614632537190-23e4146777db", 12, 1, "seller008", 54],
  ["Cámara instantánea vintage", "Colecciones", "photo-1526170375885-4d8ecf77b99f", 40, 2, "seller011", 96],
  ["Lentes de sol polarizados Ray-Ban", "Moda y Ropa", "photo-1572635196237-14b3f281503f", 55, 2, "seller004", 110],
  ["Casco de moto certificado DOT", "Autos y Motos", "photo-1558981806-ec527fa84c39", 32, 2, "seller013", 140],
  ["Consola Xbox Series S", "Electronica", "photo-1605901309584-818e25960a8f", 140, 5, "seller005", 66],
  ["iPhone 12 64GB excelente estado", "Electronica", "photo-1511707171634-5f897ff02aa9", 150, 5, "seller003", 82],
  ["Laptop ultradelgada 13 pulgadas", "Electronica", "photo-1541807084-5c52b6b3adef", 240, 10, "seller003", 128],
  ["Teclado inalámbrico compacto", "Electronica", "photo-1541140532154-b024d705b90a", 12, 1, "seller001", 106],
  ["Smartwatch pantalla AMOLED", "Electronica", "photo-1579586337278-3befd40fd17a", 28, 2, "seller015", 116],
  ["Parlante Bluetooth de sonido envolvente", "Electronica", "photo-1558537348-c0f8e733989d", 22, 2, "seller015", 132],
  ["Audífonos inalámbricos over-ear", "Electronica", "photo-1583394838336-acd977736f90", 18, 1, "seller015", 148],
  ["Cámara mirrorless compacta", "Electronica", "photo-1452780212940-6f5c0d14d848", 280, 10, "seller003", 96],
  ["Bolso de cuero rojo artesanal", "Moda y Ropa", "photo-1584917865442-de89df76afd3", 22, 1, "seller004", 74],
  ["Tenis deportivos verde neón talla 40", "Calzado", "photo-1606107557195-0e29a4b5b4aa", 40, 2, "seller009", 92],
  ["Reloj de pared minimalista", "Hogar", "photo-1434056886845-dac89ffe9b56", 15, 1, "seller006", 118],
  ["Bicicleta de ruta en aluminio", "Deportes", "photo-1485965120184-e220f721d03e", 220, 10, "seller016", 172],
  ["Cuadro de arte urbano", "Arte", "photo-1547891654-e66ed7ebb968", 30, 2, "seller012", 152],
];

async function esAdmin(uid: string): Promise<boolean> {
  const snap = await db.doc(`${COLLECTIONS.USERS}/${uid}`).get();
  return snap.data()?.role === "admin";
}

// =============================================================
// Siembra/renueva la vitrina (compartida: callable + refresco programado)
// =============================================================
async function sembrarDemo(): Promise<{ vendedores: number; creadas: number; respetadas: number }> {
  const ahora = Timestamp.now();

  // ── 1. Vendedores: perfil privado + perfil público ──────────────
  // Se crean sin cuenta de Auth (no inician sesión): son perfiles de
  // vitrina que las subastas referencian. Calificaciones en 0: nunca
  // vendieron, y un rating inventado sería justo la clase de dato falso
  // que este proyecto no muestra.
  const loteV = db.batch();
  for (const [id, tienda, cat, ciudad, avatarId] of VENDEDORES) {
    const av = avatar(avatarId);
    const comun = {
      uid: id,
      displayName: tienda,
      username: id,
      shopName: tienda,
      sellerCat: cat,
      city: ciudad,
      avatar: av,
      role: "seller",
      sellerStatus: "approved",
      ratingAvg: 0,
      ratingCount: 0,
      totalSales: 0,
    };
    loteV.set(db.doc(`${COLLECTIONS.USERS}/${id}`), {
      ...comun,
      email: null,
      whatsapp: null,
      isDemo: true,
      updatedAt: ahora,
      createdAt: ahora,
    }, { merge: true });
    // El perfil público lleva solo la cara pública (misma lista blanca
    // que syncPublicProfile). Se escribe directo para que aparezca ya,
    // sin esperar al trigger.
    loteV.set(db.doc(`${COLLECTIONS.PUBLIC_PROFILES}/${id}`), {
      ...comun,
      updatedAt: ahora,
    }, { merge: true });
  }
  await loteV.commit();

  const nombreDe: Record<string, string> = Object.fromEntries(VENDEDORES.map((v) => [v[0], v[1]]));

  // ── 2. Subastas ─────────────────────────────────────────────────
  // Ids fijos: sembrar dos veces refresca las mismas y les renueva el
  // reloj, en vez de apilar otra tanda.
  const refs = CATALOGO.map((_, i) =>
    db.doc(`${COLLECTIONS.AUCTIONS}/demo_${String(i).padStart(2, "0")}`)
  );
  // Las ya vendidas o con puja no se tocan: reescribirlas las devolvería
  // a "active" con winnerId en null (orden huérfana) o borraría el líder
  // (retención colgada).
  const existentes = await db.getAll(...refs);
  const intocables = new Set(
    existentes
      .filter((d) => d.exists && (
        d.data()?.orderId
        || (d.data()?.status === "active" && d.data()?.currentBidderId)
      ))
      .map((d) => d.id)
  );

  const lote = db.batch();
  CATALOGO.forEach(([title, category, fotoId, precio, incremento, sellerId, horas], i) => {
    const ref = refs[i];
    if (intocables.has(ref.id)) return;
    const url = foto(fotoId);
    lote.set(ref, {
      mode: "standalone",
      showId: null,
      title,
      description: "",
      category,
      imageURL: url,
      imageURLs: [url],
      sellerId,
      sellerName: nombreDe[sellerId] ?? sellerId,
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
  const creadas = CATALOGO.length - intocables.size;
  return { vendedores: VENDEDORES.length, creadas, respetadas: intocables.size };
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

      // Las que llegaron a venderse tienen una orden apuntándoles, y las
      // que tienen un líder activo tienen su retención de saldo: borrarlas
      // dejaría la orden huérfana o la retención colgada para siempre.
      // Ambas se quedan; la retención se libera sola cuando la subasta
      // cierre por su reloj.
      const borrables = demo.docs.filter((d) => !d.data().orderId && !d.data().currentBidderId);
      const conVenta = demo.size - borrables.length;

      let borradas = 0;
      // En lotes de 400: el límite de un batch de Firestore es 500
      for (let i = 0; i < borrables.length; i += 400) {
        const lote = db.batch();
        for (const d of borrables.slice(i, i + 400)) { lote.delete(d.ref); borradas++; }
        await lote.commit();
      }
      // Los vendedores demo se dejan: no molestan y quedan referenciados por
      // las subastas que sí sobrevivieron (vendidas o con puja).
      // Apagar la bandera frena el refresco programado: purgar es purgar.
      await db.doc(`${COLLECTIONS.CONFIG}/demo`).set({ enabled: false, updatedAt: Timestamp.now() }, { merge: true });
      functions.logger.info("Demo purgada", { borradas, conVenta, por: context.auth.uid });
      return { action: "purge", borradas, conVenta };
    }

    if (action !== "seed") {
      throw new functions.https.HttpsError("invalid-argument", 'action debe ser "seed" o "purge"');
    }

    const r = await sembrarDemo();
    // Sembrar enciende la vitrina: el refresco programado la mantiene sola.
    await db.doc(`${COLLECTIONS.CONFIG}/demo`).set({ enabled: true, updatedAt: Timestamp.now() }, { merge: true });
    functions.logger.info("Demo sembrada", { ...r, por: context.auth.uid });
    return { action: "seed", ...r };
  });

// =============================================================
// Refresco programado: la vitrina se mantiene sola
// =============================================================
// Cada 3 horas renueva las subastas demo vencidas (con los precios y
// relojes del catálogo). Solo corre con la vitrina encendida
// (config/demo.enabled): purgar la apaga y este job no la resucita.

export const refreshDemoAuctions = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 120, memory: "256MB" })
  .pubsub.schedule("every 3 hours")
  .onRun(async () => {
    const flagSnap = await db.doc(`${COLLECTIONS.CONFIG}/demo`).get();
    let enabled = flagSnap.data()?.enabled === true;
    if (!flagSnap.exists) {
      // Bootstrap: la vitrina existía antes de esta bandera. Si hay demos
      // en la base, se considera encendida y la bandera queda escrita.
      const alguna = await db.collection(COLLECTIONS.AUCTIONS).where("isDemo", "==", true).limit(1).get();
      enabled = !alguna.empty;
      if (enabled) {
        await db.doc(`${COLLECTIONS.CONFIG}/demo`).set({ enabled: true, updatedAt: Timestamp.now() }, { merge: true });
      }
    }
    if (!enabled) return null;
    const r = await sembrarDemo();
    functions.logger.info("Demo refrescada (programado)", r);
    return null;
  });
