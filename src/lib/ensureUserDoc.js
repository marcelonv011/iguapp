// src/lib/ensureUserDoc.js
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase";

/**
 * Crea /users/{uid} si no existe. Si existe, completa campos faltantes
 * sin pisar rol ni datos ya cargados por el admin.
 */
export async function ensureUserDoc(firebaseUser) {
  if (!firebaseUser) return;

  const { uid, email, displayName, phoneNumber, photoURL } = firebaseUser;
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  const base = {
    email: email ?? null,
    full_name: displayName ?? "",
    phone_number: phoneNumber ?? "", // se guarda si el provider lo trae
    photo_url: photoURL ?? "",
    role_type: "usuario",
  };

  if (!snap.exists()) {
    await setDoc(ref, {
      ...base,
      created_at: serverTimestamp(),
      last_login_at: serverTimestamp(),
    });
  } else {
    const existing = snap.data() || {};
    await setDoc(
      ref,
      {
        // Solo completa lo que falte, no pisa lo que ya cargaste
        email: existing.email || base.email,
        full_name: existing.full_name || base.full_name,
        phone_number: existing.phone_number || base.phone_number,
        photo_url: existing.photo_url || base.photo_url,
        role_type: existing.role_type || base.role_type,
        last_login_at: serverTimestamp(),
      },
      { merge: true }
    );
  }
}
