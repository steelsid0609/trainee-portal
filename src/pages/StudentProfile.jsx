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
import { toast } from "react-toastify";
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

          if (!data.fullName || !data.phone || !data.pincode) {
            setShowBasicForm(true);
          } else {
            setShowBasicForm(false);
          }
        } else {
          setProfile(null);
          setShowBasicForm(true);
        }

        await loadApplications(u.uid);
      } catch (err) {
        console.error("Error in dashboard bootstrap:", err);
        toast.error("Error loading dashboard: " + (err.message || err.code || err));
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
        toast.error("You do not have permission to read applications. Check Firestore rules.");
      } else {
        toast.error("Failed to load applications: " + (err.message || err.code));
      }
    }
  }

  async function handleLogout() {
    await signOut(auth);
    nav("/");
  }

  async function handleChangePassword() {
    if (!user?.email) return toast.error("No email found for password reset.");
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast.success("Password reset email sent. Please check your inbox.");
    } catch (err) {
      console.error("Failed to send password reset:", err);
      toast.error("Failed to send password reset: " + (err.message || err.code));
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
          {profile?.discipline && (
            <div style={{ fontSize: 14, color: "#444", marginTop: 6, fontWeight: "bold" }}>
              🎓 {profile.discipline}
            </div>
          )}
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

          <button onClick={handleChangePassword} style={{ ...sideBtn, background: "#0d6efd" }}>
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
              <p>Welcome to Dashboard</p>

              {!showApplyForm ? (
                <>
                  <button onClick={() => setShowApplyForm(true)} style={applyBtn}>
                    ➕ Apply
                  </button>

                  {applications.length === 0 ? (
                    <p style={{ marginTop: 20 }}>No applications found.</p>
                  ) : (
                    <div style={{ marginTop: 25 }}>
                      <h3>Your Applications</h3>
                      <table style={table}>
                        <thead>
                          <tr>
                            <th style={thtd}>Type</th>
                            <th style={thtd}>Applied On</th>
                            <th style={thtd}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {applications.map((app) => (
                            <tr key={app.id}>
                              <td style={thtd}>{app.internshipType}</td>
                              <td style={thtd}>
                                {app.createdAt?.toDate ? app.createdAt.toDate().toLocaleDateString() : "-"}
                              </td>
                              <td style={thtd}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{
                                    display: "inline-block",
                                    padding: "4px 10px",
                                    borderRadius: "999px",
                                    backgroundColor:
                                      app.status?.toLowerCase() === "approved" ||
                                      app.status?.toLowerCase() === "accepted" ||
                                      app.status?.toLowerCase() === "completed"
                                        ? "rgba(40, 167, 69, 0.15)"
                                        : app.status?.toLowerCase() === "rejected" ||
                                          app.status?.toLowerCase() === "terminated"
                                        ? "rgba(220, 53, 69, 0.15)"
                                        : "rgba(255, 193, 7, 0.15)",
                                    color:
                                      app.status?.toLowerCase() === "approved" ||
                                      app.status?.toLowerCase() === "accepted" ||
                                      app.status?.toLowerCase() === "completed"
                                        ? "#28a745"
                                        : app.status?.toLowerCase() === "rejected" ||
                                          app.status?.toLowerCase() === "terminated"
                                        ? "#dc3545"
                                        : "#ff9800",
                                    fontWeight: 700,
                                    textTransform: "capitalize",
                                  }}>
                                    {app.status || "Pending"}
                                  </span>

                                  {(app.status?.toLowerCase() === "completed" ||
                                    app.status?.toLowerCase() === "terminated") &&
                                    app.reason && (
                                      <div className="tooltip-wrapper">
                                        <span
                                          className="tooltip-icon"
                                          style={{
                                            color:
                                              app.status?.toLowerCase() === "terminated"
                                                ? "#dc3545"
                                                : "#28a745",
                                          }}
                                        >
                                          &#9432;
                                        </span>
                                        <div className="tooltip-box">{app.reason}</div>
                                      </div>
                                    )}
                                </div>
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

/* ---------- BASIC INFO FORM (first-time) ---------- */
function BasicInfoForm({ user, existingProfile, onCompleted }) {
  const [form, setForm] = useState({
    email: user?.email || existingProfile?.email || "",
    fullName: existingProfile?.fullName || "",
    phone: existingProfile?.phone || "",
    discipline: existingProfile?.discipline || "",
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
        toast.warn("Pincode not found. Please verify or enter City/State manually.");
      }
    } catch (err) {
      console.error("Pincode lookup failed:", err);
      toast.error("Failed to auto-fill city/state from pincode. You can enter them manually.");
    } finally {
      setPincodeLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.fullName.trim()) return toast.error("Please enter your full name.");
    if (!/^\d{10}$/.test(form.phone)) return toast.error("Please enter a valid 10-digit phone number.");
    if (!/^\d{6}$/.test(form.pincode)) return toast.error("Please enter a valid 6-digit pincode.");

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
        discipline: form.discipline || "",
        email: form.email,
        updatedAt: serverTimestamp(),
      };

      await setDoc(userRef, payload, { merge: true });
      toast.success("Profile saved. You can now use the dashboard.");
      if (onCompleted) await onCompleted();
    } catch (err) {
      console.error("Failed to save basic info:", err);
      if (err.code === "permission-denied") {
        toast.error("You do not have permission to save profile. Check Firestore rules.");
      } else {
        toast.warn("Failed to save profile: " + (err.message || err.code));
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
        <input style={{ ...inputStyle, background: "#f2f2f2", cursor: "not-allowed", width: "300px" }} value={form.email} readOnly />

        <label>Full name</label>
        <input required style={{ ...inputStyle, width: "500px" }} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Your full name" />

        <label>Discipline / Branch</label>
        <input required style={{ ...inputStyle, width: "300px" }} value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })} placeholder="e.g. Mechanical, Electrical, Computer Science" />

        <label>Mobile number</label>
        <input required style={{ ...inputStyle, width: "200px" }} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder="10-digit mobile number" />

        <label>Address line (house/street)</label>
        <input style={{ ...inputStyle, width: "800px" }} value={form.addressLine} onChange={(e) => setForm({ ...form, addressLine: e.target.value })} placeholder="House / Street / Locality" />

        <label>Pincode</label>
        <input required style={{ ...inputStyle, width: "100px" }} value={form.pincode} onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 6);
          setForm((f) => ({ ...f, pincode: v }));
          if (v.length === 6) lookupPincode(v);
          else setForm((f) => ({ ...f, city: "", state: "" }));
        }} placeholder="6-digit PIN code" />
        {pincodeLoading && <div style={{ fontSize: 13, marginTop: -8 }}>Looking up city/state...</div>}

        <label>City</label>
        <input required style={{ ...inputStyle, width: "200px" }} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City (auto-filled from pincode)" />

        <label>State</label>
        <input required style={{ ...inputStyle, width: "200px" }} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State (auto-filled from pincode)" />

        <div style={{ marginTop: 10 }}>
          <button type="submit" disabled={loading} style={applyBtn}>
            {loading ? "Saving..." : "Submit & Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------- EDIT PROFILE (unchanged from earlier file, but kept safe) ---------- */
function EditProfile({ user, profile, setShowEdit, onSaved }) {
  const [form, setForm] = useState({
    fullName: profile?.fullName || "",
    phone: profile?.phone || "",
    addressLine: profile?.addressLine || "",
    pincode: profile?.pincode || "",
    city: profile?.city || "",
    state: profile?.state || "",
    email: user?.email || profile?.email || "",
    discipline: profile?.discipline || "",
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
        toast.warn("Pincode not found. Please verify or enter City/State manually.");
      }
    } catch (e) {
      console.error("Pincode lookup failed:", e);
      toast.error("Failed to auto-fill city/state from pincode. You can enter them manually.");
    } finally {
      setPincodeLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.fullName.trim()) return toast.error("Please enter your full name.");
    if (!/^\d{10}$/.test(form.phone)) return toast.error("Please enter a valid 10-digit phone number.");
    if (!/^\d{6}$/.test(form.pincode)) return toast.error("Please enter a valid 6-digit pincode.");

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
        email: form.email,
        discipline: form.discipline || "",
        updatedAt: serverTimestamp(),
      };
      await setDoc(userRef, payload, { merge: true });

      toast.success("Profile updated.");
      if (onSaved) await onSaved();
      setShowEdit(false);
    } catch (err) {
      console.error("Failed to update profile:", err);
      if (err.code === "permission-denied") {
        toast.warn("You do not have permission to update this profile. Check Firestore rules.");
      } else {
        toast.error("Failed to update profile: " + (err.message || err.code));
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
        <input style={{ ...inputStyle, background: "#f2f2f2", cursor: "not-allowed" }} value={form.email} readOnly />

        <label>Full name</label>
        <input required style={inputStyle} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Your full name" />

        <label>Discipline / Branch</label>
        <input required style={inputStyle} value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })} placeholder="e.g. Mechanical, Electrical, Computer Science" />

        <label>Mobile number</label>
        <input required style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder="10-digit mobile number" />

        <label>Address line (house/street)</label>
        <input style={inputStyle} value={form.addressLine} onChange={(e) => setForm({ ...form, addressLine: e.target.value })} placeholder="House / Street / Locality" />

        <label>Pincode</label>
        <input required style={inputStyle} value={form.pincode} onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 6);
          setForm((f) => ({ ...f, pincode: v }));
          if (v.length === 6) lookupPincode(v);
          else setForm((f) => ({ ...f, city: "", state: "" }));
        }} placeholder="6-digit PIN code" />
        {pincodeLoading && <div style={{ fontSize: 13, marginTop: -8 }}>Looking up city/state...</div>}

        <label>City</label>
        <input required style={inputStyle} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" />

        <label>State</label>
        <input required style={inputStyle} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State" />

        <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
          <button type="submit" disabled={saving} style={applyBtn}>{saving ? "Saving..." : "Save Changes"}</button>
          <button type="button" onClick={() => setShowEdit(false)} style={{ ...applyBtn, background: "#6c757d" }}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- APPLY FORM (updated for validations and colleges_temp email) ---------- */
