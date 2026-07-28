// =============================================================
// Pruebas de las reglas de Firestore
// =============================================================
// Corren contra el emulador. Cada prueba afirma algo que la app
// necesita poder hacer, o algo que un atacante NO debe poder hacer.
//
//   pnpm --filter @liveroo/rules-tests test
// =============================================================

import { test, describe, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, where,
} from "firebase/firestore";

const here = dirname(fileURLToPath(import.meta.url));
const RULES = readFileSync(resolve(here, "../../firestore.rules"), "utf8");

const BUYER = "buyer_juan";
const OTHER_BUYER = "buyer_maria";
const SELLER = "seller_carlos";
const UNAPPROVED = "seller_pendiente";
const ADMIN = "admin_alfred";

let testEnv;

// Contextos autenticados
const as = (uid) => testEnv.authenticatedContext(uid).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();

// node:test no garantiza que un `before` de raíz corra antes de los
// `beforeEach` de los describe anidados, así que inicializamos perezoso.
async function ensureEnv() {
  if (!testEnv) {
    testEnv = await initializeTestEnvironment({
      projectId: "demo-liveroo",
      firestore: { rules: RULES },
    });
  }
  return testEnv;
}

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await ensureEnv();
  await testEnv.clearFirestore();

  // Sembramos el estado base saltándose las reglas (como haría el motor)
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    await setDoc(doc(db, "users", BUYER), {
      uid: BUYER, email: "juan@correo.com", phone: "0414-1234567",
      displayName: "Juan", role: "buyer", sellerStatus: "none",
    });
    await setDoc(doc(db, "users", OTHER_BUYER), {
      uid: OTHER_BUYER, email: "maria@correo.com", displayName: "María",
      role: "buyer", sellerStatus: "none",
    });
    await setDoc(doc(db, "users", SELLER), {
      uid: SELLER, email: "carlos@correo.com", displayName: "CarlosVE",
      role: "seller", sellerStatus: "approved",
    });
    await setDoc(doc(db, "users", UNAPPROVED), {
      uid: UNAPPROVED, email: "pendiente@correo.com", displayName: "Pendiente",
      role: "seller", sellerStatus: "pending",
    });
    await setDoc(doc(db, "users", ADMIN), {
      uid: ADMIN, email: "alfred@liveroo.com", displayName: "Alfred",
      role: "admin", sellerStatus: "approved",
    });

    await setDoc(doc(db, "publicProfiles", SELLER), {
      uid: SELLER, displayName: "CarlosVE", role: "seller", ratingAvg: 4.7,
    });

    // Subasta suelta, activa, con una puja encima
    await setDoc(doc(db, "auctions", "sub1"), {
      id: "sub1", title: "Tenis Nike", sellerId: SELLER, sellerName: "CarlosVE",
      mode: "standalone", showId: null, status: "active",
      startingPriceUsd: 20, currentBidUsd: 35, minIncrementUsd: 1,
      currentBidderId: OTHER_BUYER, currentBidderName: "María", bidsCount: 3,
      endsAt: new Date(Date.now() + 3600_000),
      winnerId: null, orderId: null,
    });

    // Subasta en cola, sin pujas (el vendedor todavía puede editarla)
    await setDoc(doc(db, "auctions", "sub2"), {
      id: "sub2", title: "Audífonos", sellerId: SELLER, sellerName: "CarlosVE",
      mode: "live", showId: "show1", status: "waiting", sortOrder: 1,
      startingPriceUsd: 10, currentBidUsd: 10, minIncrementUsd: 1,
      currentBidderId: null, bidsCount: 0, winnerId: null, orderId: null,
    });

    await setDoc(doc(db, "shows", "show1"), {
      id: "show1", title: "Show de Carlos", sellerId: SELLER,
      status: "scheduled", viewerCount: 0,
    });
    await setDoc(doc(db, "shows", "showLive"), {
      id: "showLive", title: "En vivo", sellerId: SELLER,
      status: "live", viewerCount: 12,
    });

    await setDoc(doc(db, "orders", "orden1"), {
      id: "orden1", auctionId: "sub1", buyerId: BUYER, sellerId: SELLER,
      bidAmountUsd: 35, commissionUsd: 3.5, status: "pending_payment",
    });
  });
});

