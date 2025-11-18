// src/hooks/useCurrentUser.js
import { useEffect, useState } from "react";
import { onAuthStateChanged, setPersistence, browserSessionPersistence } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

/**
 * useCurrentUser
 * - enforces session persistence (survives refresh, ends when browser/window is closed)
 * - returns { user, userDoc, initializing, error }
 * - components should wait for `initializing` to be false before redirecting
 */
export default function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Ensure auth persistence is session-based: survives refresh, cleared on browser/tab close
    setPersistence(auth, browserSessionPersistence).catch((err) => {
      // Not fatal — log so developer can investigate
      console.warn("Failed to set auth persistence to session:", err);
    });

    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        setUser(u || null);

        if (!u) {
          setUserDoc(null);
        } else {
          const ref = doc(db, "users", u.uid);
          const snap = await getDoc(ref);
          setUserDoc(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        }
      } catch (err) {
        console.error("useCurrentUser error while loading userDoc:", err);
        setError(err);
        setUserDoc(null);
      } finally {
        // Mark initialization finished (first auth state resolved)
        setInitializing(false);
      }
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, userDoc, initializing, error };
}
