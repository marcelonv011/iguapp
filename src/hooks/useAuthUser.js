// src/hooks/useAuthUser.js
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/firebase";

export function useAuthUser() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser ? {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName ?? undefined,
        photoURL: fbUser.photoURL ?? undefined,
      } : null);
      setLoadingUser(false);
    });
    return () => unsub();
  }, []);

  return { user, loadingUser };
}
