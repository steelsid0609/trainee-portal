// src/hooks/useCurrentUser.js
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setUserDoc(null);
        return;
      }
      const snap = await getDoc(doc(db, "users", u.uid));
      setUserDoc(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, []);

  return { user, userDoc };
}