// =============================================================

describe("Datos privados de usuarios", () => {
  test("un anónimo no puede leer /users", async () => {
    await assertFails(getDoc(doc(anon(), "users", BUYER)));
  });

  test("un usuario no puede leer el perfil privado de otro", async () => {
    await assertFails(getDoc(doc(as(OTHER_BUYER), "users", BUYER)));
  });

  test("cada quien lee su propio perfil", async () => {
    await assertSucceeds(getDoc(doc(as(BUYER), "users", BUYER)));
  });

  test("nadie puede listar todos los usuarios y bajarse los correos", async () => {
    await assertFails(getDocs(collection(as(BUYER), "users")));
  });

  test("el admin sí puede listar usuarios", async () => {
    await assertSucceeds(getDocs(collection(as(ADMIN), "users")));
  });

  test("nadie se asciende a admin solo", async () => {
    await assertFails(updateDoc(doc(as(BUYER), "users", BUYER), { role: "admin" }));
  });

  test("nadie se auto-aprueba como vendedor", async () => {
    await assertFails(
      updateDoc(doc(as(BUYER), "users", BUYER), { sellerStatus: "approved" })
    );
  });

  test("pero sí puede cambiar su nombre y teléfono", async () => {
    await assertSucceeds(
      updateDoc(doc(as(BUYER), "users", BUYER), { displayName: "Juancho", phone: "0424-9999999" })
    );
  });
});

describe("Perfil público", () => {
  test("cualquiera lo lee, sin login", async () => {
    await assertSucceeds(getDoc(doc(anon(), "publicProfiles", SELLER)));
  });

  test("nadie lo escribe desde el cliente", async () => {
    await assertFails(
      updateDoc(doc(as(SELLER), "publicProfiles", SELLER), { ratingAvg: 5.0 })
    );
  });
});

describe("Subastas: el precio no se toca desde el cliente", () => {
  test("EL AGUJERO ORIGINAL — un comprador no puede fijarse a sí mismo como ganador por $0.01", async () => {
    await assertFails(
      updateDoc(doc(as(BUYER), "auctions", "sub1"), {
        currentBidUsd: 0.01,
        currentBidderId: BUYER,
        currentBidderName: "Juan",
      })
    );
  });

  test("ni el propio vendedor puede mover el precio de una subasta con pujas", async () => {
    await assertFails(
      updateDoc(doc(as(SELLER), "auctions", "sub1"), { currentBidUsd: 999 })
    );
  });

  test("nadie declara un ganador a mano", async () => {
    await assertFails(
      updateDoc(doc(as(BUYER), "auctions", "sub1"), { status: "sold", winnerId: BUYER })
    );
  });

  test("nadie borra una subasta con pujas", async () => {
    await assertFails(deleteDoc(doc(as(SELLER), "auctions", "sub1")));
  });

  test("el vendedor sí corrige el título mientras nadie haya pujado", async () => {
    await assertSucceeds(
      updateDoc(doc(as(SELLER), "auctions", "sub2"), { title: "Audífonos Sony" })
    );
  });

  test("las subastas son de lectura pública", async () => {
    await assertSucceeds(getDoc(doc(anon(), "auctions", "sub1")));
  });
});

describe("Subastas: creación", () => {
  const nueva = (over = {}) => ({
    title: "Reloj", sellerId: SELLER, sellerName: "CarlosVE",
    mode: "standalone", showId: null, status: "active",
    startingPriceUsd: 15, currentBidUsd: 15, minIncrementUsd: 1,
    currentBidderId: null, bidsCount: 0, winnerId: null, orderId: null,
    endsAt: new Date(Date.now() + 86400_000),
    ...over,
  });

  test("un vendedor aprobado publica su subasta", async () => {
    await assertSucceeds(addDoc(collection(as(SELLER), "auctions"), nueva()));
  });

  test("un comprador no puede publicar subastas", async () => {
    await assertFails(
      addDoc(collection(as(BUYER), "auctions"), nueva({ sellerId: BUYER }))
    );
  });

  test("un vendedor sin aprobar tampoco", async () => {
    await assertFails(
      addDoc(collection(as(UNAPPROVED), "auctions"), nueva({ sellerId: UNAPPROVED }))
    );
  });

  test("no se puede publicar a nombre de otro vendedor", async () => {
    await assertFails(addDoc(collection(as(SELLER), "auctions"), nueva({ sellerId: ADMIN })));
  });

  test("no se puede nacer con pujas infladas", async () => {
    await assertFails(addDoc(collection(as(SELLER), "auctions"), nueva({ bidsCount: 50 })));
  });

  test("no se puede nacer con el precio actual por encima del inicial", async () => {
    await assertFails(
      addDoc(collection(as(SELLER), "auctions"), nueva({ currentBidUsd: 500 }))
    );
  });

  test("no se puede nacer ya vencida", async () => {
    await assertFails(
      addDoc(collection(as(SELLER), "auctions"), nueva({ endsAt: new Date(Date.now() - 1000) }))
    );
  });
});

