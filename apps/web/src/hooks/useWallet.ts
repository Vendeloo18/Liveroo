"use client";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuthStore } from "../store/authStore";

// Saldo de la billetera del usuario y si la beta exige saldo para pujar.
// Un solo lugar del que leen la subasta suelta y el show en vivo, para que
// el "Recargar" aparezca justo en el punto de puja.
//
// - total     = balanceUsd (todo lo que tiene)
// - retenido  = heldUsd (comprometido en pujas donde va ganando)
// - disponible = lo que puede comprometer en una puja nueva
// - exigeSaldo = config/wallet.biddingRequiresBalance (modo beta)
export function useWallet() {
  const { profile } = useAuthStore();
  const [total, setTotal] = useState(0);
  const [retenido, setRetenido] = useState(0);
  const [exigeSaldo, setExigeSaldo] = useState(false);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    if (!profile) { setTotal(0); setRetenido(0); setCargado(true); return; }
    setCargado(false);
    return onSnapshot(
      doc(db, "wallets", profile.uid),
      s => { const d = s.data(); setTotal(d?.balanceUsd ?? 0); setRetenido(d?.heldUsd ?? 0); setCargado(true); },
      () => { setTotal(0); setRetenido(0); setCargado(true); },
    );
  }, [profile?.uid]);

  useEffect(() => {
    return onSnapshot(
      doc(db, "config", "wallet"),
      s => setExigeSaldo(s.data()?.biddingRequiresBalance === true),
      () => setExigeSaldo(false),
    );
  }, []);

  const disponible = Math.max(0, Math.round((total - retenido) * 100) / 100);
  return { total, retenido, disponible, exigeSaldo, cargado };
}