function ApplyForm({ user, profile, setShowApplyForm, reload }) {
  const [form, setForm] = useState({
    fullName: profile?.fullName || "",
    phone: profile?.phone || "",
    email: user?.email || "",
    discipline: profile?.discipline || "",
    bloodGroup: "",
    collegeSearch: "",
    collegeSelected: "",
    college: { name: "", address: "", pincode: "", contact: "" },
    internshipType: "Internship",
    startDate: "",
    endDate: "",
    receivedConfirmation: "No",
    confirmationNumber: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [showOtherCollege, setShowOtherCollege] = useState(false);
  const [masterColleges, setMasterColleges] = useState([]);
  const [loadingColleges, setLoadingColleges] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingColleges(true);
      try {
        const snap = await getDocs(collection(db, "colleges_master"));
        const cols = [];
        snap.forEach((d) => {
          const data = d.data();
          cols.push({ id: d.id, name: data.name || data.collegeName || "" });
        });
        if (!cancelled) setMasterColleges(cols);
      } catch (err) {
        console.error("Failed to load colleges_master:", err);
        if (!cancelled) setMasterColleges([]);
      } finally {
        if (!cancelled) setLoadingColleges(false);
      }
    }
    load();
    return () => (cancelled = true);
  }, []);

  useEffect(() => {
    setShowOtherCollege(form.collegeSelected === "Other");
  }, [form.collegeSelected]);

  const filteredColleges = masterColleges
    .filter((c) => c.name.toLowerCase().includes(form.collegeSearch.toLowerCase()))
    .slice(0, 50);

  function handleCollegeSelect(name) {
    setForm((f) => ({
      ...f,
      collegeSearch: name,
      collegeSelected: name,
      college: name === "Other" ? f.college : { ...f.college, name },
    }));
  }

  function validate() {
    if (!form.fullName.trim()) return "Full name is required.";
    if (!/^\d{10}$/.test(form.phone)) return "Enter a valid 10-digit mobile number.";
    if (!form.email || !/^\S+@\S+\.\S+$/.test(form.email)) return "Enter a valid email address.";
    if (!form.discipline.trim()) return "Please provide your discipline/branch.";
    if (!form.bloodGroup) return "Please select your blood group.";
    if (!form.collegeSelected) return "Please select or provide your college.";
    if (form.collegeSelected === "Other") {
      if (!form.college.name.trim()) return "Please enter your college name.";
      if (!form.college.address.trim()) return "Please enter your college address.";
      if (!/^\d{6}$/.test(form.college.pincode)) return "Enter a valid 6-digit college pincode.";
      if (!/^\d{7,15}$/.test(form.college.contact.replace(/\D/g, ""))) return "Enter a valid college contact number (7-15 digits).";
    }
    if (!form.internshipType) return "Please select the internship type.";
    if (!form.startDate) return "Please select a start date.";
    if (!form.endDate) return "Please select an end date.";
    if (new Date(form.endDate) < new Date(form.startDate)) return "End date cannot be before start date.";
    if (!form.receivedConfirmation) return "Please indicate if you've received confirmation.";
    if (form.receivedConfirmation === "Yes") {
      // confirmation number must be alphanumeric and a reasonable length
      if (!/^[A-Za-z0-9\-]{4,40}$/.test(form.confirmationNumber.trim()))
        return "Please enter a valid confirmation number (4+ alphanumeric chars).";
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const err = validate();
    if (err) return toast.error(err);

    setSubmitting(true);
    try {
      let tempCollegeRef = null;
      if (form.collegeSelected === "Other") {
        const sanitizedContact = (form.college.contact || "").replace(/\D/g, "");
        const collegePayload = {
          name: form.college.name.trim(),
          address: form.college.address.trim(),
          pincode: form.college.pincode,
          contact: sanitizedContact,
          submittedBy: user.uid,
          submittedByEmail: user?.email || "",
          submittedAt: serverTimestamp(),
          status: "pending",
        };
        const colDoc = await addDoc(collection(db, "colleges_temp"), collegePayload);
        tempCollegeRef = { id: colDoc.id, path: `colleges_temp/${colDoc.id}` };
      }

      const collegeInfo =
        form.collegeSelected === "Other"
          ? { name: form.college.name.trim(), tempCollegeRef }
          : { name: form.collegeSelected };

      const payload = {
        createdBy: user.uid,
        studentName: form.fullName,
        email: form.email,
        phone: form.phone,
        bloodGroup: form.bloodGroup,
        college: collegeInfo,
        internshipType: form.internshipType,
        startDate: form.startDate,
        endDate: form.endDate,
        receivedConfirmation: form.receivedConfirmation === "Yes",
        confirmationNumber: form.receivedConfirmation === "Yes" ? form.confirmationNumber.trim() : "",
        createdAt: serverTimestamp(),
        status: "pending",
      };

      await addDoc(collection(db, "applications"), payload);

      toast.success("Application submitted successfully!");
      setShowApplyForm(false);
      if (reload) await reload(user.uid);
    } catch (err) {
      console.error("Failed to submit application:", err);
      if (err.code === "permission-denied") {
        toast.warn("You do not have permission to submit applications. Check Firestore rules.");
      } else {
        toast.error("Failed to submit application: " + (err.message || err.code));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={card}>
      <h3>Apply for Internship / OJT / VT</h3>
      <form onSubmit={handleSubmit}>
        <label>Full Name</label>
        <input style={{ ...inputStyle, width: "570px" }} value={form.fullName} readOnly />

        <label>Discipline / Branch</label>
        <input style={{ ...inputStyle, width: "400px" }} value={form.discipline} readOnly />

        <label>Mobile number</label>
        <input style={{ ...inputStyle, width: "80px" }} value={form.phone} readOnly />

        <label>Email</label>
        <input style={{ ...inputStyle, width: "300px" }} value={form.email} readOnly />

        <label>Blood Group</label>
        <select required style={{ ...inputStyle, width: "130px" }} value={form.bloodGroup} onChange={(e) => setForm((f) => ({ ...f, bloodGroup: e.target.value }))}>
          <option value="">Select Group</option>
          <option>O+</option>
          <option>O-</option>
          <option>A+</option>
          <option>A-</option>
          <option>B+</option>
          <option>B-</option>
          <option>AB+</option>
          <option>AB-</option>
        </select>

        <label>College (search & select)</label>
        <input style={{ ...inputStyle, width: "570px" }} placeholder={loadingColleges ? "Loading colleges..." : "Search your college..."} value={form.collegeSearch} onChange={(e) => setForm((f) => ({ ...f, collegeSearch: e.target.value }))} />

        {form.collegeSearch && (
          <div style={{ maxHeight: 140, overflowY: "auto", border: "1px solid #eee", padding: 6, marginBottom: 8, width: "570px" }}>
            {loadingColleges && <div style={{ padding: 6 }}>Loading colleges...</div>}
            {!loadingColleges && filteredColleges.length === 0 && <div style={{ padding: 6 }}>No matches. Click <strong>Other</strong> to provide college details.</div>}
            {!loadingColleges && filteredColleges.map((c) => (
              <div key={c.id} onClick={() => handleCollegeSelect(c.name)} style={{ padding: "6px 8px", cursor: "pointer", background: form.collegeSelected === c.name ? "#f0f8ff" : "transparent", borderRadius: 4, marginBottom: 4, width: "570px" }}>{c.name}</div>
            ))}
            <div onClick={() => handleCollegeSelect("Other")} style={{ padding: "6px 8px", cursor: "pointer", background: form.collegeSelected === "Other" ? "#f0f8ff" : "transparent", borderRadius: 4, marginBottom: 4, fontWeight: 600, width: "570px" }}>Other</div>
          </div>
        )}

        {showOtherCollege && (
          <>
            <h4 style={{ marginTop: 12 }}>College details (Other)</h4>

            <label>College name</label>
            <input style={{ ...inputStyle, width: "570px" }} value={form.college.name} onChange={(e) => setForm((f) => ({ ...f, college: { ...f.college, name: e.target.value } }))} placeholder="College name" required={showOtherCollege} />

            <label>College address</label>
            <input style={{ ...inputStyle, width: "570px" }} value={form.college.address} onChange={(e) => setForm((f) => ({ ...f, college: { ...f.college, address: e.target.value } }))} placeholder="Address" required={showOtherCollege} />

            <label>College pincode</label>
            <input style={{ ...inputStyle, width: "200px" }} value={form.college.pincode} onChange={(e) => setForm((f) => ({ ...f, college: { ...f.college, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) } }))} placeholder="6-digit pincode" required={showOtherCollege} />

            <label>College contact number</label>
            <input style={{ ...inputStyle, width: "200px" }} value={form.college.contact} onChange={(e) => setForm((f) => ({ ...f, college: { ...f.college, contact: e.target.value } }))} placeholder="Contact number" required={showOtherCollege} />
          </>
        )}

        <label style={{ marginTop: 8 }}>Apply for</label>
        <select style={{...inputStyle, width: "200px"}} value={form.internshipType} onChange={(e) => setForm((f) => ({ ...f, internshipType: e.target.value }))}>
          <option>Internship</option>
          <option>On Job Training</option>
          <option>Vocational Trainee</option>
        </select>

        <label>Start date</label>
        <input style={{ ...inputStyle, width: "180px" }} type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />

        <label>End date</label>
        <input style={{ ...inputStyle, width: "180px" }} type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />

        <label>Already received confirmation?</label>
        <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="radio" name="receivedConfirmation" checked={form.receivedConfirmation === "Yes"} onChange={() => setForm((f) => ({ ...f, receivedConfirmation: "Yes" }))} /> Yes
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="radio" name="receivedConfirmation" checked={form.receivedConfirmation === "No"} onChange={() => setForm((f) => ({ ...f, receivedConfirmation: "No", confirmationNumber: "" }))} /> No
          </label>
        </div>

        {form.receivedConfirmation === "Yes" && (
          <>
            <label>Confirmation number</label>
            <input style={inputStyle} value={form.confirmationNumber} onChange={(e) => setForm((f) => ({ ...f, confirmationNumber: e.target.value }))} placeholder="Confirmation number" required />
          </>
        )}

        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          <button type="submit" disabled={submitting} style={applyBtn}>{submitting ? "Submitting..." : "Submit Application"}</button>

          <button type="button" onClick={() => setShowApplyForm(false)} style={{ ...applyBtn, background: "#6c757d", marginLeft: 10 }}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- STYLES (kept same) ---------- */
const wrap = { position: "fixed", inset: 0, display: "flex", width: "100vw", height: "100vh", overflow: "hidden" };
const leftPane = { flex: "0 0 20%", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 20, background: "linear-gradient(180deg, #b7e4b7, #d3f0c2)" };
const leftHeading = { fontSize: "22px", fontWeight: "700", color: "#006400", textAlign: "center", marginTop: 10, lineHeight: "1.3" };
const rightPane = { flex: "0 0 80%", background: "#ffffff", display: "flex", flexDirection: "column", justifyContent: "flex-start", overflowY: "auto", overflowX: "hidden", height: "100vh" };
const profileCard = { background: "#fff", width: "85%", marginTop: 30, padding: 15, borderRadius: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", textAlign: "center" };
const sideBtn = { display: "block", width: "100%", padding: "10px 0", marginTop: 10, borderRadius: 6, border: "none", cursor: "pointer", color: "white", fontWeight: 600, transition: "0.2s" };
const card = { background: "#fff", padding: 25, marginTop: 20, borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.5)" };
const table = { width: "100%", borderCollapse: "collapse", marginTop: 10 };
const thtd = { padding: "10px", borderBottom: "1px solid #ddd", textAlign: "left", verticalAlign: "top" };
const inputStyle = { display: "block", width: "100%", margin: "8px 0 15px 0", padding: "10px 12px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14 };
const applyBtn = { background: "#006400", color: "#fff", border: "none", borderRadius: 6, padding: "10px 18px", cursor: "pointer", fontWeight: 600 };