describe("Pujas: solo por la puerta de /pendingBids", () => {
  const puja = (over = {}) => ({
    auctionId: "sub1", bidderId: BUYER, amountUsd: 40,
    status: "pending", submittedAt: new Date(),
    ...over,
  });

  test("un usuario autenticado puede pedir una puja", async () => {
    await assertSucceeds(addDoc(collection(as(BUYER), "pendingBids"), puja()));
  });

  test("un anónimo no puja", async () => {
    await assertFails(addDoc(collection(anon(), "pendingBids"), puja()));
  });

  test("nadie puja en nombre de otro", async () => {
    await assertFails(
      addDoc(collection(as(BUYER), "pendingBids"), puja({ bidderId: OTHER_BUYER }))
    );
  });

  test("no se puede crear una puja ya marcada como aprobada", async () => {
    await assertFails(
      addDoc(collection(as(BUYER), "pendingBids"), puja({ status: "processed" }))
    );
  });

  test("no se puede pujar un monto negativo", async () => {
    await assertFails(addDoc(collection(as(BUYER), "pendingBids"), puja({ amountUsd: -5 })));
  });

  test("una vez creada, nadie la edita para colarse", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "pendingBids", "p1"), puja());
    });
    await assertFails(updateDoc(doc(as(BUYER), "pendingBids", "p1"), { amountUsd: 999 }));
    await assertFails(deleteDoc(doc(as(BUYER), "pendingBids", "p1")));
  });

  test("nadie lee las pujas pendientes de otro", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "pendingBids", "p1"), puja());
    });
    await assertFails(getDoc(doc(as(OTHER_BUYER), "pendingBids", "p1")));
  });
});

describe("Shows", () => {
  test("EL ATAJO DEL VENDEDOR — ya no puede ponerse en vivo escribiendo status a mano", async () => {
    await assertFails(
      updateDoc(doc(as(SELLER), "shows", "show1"), { status: "live" })
    );
  });

  test("tampoco puede terminarlo a mano", async () => {
    await assertFails(
      updateDoc(doc(as(SELLER), "shows", "showLive"), { status: "ended" })
    );
  });

  test("pero sí edita el título y la portada", async () => {
    await assertSucceeds(
      updateDoc(doc(as(SELLER), "shows", "show1"), { title: "Show renovado" })
    );
  });

  test("otro vendedor no toca shows ajenos", async () => {
    await assertFails(
      updateDoc(doc(as(UNAPPROVED), "shows", "show1"), { title: "Secuestrado" })
    );
  });

  test("un espectador suma 1 al contador de audiencia", async () => {
    await assertSucceeds(
      updateDoc(doc(as(BUYER), "shows", "showLive"), { viewerCount: 13 })
    );
  });

  test("pero no puede inflar el contador de golpe", async () => {
    await assertFails(
      updateDoc(doc(as(BUYER), "shows", "showLive"), { viewerCount: 99999 })
    );
  });

  test("ni colar otro campo junto al contador", async () => {
    await assertFails(
      updateDoc(doc(as(BUYER), "shows", "showLive"), { viewerCount: 13, status: "ended" })
    );
  });
});

