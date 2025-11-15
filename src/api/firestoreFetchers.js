// src/api/firestoreFetchers.js
import { db } from "@/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";

/* ---------------------------------------------
   🔹 1) Publicaciones destacadas
--------------------------------------------- */
export async function fetchFeaturedPublications() {
  const colRef = collection(db, "publications");

  try {
    // principal: status active + featured
    const q1 = query(
      colRef,
      where("status", "==", "active"),
      where("featured", "==", true),
      orderBy("created_date", "desc"),
      limit(6)
    );

    const snap = await getDocs(q1);
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (rows.length > 0) return rows;
  } catch (e) {
    console.warn(
      "[fetchFeaturedPublications] índice faltante, usando fallback:",
      e?.code,
      e?.message
    );
  }

  // fallback
  try {
    const q2 = query(
      colRef,
      where("status", "==", "active"),
      where("featured", "==", true)
    );

    const snap2 = await getDocs(q2);
    const rows2 = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));

    rows2.sort(
      (a, b) =>
        new Date(b.created_date || 0) - new Date(a.created_date || 0)
    );

    return rows2.slice(0, 6);
  } catch (e) {
    console.error("[fetchFeaturedPublications] error final:", e);
    return [];
  }
}

/* ---------------------------------------------
   🔹 2) Restaurantes destacados
--------------------------------------------- */
export async function fetchFeaturedRestaurants() {
  const colRef = collection(db, "restaurants");

  try {
    const q1 = query(
      colRef,
      where("status", "==", "active"),
      where("featured", "==", true),
      orderBy("created_at", "desc"),
      limit(8)
    );

    const snap = await getDocs(q1);
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (rows.length > 0) return rows;
  } catch (e) {
    console.warn(
      "[fetchFeaturedRestaurants] índice faltante, usando fallback:",
      e?.code,
      e?.message
    );
  }

  // fallback
  try {
    const q2 = query(
      colRef,
      where("status", "==", "active"),
      where("featured", "==", true)
    );

    const snap2 = await getDocs(q2);
    const rows2 = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));

    rows2.sort(
      (a, b) =>
        new Date(b.created_at || 0) - new Date(a.created_at || 0)
    );

    return rows2.slice(0, 8);
  } catch (e) {
    console.error("[fetchFeaturedRestaurants] error final:", e);
    return [];
  }
}
