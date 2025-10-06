// src/pages/AdminPanel.jsx
import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  updateDoc
} from "firebase/firestore";
import { promoteTempCollege } from "../utils/promoteTempCollege";
import useCurrentUser from "../hooks/useCurrentUser";

export default function AdminPanel() {
  const { user, userDoc } = useCurrentUser(); // your existing hook
  const [temps, setTemps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    if (!userDoc || userDoc.role !== "admin") {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const q = query(collection(db, "colleges_temp"), orderBy("submittedAt", "desc"));
      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // filter out resolved ones by default:
      const visible = showResolved ? docs : docs.filter((d) => !d.resolved);
      setTemps(visible);
      setLoading(false);
    })();
    // rerun when showResolved or userDoc changes
  }, [userDoc, showResolved]);

  async function refreshList() {
    setLoading(true);
    const q = query(collection(db, "colleges_temp"), orderBy("submittedAt", "desc"));
    const snap = await getDocs(q);
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setTemps(showResolved ? docs : docs.filter((d) => !d.resolved));
    setLoading(false);
  }

  async function handleSave(temp) {
    try {
      const ref = doc(db, "colleges_temp", temp.id);
      await updateDoc(ref, {
        name: temp.name,
        name_lower: (temp.name || "").toLowerCase(),
        address: temp.address || "",
        contact: temp.contact || ""
      });
      await refreshList();
      alert("Saved changes.");
    } catch (err) {
      console.error(err);
      alert("Save failed: " + err.message);
    }
  }

  async function handlePromote(temp) {
    if (!user) return alert("Not signed in");
    if (!userDoc || userDoc.role !== "admin") return alert("Not an admin");
    if (!window.confirm(`Promote "${temp.name}" to master (or link if exists)?`)) return;
    try {
      setWorking(true);
      const res = await promoteTempCollege(temp.id, user.uid);
      alert(`Success: ${res.status}. Students updated: ${res.updated || 0}. MasterId: ${res.masterId}`);
      await refreshList(); // this will remove resolved ones from the list if resolved==true
    } catch (err) {
      console.error(err);
      alert("Promote failed: " + err.message);
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <div>Loading...</div>;
  if (!userDoc || userDoc.role !== "admin") return <div>Admin access only. Please sign in with an admin account.</div>;

  return (
    <div style={{ padding: 16 }}>
      <h2>Admin Panel — Pending College Submissions</h2>
      <div style={{ marginBottom: 8 }}>
        Signed in as: {user?.email}{" "}
        <button onClick={() => signOut(auth)}>Logout</button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ marginRight: 8 }}>
          <input
            type="checkbox"
            checked={showResolved}
            onChange={() => setShowResolved((s) => !s)}
          />{" "}
          Show resolved
        </label>
        <button onClick={refreshList} style={{ marginLeft: 8 }}>Refresh</button>
      </div>

      {temps.length === 0 && <div>No pending submissions</div>}

      {temps.map((t) => (
        <div key={t.id} style={{ border: "1px solid #ddd", padding: 12, marginBottom: 12, borderRadius: 6 }}>
          <h4>
            Submission: {t.name} {t.resolved ? <span style={{ color: "green" }}>(Resolved)</span> : <span style={{ color: "red" }}>(Pending)</span>}
          </h4>

          <label style={{ display: "block", marginTop: 8 }}>
            Name
            <input
              style={{ display: "block", width: "100%", padding: 6 }}
              value={t.name || ""}
              onChange={(e) => setTemps((prev) => prev.map(p => p.id === t.id ? ({ ...p, name: e.target.value }) : p))}
            />
          </label>

          <label style={{ display: "block", marginTop: 8 }}>
            Address
            <input
              style={{ display: "block", width: "100%", padding: 6 }}
              value={t.address || ""}
              onChange={(e) => setTemps((prev) => prev.map(p => p.id === t.id ? ({ ...p, address: e.target.value }) : p))}
            />
          </label>

          <label style={{ display: "block", marginTop: 8 }}>
            Contact
            <input
              style={{ display: "block", width: "100%", padding: 6 }}
              value={t.contact || ""}
              onChange={(e) => setTemps((prev) => prev.map(p => p.id === t.id ? ({ ...p, contact: e.target.value }) : p))}
            />
          </label>

          <div style={{ marginTop: 10 }}>
            <button onClick={() => handleSave(t)}>Save changes</button>{" "}
            <button onClick={() => handlePromote(t)} disabled={working} style={{ marginLeft: 8 }}>
              Promote / Link
            </button>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
            Submitted by: {t.submittedBy || "unknown"} — {t.submittedAt?.toDate ? t.submittedAt.toDate().toLocaleString() : t.submittedAt || "-"}
          </div>
        </div>
      ))}
    </div>
  );
}