describe("Chat en vivo", () => {
  const msg = (over = {}) => ({
    authorId: BUYER, authorName: "Juan", type: "chat",
    text: "¡Hola!", createdAt: new Date(), ...over,
  });

  test("se puede escribir en un show en vivo", async () => {
    await assertSucceeds(
      addDoc(collection(as(BUYER), "shows", "showLive", "messages"), msg())
    );
  });

  test("no se puede escribir en un show que no está en vivo", async () => {
    await assertFails(
      addDoc(collection(as(BUYER), "shows", "show1", "messages"), msg())
    );
  });

  test("nadie escribe suplantando a otro", async () => {
    await assertFails(
      addDoc(collection(as(BUYER), "shows", "showLive", "messages"), msg({ authorId: ADMIN }))
    );
  });

  test("nadie se hace pasar por el sistema para anunciar un ganador falso", async () => {
    await assertFails(
      addDoc(collection(as(BUYER), "shows", "showLive", "messages"),
        msg({ type: "auction_won", text: "🏆 ¡Juan ganó!" }))
    );
  });

  test("no se aceptan mensajes gigantes", async () => {
    await assertFails(
      addDoc(collection(as(BUYER), "shows", "showLive", "messages"),
        msg({ text: "x".repeat(301) }))
    );
  });
});

describe("Órdenes", () => {
  test("nadie crea órdenes desde el cliente", async () => {
    await assertFails(
      setDoc(doc(as(BUYER), "orders", "falsa"), {
        buyerId: BUYER, sellerId: SELLER, bidAmountUsd: 1, status: "pending_payment",
      })
    );
  });

  test("el comprador ve su orden", async () => {
    await assertSucceeds(getDoc(doc(as(BUYER), "orders", "orden1")));
  });

  test("un tercero no ve la orden ajena", async () => {
    await assertFails(getDoc(doc(as(OTHER_BUYER), "orders", "orden1")));
  });

  test("una consulta sin filtrar por dueño falla entera", async () => {
    await assertFails(getDocs(collection(as(BUYER), "orders")));
  });

  test("filtrando por su propio uid sí funciona", async () => {
    await assertSucceeds(
      getDocs(query(collection(as(BUYER), "orders"), where("buyerId", "==", BUYER)))
    );
  });

  test("el vendedor confirma el pago", async () => {
    await assertSucceeds(
      updateDoc(doc(as(SELLER), "orders", "orden1"), { status: "payment_confirmed" })
    );
  });

  test("pero no puede rebajarse la comisión", async () => {
    await assertFails(
      updateDoc(doc(as(SELLER), "orders", "orden1"), { commissionUsd: 0 })
    );
  });

  test("el comprador no cambia el monto que debe pagar", async () => {
    await assertFails(
      updateDoc(doc(as(BUYER), "orders", "orden1"), { bidAmountUsd: 1 })
    );
  });

  test("nadie borra órdenes", async () => {
    await assertFails(deleteDoc(doc(as(ADMIN), "orders", "orden1")));
  });
});

describe("Configuración y tasa de cambio", () => {
  test("la tasa es pública", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "exchangeRates", "current"), { usdToBs: 40 });
    });
    await assertSucceeds(getDoc(doc(anon(), "exchangeRates", "current")));
  });

  test("nadie la cambia desde el cliente, ni el admin", async () => {
    await assertFails(
      setDoc(doc(as(ADMIN), "exchangeRates", "current"), { usdToBs: 1 })
    );
  });

  test("nadie se baja la comisión de la plataforma", async () => {
    await assertFails(
      setDoc(doc(as(SELLER), "config", "commission"), { platformFeePct: 0 })
    );
  });
});

describe("Colecciones sin regla", () => {
  test("una colección nueva nace cerrada", async () => {
    await assertFails(setDoc(doc(as(ADMIN), "loQueSea", "x"), { a: 1 }));
    await assertFails(getDoc(doc(anon(), "loQueSea", "x")));
  });

  test("la billetera está cerrada a escritura", async () => {
    await assertFails(
      setDoc(doc(as(BUYER), "walletTransactions", "t1"), { userId: BUYER, amountUsd: 10000 })
    );
  });

  test("nadie se recarga el saldo a mano", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "wallets", BUYER), { balanceUsd: 0 });
    });
    await assertSucceeds(getDoc(doc(as(BUYER), "wallets", BUYER)));
    await assertFails(updateDoc(doc(as(BUYER), "wallets", BUYER), { balanceUsd: 99999 }));
    await assertFails(getDoc(doc(as(OTHER_BUYER), "wallets", BUYER)));
  });
});
