// src/routes/AdminRoute.jsx
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export default function AdminRoute({ children }) {
  const [allowed, setAllowed] = useState(null); // null = loading
  const location = useLocation();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      try {
        console.log("[AdminRoute] auth state:", u?.uid, "verified:", u?.emailVerified);

        if (!u) return setAllowed(false);
        if (!u.emailVerified) return setAllowed(false);

        const userRef = doc(db, "users", u.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          console.warn("[AdminRoute] users doc missing; creating default student doc");
          await setDoc(
            userRef,
            {
              email: u.email || "",
              role: "student",
              status: "active",
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );
          return setAllowed(false); // not admin yet
        }

        const role = (snap.data().role || "student").toLowerCase();
        console.log("[AdminRoute] role:", role);
        setAllowed(role === "admin");
      } catch (err) {
        console.error("[AdminRoute] error:", err);
        setAllowed(false);
      }
    });

    return () => unsub && unsub();
  }, []);

  if (allowed === null) return <div style={{ padding: 12 }}>Loading…</div>;
  if (!allowed)
    return (
      <Navigate to="/login?role=admin" replace state={{ from: location.pathname }} />
    );

  return children;
}
