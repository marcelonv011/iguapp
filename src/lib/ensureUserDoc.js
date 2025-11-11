// src/lib/ensureUserDoc.js
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase";

/**
 * Crea o actualiza el documento del usuario en Firestore:
 * - Si no existe, lo crea con los datos básicos.
 * - Si existe, completa solo los campos vacíos (sin pisar rol o datos ya cargados).
 * - Actualiza la fecha del último login.
 */
export async function ensureUserDoc(user, extra = {}) {
  if (!user?.uid) return;

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  // Datos base provenientes de Firebase Auth + extras opcionales
  const base = {
    email: user.email || null,
    full_name: extra.full_name || user.displayName || "",
    phone_number: extra.phone_number || user.phoneNumber || "",
    photo_url: user.photoURL || "",
    role_type: "usuario",
  };

  if (!snap.exists()) {
    // 🆕 Crear usuario nuevo en Firestore
    await setDoc(ref, {
      ...base,
      created_at: serverTimestamp(),
      last_login_at: serverTimestamp(),
    });
  } else {
    // 🔄 Si ya existe, completar campos faltantes sin sobrescribir
    const existing = snap.data() || {};
    await setDoc(
      ref,
      {
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
