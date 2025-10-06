// src/pages/StudentDashboard.jsx
import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { signOut, sendPasswordResetEmail } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import logo from "../assets/transparent-logo.png";

export default function StudentDashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [applications, setApplications] = useState([]);
  const [showBasicForm, setShowBasicForm] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      try {
        if (!u) {
          nav("/");
          return;
        }
        setUser(u);

        const userRef = doc(db, "users", u.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          setProfile(data);

          // Show basic info form only if essential fields are missing
          if (!data.fullName || !data.phone || !data.pincode) {
            setShowBasicForm(true);
          } else {
            setShowBasicForm(false);
          }
        } else {
          // first-time: no user doc present
          setProfile(null);
          setShowBasicForm(true);
        }

        await loadApplications(u.uid);
      } catch (err) {
        console.error("Error in dashboard bootstrap:", err);
        alert("Error loading dashboard: " + (err.message || err.code || err));
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [nav]);

  async function loadApplications(uid) {
    try {
      const q = query(collection(db, "applications"), where("createdBy", "==", uid));
      const querySnap = await getDocs(q);
      const apps = [];
      querySnap.forEach((d) => apps.push({ id: d.id, ...d.data() }));
      setApplications(apps);
    } catch (err) {
      console.error("Failed to load applications:", err);
      if (err.code === "permission-denied") {
        alert("You do not have permission to read applications. Check Firestore rules.");
      } else {
        alert("Failed to load applications: " + (err.message || err.code));
      }
    }
  }

  async function handleLogout() {
    await signOut(auth);
    nav("/");
  }

  async function handleChangePassword() {
    if (!user?.email) return alert("No email found for password reset.");
    try {
      await sendPasswordResetEmail(auth, user.email);
      alert("Password reset email sent. Please check your inbox.");
    } catch (err) {
      console.error("Failed to send password reset:", err);
      alert("Failed to send password reset: " + (err.message || err.code));
    }
  }

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div style={wrap}>
      {/* LEFT SIDEBAR */}
      <div style={leftPane}>
        <div style={{ textAlign: "center", padding: "20px 10px" }}>
          <img src={logo} alt="RCF Logo" style={{ width: 80, height: 80 }} />
          <h2 style={leftHeading}>Rashtriya Chemical and Fertilizer Limited</h2>
        </div>

        <div style={profileCard}>
          <div style={{ fontWeight: "bold", fontSize: "20px", marginBottom: 5 }}>
            {profile?.fullName || "Student"}
          </div>
          <div style={{ fontSize: 14, color: "#333" }}>{user?.email}</div>
          {profile?.phone && (
            <div style={{ fontSize: 14, color: "#555", marginTop: 4 }}>
              📞 {profile.phone}
            </div>
          )}
          {profile?.state && (
            <div style={{ fontSize: 13, color: "#777", marginTop: 4 }}>
              {profile.state}
            </div>
          )}
          <hr style={{ marginTop: 30 }} />

          <button onClick={() => setShowEdit(true)} style={{ ...sideBtn, background: "#198754" }}>
            ✏️ Edit Profile
          </button>

          <button
            onClick={handleChangePassword}
            style={{ ...sideBtn, background: "#0d6efd" }}
          >
            🔒 Change Password
          </button>

          <button onClick={handleLogout} style={{ ...sideBtn, background: "#dc3545" }}>
            🚪 Logout
          </button>
        </div>
      </div>

      {/* RIGHT CONTENT */}
      <div style={rightPane}>
        <div style={{ padding: "30px 50px" }}>
          {showBasicForm ? (
            <BasicInfoForm
              user={user}
              existingProfile={profile}
              onCompleted={async () => {
                const snap = await getDoc(doc(db, "users", user.uid));
                if (snap.exists()) setProfile(snap.data());
                setShowBasicForm(false);
              }}
            />
          ) : !showEdit ? (
            <>
              <h2 style={{ color: "#333" }}>
                Hey, <span style={{ color: "#006400" }}>{profile?.fullName}</span>
              </h2>
              <p>Welcome to your Internship Dashboard</p>

              {!showApplyForm ? (
                <>
                  <button onClick={() => setShowApplyForm(true)} style={applyBtn}>
                    ➕ Apply for Internship
                  </button>

                  {applications.length === 0 ? (
                    <p style={{ marginTop: 20 }}>No applications found.</p>
                  ) : (
                    <div style={{ marginTop: 25 }}>
                      <h3>Your Applications</h3>
                      <table style={table}>
                        <thead>
                          <tr>
                            <th style={thtd}>Position</th>
                            <th style={thtd}>Description</th>
                            <th style={thtd}>Applied On</th>
                            <th style={thtd}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {applications.map((app) => (
                            <tr key={app.id}>
                              <td style={thtd}>{app.position}</td>
                              <td style={thtd}>{app.description}</td>
                              <td style={thtd}>
                                {app.createdAt?.toDate
                                  ? app.createdAt.toDate().toLocaleDateString()
                                  : "-"}
                              </td>
                              <td style={thtd}>
                                <span
                                  style={{
                                    color:
                                      app.status === "Completed"
                                        ? "green"
                                        : app.status === "Terminated"
                                        ? "red"
                                        : "#ff9800",
                                    fontWeight: 600,
                                  }}
                                >
                                  {app.status || "Pending"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <ApplyForm
                  user={user}
                  profile={profile}
                  setShowApplyForm={setShowApplyForm}
                  reload={loadApplications}
                />
              )}
            </>
          ) : (
            <EditProfile
              user={user}
              profile={profile}
              setShowEdit={setShowEdit}
              onSaved={async () => {
                const snap = await getDoc(doc(db, "users", user.uid));
                if (snap.exists()) setProfile(snap.data());
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- BASIC INFO FORM (FIRST-TIME USERS) ---------- */
function BasicInfoForm({ user, existingProfile, onCompleted }) {
  const [form, setForm] = useState({
    email: user?.email || existingProfile?.email || "",
    fullName: existingProfile?.fullName || "",
    phone: existingProfile?.phone || "",
    addressLine: existingProfile?.addressLine || "",
    pincode: existingProfile?.pincode || "",
    city: existingProfile?.city || "",
    state: existingProfile?.state || "",
  });
  const [loading, setLoading] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);

  async function lookupPincode(pin) {
    if (!/^\d{6}$/.test(pin)) {
      setForm((f) => ({ ...f, city: "", state: "" }));
      return;
    }
    setPincodeLoading(true);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const json = await res.json();
      const result = Array.isArray(json) ? json[0] : null;
      if (result?.Status === "Success" && Array.isArray(result.PostOffice) && result.PostOffice.length > 0) {
        const po = result.PostOffice[0];
        setForm((f) => ({ ...f, city: po.District || "", state: po.State || "" }));
      } else {
        setForm((f) => ({ ...f, city: "", state: "" }));
        alert("Pincode not found. Please verify or enter City/State manually.");
      }
    } catch (err) {
      console.error("Pincode lookup failed:", err);
      alert("Failed to auto-fill city/state from pincode. You can enter them manually.");
    } finally {
      setPincodeLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.fullName.trim()) return alert("Please enter your full name.");
    if (!/^\d{10}$/.test(form.phone)) return alert("Please enter a valid 10-digit phone number.");
    if (!/^\d{6}$/.test(form.pincode)) return alert("Please enter a valid 6-digit pincode.");

    setLoading(true);
    try {
      const userRef = doc(db, "users", user.uid);

      const payload = {
        fullName: form.fullName,
        phone: form.phone,
        addressLine: form.addressLine || "",
        pincode: form.pincode,
        city: form.city || "",
        state: form.state || "",
        email: form.email,
        updatedAt: serverTimestamp(),
      };

      await setDoc(userRef, payload, { merge: true });
      alert("Profile saved. You can now use the dashboard.");
      if (onCompleted) await onCompleted();
    } catch (err) {
      console.error("Failed to save basic info:", err);
      if (err.code === "permission-denied") {
        alert("You do not have permission to save profile. Check Firestore rules.");
      } else {
        alert("Failed to save profile: " + (err.message || err.code));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={card}>
      <h3>Complete your basic information</h3>
      <p>Please provide your name, mobile number and address (pincode, city, state).</p>

      <form onSubmit={handleSubmit}>
        <label>Email</label>
        <input
          style={{ ...inputStyle, background: "#f2f2f2", cursor: "not-allowed" }}
          value={form.email}
          readOnly
        />

        <label>Full name</label>
        <input
          required
          style={inputStyle}
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          placeholder="Your full name"
        />

        <label>Mobile number</label>
        <input
          required
          style={inputStyle}
          value={form.phone}
          onChange={(e) =>
            setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })
          }
          placeholder="10-digit mobile number"
        />

        <label>Address line (house/street)</label>
        <input
          style={inputStyle}
          value={form.addressLine}
          onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
          placeholder="House / Street / Locality"
        />

        <label>Pincode</label>
        <input
          required
          style={inputStyle}
          value={form.pincode}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 6);
            setForm((f) => ({ ...f, pincode: v }));
            if (v.length === 6) lookupPincode(v);
            else setForm((f) => ({ ...f, city: "", state: "" }));
          }}
          placeholder="6-digit PIN code"
        />
        {pincodeLoading && <div style={{ fontSize: 13, marginTop: -8 }}>Looking up city/state...</div>}

        <label>City</label>
        <input
          required
          style={inputStyle}
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          placeholder="City (auto-filled from pincode)"
        />

        <label>State</label>
        <input
          required
          style={inputStyle}
          value={form.state}
          onChange={(e) => setForm({ ...form, state: e.target.value })}
          placeholder="State (auto-filled from pincode)"
        />

        <div style={{ marginTop: 10 }}>
          <button type="submit" disabled={loading} style={applyBtn}>
            {loading ? "Saving..." : "Submit & Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------- EDIT PROFILE ---------- */
function EditProfile({ user, profile, setShowEdit, onSaved }) {
  const [form, setForm] = useState({
    fullName: profile?.fullName || "",
    phone: profile?.phone || "",
    addressLine: profile?.addressLine || "",
    pincode: profile?.pincode || "",
    city: profile?.city || "",
    state: profile?.state || "",
    email: user?.email || profile?.email || "",
  });
  const [saving, setSaving] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);

  async function lookupPincode(pin) {
    if (!/^\d{6}$/.test(pin)) {
      setForm((f) => ({ ...f, city: "", state: "" }));
      return;
    }
    setPincodeLoading(true);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const json = await res.json();
      const result = Array.isArray(json) ? json[0] : null;
      if (result?.Status === "Success" && Array.isArray(result.PostOffice) && result.PostOffice.length > 0) {
        const po = result.PostOffice[0];
        setForm((f) => ({ ...f, city: po.District || "", state: po.State || "" }));
      } else {
        setForm((f) => ({ ...f, city: "", state: "" }));
        alert("Pincode not found. Please verify or enter City/State manually.");
      }
    } catch (e) {
      console.error("Pincode lookup failed:", e);
      alert("Failed to auto-fill city/state from pincode. You can enter them manually.");
    } finally {
      setPincodeLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.fullName.trim()) return alert("Please enter your full name.");
    if (!/^\d{10}$/.test(form.phone)) return alert("Please enter a valid 10-digit phone number.");
    if (!/^\d{6}$/.test(form.pincode)) return alert("Please enter a valid 6-digit pincode.");

    setSaving(true);
    try {
      const userRef = doc(db, "users", user.uid);
      const payload = {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        addressLine: form.addressLine || "",
        pincode: form.pincode,
        city: form.city || "",
        state: form.state || "",
        email: form.email, // read-only here
        updatedAt: serverTimestamp(),
      };
      // merge so we never touch role/status fields (passes your rules)
      await setDoc(userRef, payload, { merge: true });

      alert("Profile updated.");
      if (onSaved) await onSaved();
      setShowEdit(false);
    } catch (err) {
      console.error("Failed to update profile:", err);
      if (err.code === "permission-denied") {
        alert("You do not have permission to update this profile. Check Firestore rules.");
      } else {
        alert("Failed to update profile: " + (err.message || err.code));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={card}>
      <h3>Edit Profile</h3>
      <form onSubmit={handleSubmit}>
        <label>Email</label>
        <input
          style={{ ...inputStyle, background: "#f2f2f2", cursor: "not-allowed" }}
          value={form.email}
          readOnly
        />

        <label>Full name</label>
        <input
          required
          style={inputStyle}
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          placeholder="Your full name"
        />

        <label>Mobile number</label>
        <input
          required
          style={inputStyle}
          value={form.phone}
          onChange={(e) =>
            setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })
          }
          placeholder="10-digit mobile number"
        />

        <label>Address line (house/street)</label>
        <input
          style={inputStyle}
          value={form.addressLine}
          onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
          placeholder="House / Street / Locality"
        />

        <label>Pincode</label>
        <input
          required
          style={inputStyle}
          value={form.pincode}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 6);
            setForm((f) => ({ ...f, pincode: v }));
            if (v.length === 6) lookupPincode(v);
            else setForm((f) => ({ ...f, city: "", state: "" }));
          }}
          placeholder="6-digit PIN code"
        />
        {pincodeLoading && (
          <div style={{ fontSize: 13, marginTop: -8 }}>Looking up city/state...</div>
        )}

        <label>City</label>
        <input
          required
          style={inputStyle}
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          placeholder="City"
        />

        <label>State</label>
        <input
          required
          style={inputStyle}
          value={form.state}
          onChange={(e) => setForm({ ...form, state: e.target.value })}
          placeholder="State"
        />

        <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
          <button type="submit" disabled={saving} style={applyBtn}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => setShowEdit(false)}
            style={{ ...applyBtn, background: "#6c757d" }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------- APPLY FORM ---------- */
function ApplyForm({ user, profile, setShowApplyForm, reload }) {
  const [form, setForm] = useState({ position: "", description: "" });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(db, "applications"), {
        createdBy: user.uid, // matches rules
        studentName: profile?.fullName || "",
        email: user.email,
        phone: profile?.phone || "",
        position: form.position,
        description: form.description,
        createdAt: serverTimestamp(),
      });

      alert("Application submitted successfully!");
      setShowApplyForm(false);
      await reload(user.uid);
    } catch (err) {
      console.error("Failed to submit application:", err);
      if (err.code === "permission-denied") {
        alert("You do not have permission to submit applications. Check Firestore rules.");
      } else {
        alert("Failed to submit application: " + (err.message || err.code));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={card}>
      <h3>Apply for Internship</h3>
      <form onSubmit={handleSubmit}>
        <label>Position</label>
        <input
          required
          style={inputStyle}
          value={form.position}
          onChange={(e) => setForm({ ...form, position: e.target.value })}
          placeholder="Internship Position"
        />
        <label>Description</label>
        <textarea
          required
          style={{ ...inputStyle, height: 80 }}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Short description"
        />
        <button type="submit" disabled={submitting} style={applyBtn}>
          {submitting ? "Submitting..." : "Submit Application"}
        </button>
        <button
          type="button"
          onClick={() => setShowApplyForm(false)}
          style={{ ...applyBtn, background: "#6c757d", marginLeft: 10 }}
        >
          Cancel
        </button>
      </form>
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
  overflow: "hidden",
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
  padding: 25,
  marginTop: 20,
  borderRadius: 10,
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 10,
};

const thtd = {
  padding: "10px",
  borderBottom: "1px solid #ddd",
  textAlign: "left",
  verticalAlign: "top",
};

const inputStyle = {
  display: "block",
  width: "100%",
  margin: "8px 0 15px 0",
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
  padding: "10px 18px",
  cursor: "pointer",
  fontWeight: 600,
};
