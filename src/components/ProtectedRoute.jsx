// src/components/ProtectedRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/firebase";

/**
 * Uso:
 * <ProtectedRoute allowedRoles={['admin','superadmin']}>
 *   <AdminPanel />
 * </ProtectedRoute>
 */
export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setAuthed(false);
        setRole(null);
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const data = snap.exists() ? snap.data() : null;
        setAuthed(true);
        setRole(data?.role_type || "usuario");
      } catch {
        setAuthed(true);
        setRole("usuario");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  if (loading) return <LoadingScreen />;

  // no logueado => login
  if (!authed) return <Navigate to="/login" replace />;

  // si hay restricción y el rol no está permitido => home
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  // ok
  return children;
}

function LoadingScreen() {
  return (
    <div className="min-h-[60vh] grid place-items-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900" />
    </div>
  );
}
