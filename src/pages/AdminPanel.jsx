import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { signOut, sendPasswordResetEmail } from "firebase/auth";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  updateDoc, // We are using this again
  addDoc,
  where,
  serverTimestamp,
  limit,
  deleteDoc,
  startAt,
  endAt,
  startAfter,
} from "firebase/firestore";
// REMOVED: import { getFunctions, httpsCallable } from "firebase/functions";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import logo from "../assets/transparent-logo.png";
import { promoteTempCollege } from "../utils/promoteTempCollege";
import useCurrentUser from "../hooks/useCurrentUser";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export default function AdminPanel() {
  const { user, userDoc } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const nav = useNavigate();
  // REMOVED: const functions = getFunctions(auth.app);

  // views: "colleges_temp" | "applications" | "users" | "college_master" | "current_trainees"
  const [view, setView] = useState("colleges_temp");

  // colleges_temp
  const [temps, setTemps] = useState([]);
  const [showResolved, setShowResolved] = useState(false);

  // applications
  const [applications, setApplications] = useState([]);

  // current trainees
  const [currentTrainees, setCurrentTrainees] = useState([]);

  // inline role picker state
  const [roleEditId, setRoleEditId] = useState(null);
  const [roleEditValue, setRoleEditValue] = useState("student");

  // users
  const [usersList, setUsersList] = useState([]);
  const [userSearch, setUserSearch] = useState("");

  // college master
  const [collegeMasterList, setCollegeMasterList] = useState([]);
  const [collegeSearch, setCollegeSearch] = useState("");
  const [showCollegeForm, setShowCollegeForm] = useState(false);
  const [newCollege, setNewCollege] = useState({ name: "", address: "", email: "", contact: "" });

  // ----------------- helper: format date (handles Firestore Timestamp) -----------------
  function formatDate(raw) {
    if (!raw) return "-";
    try {
      // Firestore Timestamp has toDate()
      if (raw?.toDate && typeof raw.toDate === "function") {
        return raw.toDate().toLocaleString();
      }
      // If ISO string or Date
      const d = raw instanceof Date ? raw : new Date(raw);
      if (isNaN(d.getTime())) return String(raw);
      return d.toLocaleString();
    } catch (e) {
      return String(raw);
    }
  }

  // ----------------- FIRESTORE: fetch all docs helper (paged) -----------------
  // Fetch entire collection (no limit) by paging in batches. Uses orderBy('__name__') + startAfter
  async function fetchEntireCollection(collectionPath) {
    const BATCH = 500; // safe batch size
    const colRef = collection(db, collectionPath);
    let all = [];
    try {
      let lastDoc = null;
      while (true) {
        let q;
        if (lastDoc) {
          q = query(colRef, orderBy("__name__"), startAfter(lastDoc), limit(BATCH));
        } else {
          q = query(colRef, orderBy("__name__"), limit(BATCH));
        }
        const snap = await getDocs(q);
        if (!snap || snap.empty) break;
        snap.docs.forEach((d) => all.push({ id: d.id, ...d.data() }));
        lastDoc = snap.docs[snap.docs.length - 1];
        // if less than batch, we are done
        if (snap.docs.length < BATCH) break;
      }
    } catch (err) {
      console.error("fetchEntireCollection error", collectionPath, err);
      throw err;
    }
    return all;
  }

  // ----------------- EXPORT HELPERS -----------------
  // Flatten object to simple key:value pairs (handles nested objects and timestamps)
  function flattenForExport(obj) {
    const out = {};

    function recurse(prefix, val) {
      // treat null/undefined as empty
      if (val == null) {
        out[prefix] = "";
        return;
      }

      // Firestore Timestamp -> readable
      if (val?.toDate && typeof val.toDate === "function") {
        out[prefix] = formatDate(val);
        return;
      }
      if (val instanceof Date) {
        out[prefix] = val.toLocaleString();
        return;
      }
      if (typeof val === "object" && !Array.isArray(val)) {
        // nested object: expand keys
        Object.keys(val).forEach((k) => {
          const key = prefix ? `${prefix}.${k}` : k;
          recurse(key, val[k]);
        });
        return;
      }
      // arrays stringify (attempt to make friendly)
      if (Array.isArray(val)) {
        out[prefix] = val
          .map((it) => {
            if (it == null) return "";
            if (it?.toDate && typeof it.toDate === "function") return formatDate(it);
            if (typeof it === "object") return JSON.stringify(it);
            return String(it);
          })
          .join(", ");
        return;
      }
      // primitive
      out[prefix] = val;
    }

    // If obj is primitive, return single column
    if (typeof obj !== "object" || obj === null) return { value: obj };

    Object.keys(obj).forEach((k) => recurse(k, obj[k]));
    return out;
  }

  // Build worksheet from array of records and download as Excel
  function downloadExcel(records, filename = "export.xlsx") {
    if (!records || records.length === 0) {
      toast.info("No records to export.");
      return;
    }

    // Flatten all records and union all keys to keep consistent columns
    const flattened = records.map(flattenForExport);
    const allKeys = Array.from(
      flattened.reduce((set, rec) => {
        Object.keys(rec).forEach((k) => set.add(k));
        return set;
      }, new Set())
    );

    // Build normalized rows (ensure each row has same columns)
    const normalized = flattened.map((rec) =>
      allKeys.reduce((acc, k) => {
        acc[k] = rec[k] ?? "";
        return acc;
      }, {})
    );

    const ws = XLSX.utils.json_to_sheet(normalized, { header: allKeys });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    saveAs(blob, filename);
  }

  function timestampedFilename(prefix) {
    const iso = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    return `${prefix}_${iso}.xlsx`;
  }

  // ----------------- EXPORT: entire collection logic -----------------
  // For each view we map to a collection path. We fetch entire collection from server (not the in-memory slice).
  async function exportEntireCollectionForView() {
    if (!user || !userDoc || userDoc.role !== "admin") {
      toast.error("Admin only");
      return;
    }

    setWorking(true);
    try {
      if (view === "colleges_temp") {
        const rows = await fetchEntireCollection("colleges_temp");
        downloadExcel(rows, timestampedFilename("colleges_temp"));
        return;
      }

      if (view === "applications") {
        const rows = await fetchEntireCollection("applications");
        downloadExcel(rows, timestampedFilename("applications"));
        return;
      }

      if (view === "users") {
        const rows = await fetchEntireCollection("users");
        downloadExcel(rows, timestampedFilename("users"));
        return;
      }

      if (view === "college_master") {
        const rows = await fetchEntireCollection("colleges_master");
        downloadExcel(rows, timestampedFilename("college_master"));
        return;
      }

      if (view === "current_trainees") {
        // maps to approvedapplications collection
        const rows = await fetchEntireCollection("approvedapplications");
        downloadExcel(rows, timestampedFilename("current_trainees"));
        return;
      }

      toast.info("No export available for this view.");
    } catch (err) {
      console.error("exportEntireCollectionForView error", err);
      toast.error("Export failed: " + (err.message || err.code || err));
    } finally {
      setWorking(false);
    }
  }

  // ----------------- LOADERS -----------------
  useEffect(() => {
    if (!userDoc || userDoc.role !== "admin") {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        if (view === "colleges_temp") await loadTemps();
        else if (view === "applications") await loadApplications();
        else if (view === "users") await loadUsers();
        else if (view === "college_master") await loadCollegeMaster(collegeSearch);
        else if (view === "current_trainees") await loadCurrentTrainees();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDoc, view, showResolved]);

  async function loadTemps() {
    try {
      const qy = query(collection(db, "colleges_temp"), orderBy("submittedAt", "desc"));
      const snap = await getDocs(qy);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTemps(showResolved ? docs : docs.filter((d) => !d.resolved));
    } catch (err) {
      console.error("loadTemps error", err);
      toast.error("Failed to load pending colleges: " + (err.message || err.code));
    }
  }

  async function loadApplications() {
    try {
      const qy = query(
        collection(db, "applications"),
        where("status", "==", "pending"),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(qy);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setApplications(docs);
    } catch (err) {
      console.error("loadApplications error", err);
      toast.error("Failed to load applications: " + (err.message || err.code));
    }
  }

  async function loadCurrentTrainees() {
    try {
      const qy = query(collection(db, "approvedapplications"), orderBy("approvedAt", "desc"), limit(200));
      const snap = await getDocs(qy);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCurrentTrainees(docs);
    } catch (err) {
      console.error("loadCurrentTrainees error", err);
      toast.error("Failed to load trainees: " + (err.message || err.code));
    }
  }

  async function loadUsers() {
    try {
      let snap;

      // Try primary query (name_lower)
      try {
        const q1 = query(collection(db, "users"), orderBy("name_lower"), limit(200));
        snap = await getDocs(q1);
      } catch (e) {
        console.warn("users: name_lower query failed, falling back to email", e);
      }

      // If primary failed OR came back empty, fall back to email
      if (!snap || snap.empty) {
        const q2 = query(collection(db, "users"), orderBy("email"), limit(200));
        snap = await getDocs(q2);
      }

      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUsersList(docs);
    } catch (err) {
      console.error("loadUsers error", err);
      toast.error("Failed to load users: " + (err.message || err.code));
    }
  }

  async function loadCollegeMaster(term = "") {
    try {
      const base = collection(db, "colleges_master");
      let qy;
      const t = (term || "").trim().toLowerCase();
      if (t) {
        // Prefix search on name_lower
        qy = query(base, orderBy("name_lower"), startAt(t), endAt(t + "\uf8ff"), limit(200));
      } else {
        qy = query(base, orderBy("name_lower"), limit(200));
      }
      const snap = await getDocs(qy);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCollegeMasterList(docs);
    } catch (err) {
      console.error("loadCollegeMaster error", err);
      toast.error("Failed to load College Master: " + (err.message || err.code));
    }
  }

  // Mark trainee as completed or terminated
  async function finishTrainee(app, status) {
    const reason = window.prompt(`Enter reason for marking as ${status}:`);
    if (!reason) return toast.info("Cancelled.");

    try {
      setWorking(true);

      const payload = {
        ...app,
        finishedStatus: status,
        finishedReason: reason,
        finishedBy: user?.uid || null,
        finishedAt: serverTimestamp(),
      };

      // Move to completedapplications collection
      await addDoc(collection(db, "completedapplications"), payload);

      // Update status in applications collection
      if (app.originalId) {
        await updateDoc(doc(db, "applications", app.originalId), {
          status: status,
          reason: reason,
          finishedAt: serverTimestamp(),
        });
      }

      // Delete from approvedapplications (optional)
      await deleteDoc(doc(db, "approvedapplications", app.id));

      toast.success(`Trainee marked as ${status}.`);
      await loadCurrentTrainees();
    } catch (err) {
      console.error("finishTrainee error", err);
      toast.error("Failed to update trainee: " + (err.message || err.code));
    } finally {
      setWorking(false);
    }
  }

  async function refreshCurrent() {
    if (view === "colleges_temp") return loadTemps();
    if (view === "applications") return loadApplications();
    if (view === "users") return loadUsers();
    if (view === "college_master") return loadCollegeMaster(collegeSearch);
    if (view === "current_trainees") return loadCurrentTrainees();
  }

  /* ===================== COLLEGES_TEMP ACTIONS ===================== */

  async function saveTemp(temp) {
    try {
      const ref = doc(db, "colleges_temp", temp.id);
      await updateDoc(ref, {
        name: temp.name,
        name_lower: (temp.name || "").toLowerCase(),
        address: temp.address || "",
        contact: temp.contact || "",
      });
      toast.success("Saved.");
      await loadTemps();
    } catch (err) {
      console.error(err);
      toast.error("Save failed: " + (err.message || err.code));
    }
  }

  async function handlePromote(temp) {
    if (!user) return toast.error("Not signed in");
    if (!userDoc || userDoc.role !== "admin") return toast.error("Admin only");
    if (!window.confirm(`Promote "${temp.name}" to master (or link if exists)?`)) return;
    try {
      setWorking(true);
      await promoteTempCollege(temp.id, user.uid);
      toast.success("Updated to Master List");
      await refreshCurrent();
    } catch (err) {
      console.error(err);
      toast.error("Promote failed: " + (err.message || err.code));
    } finally {
      setWorking(false);
    }
  }

  async function deleteTemp(temp) {
    if (!user || !userDoc || userDoc.role !== "admin") return toast.error("Admin only");
    if (!window.confirm(`Permanently delete "${temp.name || temp.id}"? This cannot be undone.`)) return;
    try {
      setWorking(true);
      await deleteDoc(doc(db, "colleges_temp", temp.id));
      toast.success("Deleted.");
      await loadTemps();
    } catch (err) {
      console.error("deleteTemp error", err);
      toast.error("Failed to delete: " + (err.message || err.code));
    } finally {
      setWorking(false);
    }
  }

  /* ===================== APPLICATIONS ACTIONS ===================== */

  async function approveApplication(app) {
    if (!user || !userDoc || userDoc.role !== "admin") return toast.error("Admin only");
    if (!window.confirm("Approve this application?")) return;
    setWorking(true);
    try {
      await updateDoc(doc(db, "applications", app.id), {
        status: "approved",
        approvedBy: user.uid,
        approvedAt: serverTimestamp(),
      });

      const payload = {
        ...app,
        originalId: app.id,
        status: "approved",
        approvedBy: user.uid,
        approvedAt: serverTimestamp(),
      };
      delete payload.id;
      await addDoc(collection(db, "approvedapplications"), payload);

      toast.success("Application approved.");
      await loadApplications();
    } catch (err) {
      console.error("approveApplication error", err);
      toast.error("Failed to approve: " + (err.message || err.code));
    } finally {
      setWorking(false);
    }
  }

  async function rejectApplication(app) {
    if (!window.confirm("Reject this application?")) return;
    try {
      await updateDoc(doc(db, "applications", app.id), {
        status: "rejected",
        rejectedBy: user.uid,
        rejectedAt: serverTimestamp(),
      });

      // Move to rejectedapplications collection
      const payload = {
        ...app,
        originalId: app.id,
        status: "rejected",
        rejectedBy: user.uid,
        rejectedAt: serverTimestamp(),
      };
      delete payload.id;
      await addDoc(collection(db, "rejectedapplications"), payload);

      toast.info("Application rejected and moved to Rejected Applications.");
      await loadApplications();
    } catch (err) {
      console.error(err);
      toast.error("Failed to reject: " + (err.message || err.code));
    }
  }

  /* ===================== USERS ACTIONS (REVERTED) ===================== */

  async function updateUserRole(userItem, newRole) {
    if (!window.confirm(`Change role of ${userItem.name || userItem.email} to "${newRole}"?`)) return;
    try {
      // --- START: REVERTED CODE ---
      // This is the "free plan" method.
      // We are directly updating the user's document.
      // The new firestore.rules will ALLOW this write *only* if the
      // *caller* is an admin (by reading the caller's /users/ doc).
      await updateDoc(doc(db, "users", userItem.id), { role: newRole });
      
      toast.success("Role updated.");
      
      // Reload the local user list
      await loadUsers();
      // --- END: REVERTED CODE ---

    } catch (err) {
      console.error("updateUserRole error", err);
      toast.error("Failed to update role: " + (err.message || err.code));
    }
  }

  async function sendPasswordResetTo(email) {
    if (!email) return toast.error("No email provided");
    if (!window.confirm(`Send password reset to ${email}?`)) return;
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Password reset email sent.");
    } catch (err) {
      console.error("sendPasswordResetTo error", err);
      toast.error("Failed to send reset: " + (err.message || err.code));
    }
  }

  /* ===================== COLLEGE MASTER CRUD ===================== */

  async function createCollegeMaster() {
    if (!newCollege.name) return toast.warn("Enter college name");
    try {
      setWorking(true);
      const payload = {
        name: newCollege.name,
        name_lower: newCollege.name.toLowerCase(),
        address: newCollege.address || "",
        email: newCollege.email || "",
        contact: newCollege.contact || "",
        createdBy: user?.uid || null,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "colleges_master"), payload);
      toast.success("College created.");
      setNewCollege({ name: "", address: "", contact: "" });
      setShowCollegeForm(false);
      await loadCollegeMaster(collegeSearch);
    } catch (err) {
      console.error("createCollegeMaster error", err);
      toast.error("Failed to create: " + (err.message || err.code));
    } finally {
      setWorking(false);
    }
  }

  async function updateCollege(col) {
    try {
      const ref = doc(db, "colleges_master", col.id);
      await updateDoc(ref, {
        name: col.name,
        name_lower: (col.name || "").toLowerCase(),
        address: col.address || "",
        email: col.email || "",
        contact: col.contact || "",
      });

      toast.success("Updated successfully.");
      await loadCollegeMaster(collegeSearch);
    } catch (err) {
      console.error("updateCollege error", err);
      toast.error("Failed to update: " + (err.message || err.code));
    }
  }

  async function deleteCollege(col) {
    if (!window.confirm(`Delete "${col.name}"?`)) return;
    try {
      await deleteDoc(doc(db, "colleges_master", col.id));
      toast.success("Deleted.");
      await loadCollegeMaster(collegeSearch);
    } catch (err) {
      console.error("deleteCollege error", err);
      toast.error("Failed to delete: " + (err.message || err.code));
    }
  }

  /* ===================== UI ===================== */

  if (loading) return <div style={{ padding: 24 }}>Loading admin panel...</div>;
  if (!userDoc || userDoc.role !== "admin")
    return <div style={{ padding: 24 }}>Admin access only. Please sign in with an admin account.</div>;

  return (
    <div style={wrap}>
      {/* LEFT SIDEBAR */}
      <div style={leftPane}>
        <div style={{ textAlign: "center", padding: "20px 10px" }}>
          <img src={logo} alt="RCF Logo" style={{ width: 80, height: 80 }} />
          <h2 style={leftHeading}>Rashtriya Chemical and Fertilizer Limited</h2>
        </div>

        <div style={profileCard}>
          <div style={{ fontWeight: "bold", fontSize: "18px", marginBottom: 6 }}>{user?.email}</div>
          <div style={{ fontSize: 13, color: "#333", marginBottom: 10 }}>Admin</div>
          <hr style={{ marginTop: 6, marginBottom: 10 }} />

          <button onClick={() => { setView("colleges_temp"); loadTemps(); }} style={{ ...sideBtn, background: "#006400" }}>
            🏫 Pending Colleges
          </button>

          <button onClick={() => { setView("applications"); loadApplications(); }} style={{ ...sideBtn, background: "#0d6efd" }}>
            📝 Student Applications
          </button>

          <button onClick={() => { setView("users"); loadUsers(); }} style={{ ...sideBtn, background: "#198754" }}>
            👥 Users
          </button>

          <button onClick={() => { setView("college_master"); loadCollegeMaster(collegeSearch); }} style={{ ...sideBtn, background: "#6f42c1" }}>
            🏫 College Master
          </button>

          <button
            onClick={() => { setView("current_trainees"); loadCurrentTrainees(); }}
            style={{ ...sideBtn, background: "#ff8c00" }}
          >
            🎓 Current Trainees
          </button>

          <button onClick={() => { signOut(auth); nav("/"); }} style={{ ...sideBtn, background: "#dc3545" }}>
            🚪 Logout
          </button>
        </div>
      </div>

      {/* RIGHT CONTENT */}
      <div style={rightPane}>
        <div style={{ padding: "30px 50px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ color: "#333" }}>
              Admin Panel —{" "}
              <span style={{ color: "#006400" }}>
                {view === "colleges_temp"
                  ? "Pending Colleges to Approve"
                  : view === "applications"
                  ? "Applications"
                  : view === "users"
                  ? "Users"
                  : view === "college_master"
                  ? "College Master"
                  : "Current Trainees"}
              </span>
            </h2>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => refreshCurrent()} style={{ ...applyBtn, marginRight: 8 }}>Refresh</button>
              <button
                onClick={() => exportEntireCollectionForView()}
                style={{ ...applyBtn, background: "#0d6efd" }}
                disabled={working}
                title="Export the entire Firestore collection to Excel"
              >
                ⤓ Export Collection
              </button>
            </div>
          </div>

          {/* ---------- VIEW: Pending Colleges ---------- */}
          {view === "colleges_temp" && (
            <div>
              <div style={{ margin: "10px 0 18px 0" }}>
                <label style={{ marginRight: 12 }}>
                  <input type="checkbox" checked={showResolved} onChange={() => setShowResolved((s) => !s)} /> Show resolved
                </label>
              </div>

              {temps.length === 0 ? <div>No pending submissions</div> : temps.map((t) => (
                <div key={t.id} style={card}>
                  <div style={{ display: "flex", justifyContent: "space-evenly", alignItems: "start", gap : 50 }}>
                    <div>
                      <h4 style={{ margin: 0 }}>
                        {t.name || "Unnamed college"}{" "}
                        {t.resolved ? <span style={{ color: "green", fontSize: 13 }}>(Resolved)</span> : <span style={{ color: "red", fontSize: 13 }}>(Pending)</span>}
                      </h4>
                      <div style={{ marginTop: 6, fontSize: 13, color: "#555" }}>{t.address || "-"}</div>
                      <div style={{ marginTop: 6, fontSize: 12, color: "#777" }}>
                        Submitted by: {t.submittedBy || "unknown"} — {t.submittedAt?.toDate ? t.submittedAt.toDate().toLocaleString() : t.submittedAt || "-"}
                      </div>
                    </div>

                    <div style={{ minWidth: 260 }}>
                      <label style={{ display: "block" }}>Name</label>
                      <input value={t.name || ""} onChange={(e) => setTemps((prev) => prev.map(p => p.id === t.id ? ({ ...p, name: e.target.value }) : p))} style={inputStyle} />

                      <label>Address</label>
                      <input value={t.address || ""} onChange={(e) => setTemps((prev) => prev.map(p => p.id === t.id ? ({ ...p, address: e.target.value }) : p))} style={inputStyle} />

                      <label>Contact</label>
                      <input value={t.contact || ""} onChange={(e) => setTemps((prev) => prev.map(p => p.id === t.id ? ({ ...p, contact: e.target.value }) : p))} style={inputStyle} />

                      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                        <button onClick={() => saveTemp(t)} style={applyBtn}>Save</button>
                        <button onClick={() => handlePromote(t)} style={{ ...applyBtn, background: "#0d6efd" }} disabled={working}>Promote</button>
                        {showResolved && t.resolved && (
                          <button onClick={() => deleteTemp(t)} style={{ ...applyBtn, background: "#dc3545" }} disabled={working}>Delete</button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ---------- VIEW: Applications (UPDATED) ---------- */}
          {view === "applications" && (
            <div>
              {applications.length === 0 ? <div>No pending applications</div> : applications.map((app) => {
                // Resolve possible field names (be tolerant)
                const internshipType =
                  app.internshipType ||
                  app.internType ||
                  app.type ||
                  app.internship ||
                  "—";

                const startRaw =
                  app.startDate ||
                  app.fromDate ||
                  app.from ||
                  app.internshipStart ||
                  app.start;

                const endRaw =
                  app.endDate ||
                  app.toDate ||
                  app.to ||
                  app.internshipEnd ||
                  app.end;

                const collegeName =
                  (app.college && (app.college.name || app.collegeName)) ||
                  app.collegeName ||
                  app.college_name ||
                  "-";

                const confirmation =
                  app.confirmationNumber ||
                  app.confirmationNo ||
                  app.confirmation ||
                  app.confirmation_id ||
                  app.confirmNo ||
                  "";

                return (
                  <div key={app.id} style={card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{app.studentName || app.email || "Applicant"}</div>

                        {/* NEW: internship + duration + college + confirmation */}
                        <div style={{ marginTop: 6 }}>
                          <strong>Application:</strong> {internshipType}
                        </div>
                        <div style={{ marginTop: 6 }}>
                          <strong>Duration:</strong>{" "}
                          {startRaw ? formatDate(startRaw) : "-"} {" → "} {endRaw ? formatDate(endRaw) : "-"}
                        </div>
                        <div style={{ marginTop: 6 }}>
                          <strong>College:</strong> {collegeName}
                        </div>
                        {confirmation ? (
                          <div style={{ marginTop: 6 }}>
                            <strong>Confirmation No.:</strong> {confirmation}
                          </div>
                        ) : null}

                        <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                          Submitted: {app.createdAt?.toDate ? app.createdAt.toDate().toLocaleString() : app.createdAt || "-"}
                        </div>
                      </div>

                      <div style={{ minWidth: 220, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ fontSize: 13 }}>
                          Status: <span style={{ fontWeight: 700, color: "#ff9800" }}>{app.status || "Pending"}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => approveApplication(app)} style={applyBtn} disabled={working}>Approve</button>
                          <button onClick={() => rejectApplication(app)} style={{ ...applyBtn, background: "#6c757d" }}>Reject</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ---------- VIEW: Users ---------- */}
          {view === "users" && (
            <div>
              <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
                <input placeholder="Search by name or email" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} style={{ ...inputStyle, width: 360 }} />
                <button onClick={() => loadUsers()} style={applyBtn}>Reload</button>
              </div>

              {(usersList.filter((u) => {
                const term = userSearch.trim().toLowerCase();
                if (!term) return true;
                return (u.name || "").toLowerCase().includes(term) || (u.email || "").toLowerCase().includes(term);
              })).length === 0 ? (
                <div>No users found</div>
              ) : (
                usersList
                  .filter((u) => {
                    const term = userSearch.trim().toLowerCase();
                    if (!term) return true;
                    return (u.name || "").toLowerCase().includes(term) || (u.email || "").toLowerCase().includes(term);
                  })
                  .map((u) => (
                    <div key={u.id} style={card}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{u.name || u.email}</div>
                          <div style={{ marginTop: 6, fontSize: 15 }}>Role: {u.role || "user"}</div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ display: "flex", gap: 8 }}>
                            {roleEditId === u.id ? (
                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <select
                                  value={roleEditValue}
                                  onChange={(e) => setRoleEditValue(e.target.value)}
                                  style={{ ...inputStyle, width: 180, margin: 0, padding: "8px 10px" }}
                                >
                                  <option value="admin">admin</option>
                                  <option value="supervisor">supervisor</option> {/* This change is still needed */}
                                  <option value="student">student</option>
                                </select>
                                <button
                                  onClick={() => {
                                    if (!roleEditValue) return;
                                    updateUserRole(u, roleEditValue); // This now calls the reverted function
                                    setRoleEditId(null);
                                  }}
                                  style={applyBtn}
                                >
                                  Apply
                                </button>
                                <button
                                  onClick={() => setRoleEditId(null)}
                                  style={{ ...applyBtn, background: "#6c757d" }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setRoleEditId(u.id);
                                  setRoleEditValue(u.role || "student");
                                }}
                                style={applyBtn}
                              >
                                Change Role
                              </button>
                            )}
                            <button onClick={() => sendPasswordResetTo(u.email)} style={{ ...applyBtn, background: "#0d6efd" }}>
                              Send Password Reset
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}

          {/* ---------- VIEW: Current Trainees ---------- */}
          {view === "current_trainees" && (
            <div>
              {currentTrainees.length === 0 ? (
                <div>No current trainees found.</div>
              ) : (
                currentTrainees.map((app) => (
                  <div key={app.id} style={card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{app.studentName || app.email}</div>
                        <div style={{ marginTop: 6 }}>{app.college?.name || app.collegeName || "-"}</div>
                        <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                          Approved: {app.approvedAt?.toDate ? app.approvedAt.toDate().toLocaleString() : "-"}
                        </div>
                      </div>

                      <div style={{ minWidth: 220, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => finishTrainee(app, "completed")}
                            style={{ ...applyBtn, background: "#28a745" }}
                            disabled={working}
                          >
                            Mark Completed
                          </button>
                          <button
                            onClick={() => finishTrainee(app, "terminated")}
                            style={{ ...applyBtn, background: "#dc3545" }}
                            disabled={working}
                          >
                            Terminate
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ---------- VIEW: College Master ---------- */}
          {view === "college_master" && (
            <div>
              {/* 🔍 Search Bar */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                <input
                  placeholder="Search colleges by name, address, email or contact"
                  value={collegeSearch}
                  onChange={(e) => setCollegeSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") loadCollegeMaster(collegeSearch); }}
                  style={{ ...inputStyle, width: 360, margin: 0 }}
                />
                <button onClick={() => loadCollegeMaster(collegeSearch)} style={applyBtn}>Search</button>
                <button
                  onClick={() => { setCollegeSearch(""); loadCollegeMaster(""); }}
                  style={{ ...applyBtn, background: "#6c757d" }}
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowCollegeForm(true)}
                  style={{ ...applyBtn, background: "#0d6efd", marginLeft: "auto" }}
                >
                  ➕ New Record
                </button>
              </div>

              {/* 🏫 List or Form */}
              {!showCollegeForm ? (
                collegeMasterList.length === 0 ? (
                  <div>No colleges found.</div>
                ) : (
                  collegeMasterList.map((c) => (
                    <div key={c.id} style={card}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                        <div style={{ flex: 1 }}>
                          <label>College Name</label>
                          <input
                            value={c.name || ""}
                            onChange={(e) =>
                              setCollegeMasterList((prev) =>
                                prev.map((p) => (p.id === c.id ? { ...p, name: e.target.value } : p))
                              )
                            }
                            style={{...inputStyle, width: "800px"}}
                          />

                          <label>Address</label>
                          <input
                            value={c.address || ""}
                            onChange={(e) =>
                              setCollegeMasterList((prev) =>
                                prev.map((p) => (p.id === c.id ? { ...p, address: e.target.value } : p))
                              )
                            }
                            style={{...inputStyle, width: "800px"}}
                          />

                          <label>Email</label>
                          <input
                            value={c.email || ""}
                            onChange={(e) =>
                              setCollegeMasterList((prev) =>
                                prev.map((p) => (p.id === c.id ? { ...p, email: e.target.value } : p))
                              )
                            }
                            style={{...inputStyle, width: "300px"}}
                          />

                          <label>Contact No.</label>
                          <input
                            value={c.contact || ""}
                            onChange={(e) =>
                              setCollegeMasterList((prev) =>
                                prev.map((p) => (p.id === c.id ? { ...p, contact: e.target.value } : p))
                              )
                            }
                            style={{...inputStyle, width: "90px"}}
                          />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 160 }}>
                          <button onClick={() => updateCollege(c)} style={applyBtn}>Save</button>
                          <button onClick={() => deleteCollege(c)} style={{ ...applyBtn, background: "#dc3545" }}>
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )
              ) : (
                <div style={card}>
                  <h3>Add New College</h3>

                  <label>College Name</label>
                  <input
                    value={newCollege.name}
                    onChange={(e) => setNewCollege((s) => ({ ...s, name: e.target.value }))}
                    style={inputStyle}
                  />

                  <label>Address</label>
                  <input
                    value={newCollege.address}
                    onChange={(e) => setNewCollege((s) => ({ ...s, address: e.target.value }))}
                    style={inputStyle}
                  />

                  <label>Email</label>
                  <input
                    value={newCollege.email}
                    onChange={(e) => setNewCollege((s) => ({ ...s, email: e.target.value }))}
                    style={inputStyle}
                  />

                  <label>Contact No.</label>
                  <input
                    value={newCollege.contact}
                    onChange={(e) => setNewCollege((s) => ({ ...s, contact: e.target.value }))}
                    style={inputStyle}
                  />

                  <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                    <button onClick={createCollegeMaster} style={applyBtn} disabled={working}>Submit</button>
                    <button onClick={() => setShowCollegeForm(false)} style={{ ...applyBtn, background: "#6c757d" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* ---------- STYLES ---------- */
const wrap = {
  position: "fixed",
  inset: 0,
  display: "flex",
  width: "100vw",
  height: "100vh",
  overflow: "hidden",
};
const leftPane = {
  flex: "0 0 20%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  paddingTop: 20,
  background: "linear-gradient(180deg, #b7e4b7, #d3f0c2)",
};
const leftHeading = {
  fontSize: "22px",
  fontWeight: "700",
  color: "#006400",
  textAlign: "center",
  marginTop: 10,
  lineHeight: "1.3",
};
const rightPane = {
  flex: "0 0 80%",
  background: "#ffffff",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-start",
  overflowY: "auto",
  overflowX: "hidden",
  height: "100vh",
};
const profileCard = {
  background: "#fff",
  width: "85%",
  marginTop: 30,
  padding: 15,
  borderRadius: 10,
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  textAlign: "center",
};
const sideBtn = {
  display: "block",
  width: "100%",
  padding: "10px 0",
  marginTop: 10,
  borderRadius: 6,
  border: "none",
  cursor: "pointer",
  color: "white",
  fontWeight: 600,
  transition: "0.2s",
};
const card = {
  background: "#fff",
  padding: 18,
  marginTop: 12,
  borderRadius: 10,
  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
};
const inputStyle = {
  display: "block",
  width: "100%",
  margin: "8px 0 12px 0",
  padding: "10px 12px",
  borderRadius: 6,
  border: "1px solid #ccc",
  fontSize: 14,
};
const applyBtn = {
  background: "#006400",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  padding: "8px 14px",
  cursor: "pointer",
  fontWeight: 600,
};