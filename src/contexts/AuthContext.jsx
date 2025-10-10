// src/contexts/AuthContext.jsx
import React, { createContext, useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged, getIdToken } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export const AuthContext = createContext({
  user: null,
  userDoc: null,
  loading: true,
  refreshUserDoc: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadUserDoc(uid) {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      setUserDoc(snap.exists() ? snap.data() : null);
      return snap.exists() ? snap.data() : null;
    } catch (err) {
      console.error("AuthProvider: loadUserDoc failed", err);
      return null;
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      setUser(u);
      if (!u) {
        setUserDoc(null);
        try { localStorage.removeItem("rcf_id_token"); localStorage.removeItem("rcf_user_role"); } catch(e){}
        setLoading(false);
        return;
      }

      try {
        const idToken = await getIdToken(u);
        try { localStorage.setItem("rcf_id_token", idToken); } catch (e) { console.warn("localStorage set failed", e); }

        const docData = await loadUserDoc(u.uid);
        // persist role if available
        const role = (docData && docData.role) || (u?.role) || null;
        if (role) {
          try { localStorage.setItem("rcf_user_role", role); } catch (e) {}
        }
      } catch (err) {
        console.error("AuthProvider: token/doc load error", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  // expose a refresh helper
  async function refreshUserDoc() {
    if (!user?.uid) return null;
    return loadUserDoc(user.uid);
  }

  return (
    <AuthContext.Provider value={{ user, userDoc, loading, refreshUserDoc }}>
      {children}
    </AuthContext.Provider>
  );
}
