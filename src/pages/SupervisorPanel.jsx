// src/pages/SupervisorPanel.jsx
import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  where,
  serverTimestamp,
  limit,
  startAt,
  endAt,
} from "firebase/firestore";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import logo from "../assets/transparent-logo.png";
import useCurrentUser from "../hooks/useCurrentUser";

/*
  SupervisorPanel.jsx
  - (NEW) Added ConfirmationVerificationCard for final step
  - (NEW) Added "Pending Appointment" filter and logic
  - (NEW) Added supervisorCompleteInternship and supervisorRejectConfirmation handlers
*/

function DetailRow({ label, value }) {
  return (
    <div style={{ margin: "4px 0" }}>
      <div style={{ fontSize: 12, color: "#666", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 14, color: "#111", fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function ApplicationCard({ app, onApprove, onReject, onRequestCoverLetter, formatDate, working, isExpanded, onToggle }) {
  const internshipType = app.internshipType || app.internType || app.type || app.internship || "—";
  const startRaw = app.startDate || app.fromDate || app.from || app.internshipStart || app.start;
  const endRaw = app.endDate || app.toDate || app.to || app.internshipEnd || app.end;
  const collegeName = (app.college && (app.college.name || app.collegeName)) || app.collegeName || app.college_name || "-";
  const confirmation = app.confirmationNumber || app.confirmationNo || app.confirmation || app.confirmation_id || app.confirmNo || "";
  const studentName = app.studentName || app.email || "Applicant";
  const coverLetterURL = app.coverLetterURL || app.coverLetterUrl || app.coverLetter || "";

  return (
    <div style={card}>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
        onClick={onToggle}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: "17px" }}>{studentName}</div>
          <div style={{ marginTop: 4, fontSize: "14px" }}>
            <strong>College:</strong> {collegeName}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 600 }}>{internshipType}</div>
          <div style={{ fontSize: 13, color: "#ff9800", fontWeight: 700 }}>{app.status || "Pending"}</div>
        </div>

        <div style={{ fontSize: "24px", color: "#555" }}>{isExpanded ? "▴" : "▾"}</div>
      </div>

      {isExpanded && (
        <div style={{ borderTop: "1px solid #eee", marginTop: 15, paddingTop: 15 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px" }}>
            <div>
              <DetailRow label="Contact" value={`${app.email || "-"} | ${app.phone || app.mobile || "-"}`} />
              <DetailRow
                label="Duration"
                value={`${startRaw ? formatDate(startRaw) : "-"} → ${endRaw ? formatDate(endRaw) : "-"}`}
              />
              {confirmation && <DetailRow label="Confirmation No." value={confirmation} />}
              <DetailRow label="Submitted" value={formatDate(app.createdAt)} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
              {coverLetterURL ? (
                <a href={coverLetterURL} target="_blank" rel="noopener noreferrer" style={{ ...applyBtn, background: "#17a2b8" }}>
                  View Cover Letter
                </a>
              ) : app.coverLetterRequested ? (
                <div style={{ fontSize: 13, color: "#006400", fontStyle: "italic" }}>
                  Student has been prompted to upload.
                </div>
              ) : (
                <button onClick={() => onRequestCoverLetter(app)} style={{ ...applyBtn, background: "#ff9800" }} disabled={working}>
                  Ask for Cover Letter
                </button>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => onApprove(app)} style={applyBtn} disabled={working}>
                  Approve
                </button>
                <button onClick={() => onReject(app)} style={{ ...applyBtn, background: "#6c757d" }} disabled={working}>
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentVerificationCard({ app, onUpdatePayment, formatDate, working, isExpanded, onToggle }) {
  const [paymentStatus, setPaymentStatus] = useState(app.paymentStatus || "pending");
  const [rejectReason, setRejectReason] = useState(app.paymentRejectReason || "");

  useEffect(() => {
    setPaymentStatus(app.paymentStatus || "pending");
    setRejectReason(app.paymentRejectReason || "");
  }, [app]);

  const studentName = app.studentName || app.email || "Applicant";
  const collegeName = (app.college && (app.college.name || app.collegeName)) || app.collegeName || "-";
  const internshipType = app.internshipType || app.type || "—";

  const handleUpdateClick = () => {
    if (paymentStatus === "rejected" && !rejectReason.trim()) {
      return toast.error("Please provide a rejection reason.");
    }
    onUpdatePayment(app, paymentStatus, rejectReason);
  };

  const currentPaymentStatus = app.paymentStatus || "pending";
  const isAccepted = app.status === "accepted";

  return (
    <div style={{ ...card, background: currentPaymentStatus === "verified" ? "#f0fff0" : "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={onToggle}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "17px" }}>{studentName}</div>
          <div style={{ marginTop: 4, fontSize: "14px" }}>
            <strong>College:</strong> {collegeName}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 600 }}>{internshipType}</div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: currentPaymentStatus === "verified" ? "green" : currentPaymentStatus === "rejected" ? "red" : "#ff9800",
            }}
          >
            Payment: <span style={{ textTransform: "capitalize" }}>{isAccepted ? "Verified" : currentPaymentStatus}</span>
          </div>
        </div>

        <div style={{ fontSize: "24px", color: "#555" }}>{isExpanded ? "▴" : "▾"}</div>
      </div>

      {isExpanded && (
        <div style={{ borderTop: "1px solid #eee", marginTop: 15, paddingTop: 15, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px" }}>
          <div>
            <DetailRow
              label="Payment Receipt No."
              value={app.paymentReceiptNumber || "Not Submitted"}
            />
            <hr style={{ margin: "10px 0" }} />

            {/* Hide form if already verified (accepted) */}
            {!isAccepted ? (
              <>
                <label>Update Payment Status</label>
                <select style={{ ...inputStyle, width: "200px" }} value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                </select>

                {paymentStatus === "rejected" && (
                  <>
                    <label>Rejection Reason</label>
                    <input style={{ ...inputStyle, width: "100%" }} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for payment rejection" />
                  </>
                )}
                <button style={applyBtn} onClick={handleUpdateClick} disabled={working}>{working ? "Updating..." : "Update Payment"}</button>
              </>
            ) : (
              <div style={{ background: "rgba(40, 167, 69, 0.1)", padding: 10, borderRadius: 5, color: "#28a745" }}>
                <strong>Payment Verified.</strong> Awaiting student to submit confirmation number.
              </div>
            )}
          </div>

          <div>
            <DetailRow label="Contact" value={`${app.email || "-"} | ${app.phone || app.mobile || "-"}`} />
            <DetailRow label="Approved On" value={formatDate(app.approvedAt)} />
            {app.paymentVerifiedAt && <DetailRow label="Verified On" value={formatDate(app.paymentVerifiedAt)} />}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- (NEW) CONFIRMATION VERIFICATION CARD ---------- */
function ConfirmationVerificationCard({ app, onComplete, onReject, formatDate, working, isExpanded, onToggle }) {
  const [rejectReason, setRejectReason] = useState(app.confirmationRejectReason || "");

  const studentName = app.studentName || app.email || "Applicant";
  const collegeName = (app.college && (app.college.name || app.collegeName)) || app.collegeName || "-";
  const internshipType = app.internshipType || app.type || "—";

  const handleCompleteClick = () => {
    if (!window.confirm("This will mark the internship as completed. Proceed?")) return;
    onComplete(app);
  };

  const handleRejectClick = () => {
    if (!rejectReason.trim()) {
      return toast.error("Please provide a rejection reason.");
    }
    if (!window.confirm("This will reject the confirmation number and ask the student to resubmit. Proceed?")) return;
    onReject(app, rejectReason);
  };

  return (
    <div style={{ ...card, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={onToggle}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "17px" }}>{studentName}</div>
          <div style={{ marginTop: 4, fontSize: "14px" }}>
            <strong>College:</strong> {collegeName}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 600 }}>{internshipType}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0d6efd" }}>
            Verifying Confirmation
          </div>
        </div>

        <div style={{ fontSize: "24px", color: "#555" }}>{isExpanded ? "▴" : "▾"}</div>
      </div>

      {isExpanded && (
        <div style={{ borderTop: "1px solid #eee", marginTop: 15, paddingTop: 15, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px" }}>
          <div>
            <DetailRow
              label="Submitted Confirmation No."
              value={app.finalConfirmationNumber || "Not Submitted"}
            />
            <hr style={{ margin: "10px 0" }} />

            <label>Check The Confirmation Number</label>
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button style={applyBtn} onClick={handleCompleteClick} disabled={working}>
                {working ? "..." : "Upload Appointment Letter"}
              </button>
            </div>
          </div>

          <div style={{margin: "4px 30px"}}>
            <DetailRow label="Contact" value={`${app.email || "-"} | ${app.phone || app.mobile || "-"}`} />
            <DetailRow label="Payment Verified On" value={formatDate(app.paymentVerifiedAt)} />
            <DetailRow label="Confirmation Submitted On" value={formatDate(app.confirmationSubmittedAt)} />
          </div>
        </div>
      )}
    </div>
  );
}
/* ---------- END NEW COMPONENT ---------- */

export default function SupervisorPanel() {
  const { user, userDoc } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const nav = useNavigate();

  const [view, setView] = useState("applications");

  const [applications, setApplications] = useState([]);
  const [appFilter, setAppFilter] = useState("pending");
  const [expandedAppId, setExpandedAppId] = useState(null);

  const [collegeMasterList, setCollegeMasterList] = useState([]);
  const [collegeSearch, setCollegeSearch] = useState("");

  function formatDate(raw) {
    if (!raw) return "-";
    try {
      if (raw?.toDate && typeof raw.toDate === "function") return raw.toDate().toLocaleString();
      const d = raw instanceof Date ? raw : new Date(raw);
      if (isNaN(d.getTime())) return String(raw);
      return d.toLocaleString();
    } catch (e) {
      return String(raw);
    }
  }

  useEffect(() => {
    if (!userDoc || !["admin", "supervisor"].includes(userDoc.role)) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        if (view === "applications") await loadApplications();
        else if (view === "college_master") await loadCollegeMaster(collegeSearch);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDoc, view]);

  async function loadApplications() {
    try {
      const qy = query(collection(db, "applications"), orderBy("createdAt", "desc"), limit(200));
      const snap = await getDocs(qy);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setApplications(docs);
    } catch (err) {
      console.error("loadApplications error", err);
      toast.error("Failed to load applications: " + (err.message || err.code));
    }
  }

  async function loadCollegeMaster(term = "") {
    try {
      const base = collection(db, "colleges_master");
      const t = (term || "").trim().toLowerCase();
      let qy;
      if (t) {
        qy = query(base, orderBy("name_lower"), startAt(t), endAt(t + ""), limit(200));
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

  async function refreshCurrent() {
    if (view === "applications") return loadApplications();
    if (view === "college_master") return loadCollegeMaster(collegeSearch);
  }

  async function supervisorApprove(app) {
    if (!window.confirm("Approve this application?")) return;
    setWorking(true);
    try {
      await updateDoc(doc(db, "applications", app.id), { status: "approved", approvedBy: user.uid, approvedAt: serverTimestamp() });
      toast.success("Application approved.");
      await loadApplications();
    } catch (err) {
      console.error("supervisorApprove error", err);
      toast.error("Failed to approve: " + (err.message || err.code));
    } finally {
      setWorking(false);
    }
  }

  async function supervisorReject(app) {
    if (!window.confirm("Reject this application?")) return;
    setWorking(true);
    try {
      await updateDoc(doc(db, "applications", app.id), { status: "rejected", rejectedBy: user.uid, rejectedAt: serverTimestamp() });
      toast.info("Application rejected.");
      await loadApplications();
    } catch (err) {
      console.error("supervisorReject error", err);
      toast.error("Failed to reject: " + (err.message || err.code));
    } finally {
      setWorking(false);
    }
  }

  // --- (MODIFIED) supervisorUpdatePayment ---
  async function supervisorUpdatePayment(app, newStatus, reason = "") {
    if (newStatus === "rejected" && !reason.trim()) return toast.error("A rejection reason is required.");
    setWorking(true);
    try {
      const payload = {
        paymentStatus: newStatus,
        paymentVerifiedAt: null,
        paymentRejectReason: "",
        paymentVerifiedBy: null,
        status: "approved", // Default to 'approved'
        confirmationRejectReason: "", // (NEW) Clear this just in case
      };

      if (newStatus === "verified") {
        payload.paymentVerifiedBy = user.uid;
        payload.paymentVerifiedAt = serverTimestamp();
        payload.status = "accepted"; // <-- (NEW) Move to next stage
        payload.paymentRejectReason = ""; // Clear any old reason
      } else if (newStatus === "rejected") {
        payload.paymentRejectReason = reason.trim();
        payload.paymentReceiptNumber = null; // <-- (NEW) Clear receipt to force resubmit
        payload.status = "approved"; // Keep in this queue for resubmission
      } else {
        // If status is set back to 'pending' (by supervisor)
        payload.status = "approved";
      }

      await updateDoc(doc(db, "applications", app.id), payload);
      toast.success("Payment status updated.");
      await loadApplications();
    } catch (err) {
      console.error("supervisorUpdatePayment error", err);
      toast.error("Failed to update payment: " + (err.message || err.code));
    } finally {
      setWorking(false);
    }
  }
  // --- END MODIFIED FUNCTION ---

  async function supervisorRequestCoverLetter(app) {
    setWorking(true);
    try {
      // Set a flag on the application document
      await updateDoc(doc(db, "applications", app.id), { coverLetterRequested: true });
      toast.success("Request sent. Student will be prompted to upload.");
      // Reload applications to show the "Student has been prompted" status
      await loadApplications();
    } catch (err) {
      console.error("supervisorRequestCoverLetter error", err);
      toast.error("Failed to send request: " + (err.message || err.code));
    } finally {
      setWorking(false);
    }
  }

  /* ---------- (NEW) CONFIRMATION HANDLERS ---------- */
  async function supervisorCompleteInternship(app) {
    setWorking(true);
    try {
      await updateDoc(doc(db, "applications", app.id), {
        status: "completed",
        completedBy: user.uid,
        completedAt: serverTimestamp(),
        confirmationRejectReason: "", // Clear any reason
      });
      toast.success("Internship successfully marked as completed.");
      await loadApplications();
    } catch (err) {
      console.error("supervisorCompleteInternship error", err);
      toast.error("Failed to complete internship: " + (err.message || err.code));
    } finally {
      setWorking(false);
    }
  }

  async function supervisorRejectConfirmation(app, reason) {
    setWorking(true);
    try {
      await updateDoc(doc(db, "applications", app.id), {
        status: "accepted", // Send back to "accepted" state
        finalConfirmationNumber: null, // Clear the bad number
        confirmationRejectReason: reason, // Add the reason
      });
      toast.warn("Confirmation rejected. Student has been asked to resubmit.");
      await loadApplications();
    } catch (err) {
      console.error("supervisorRejectConfirmation error", err);
      toast.error("Failed to reject confirmation: " + (err.message || err.code));
    } finally {
      setWorking(false);
    }
  }
  /* ---------- END NEW HANDLERS ---------- */

  if (loading) return <div style={{ padding: 24 }}>Loading supervisor panel...</div>;
  if (!userDoc || !["admin", "supervisor"].includes(userDoc.role)) return <div style={{ padding: 24 }}>Supervisor access only. Please sign in with a supervisor account.</div>;

  // --- (MODIFIED) filteredApplications ---
  const filteredApplications = applications.filter((app) => {
    if (appFilter === "pending") return app.status === "pending";
    if (appFilter === "approved") return app.status === "approved" || app.status === "accepted";
    if (appFilter === "confirmation") return app.status === "pending_confirmation"; // <-- (NEW)
    return true;
  });

  return (
    <div style={wrap}>
      <div style={leftPane}>
        <div style={{ textAlign: "center", padding: "20px 10px" }}>
          <img src={logo} alt="RCF Logo" style={{ width: 80, height: 80 }} />
          <h2 style={leftHeading}>Rashtriya Chemical and Fertilizer Limited</h2>
        </div>

        <div style={profileCard}>
          <div style={{ fontWeight: "bold", fontSize: "18px", marginBottom: 6 }}>{user?.email}</div>
          <div style={{ fontSize: 13, color: "#333", marginBottom: 10, textTransform: "capitalize" }}>{userDoc.role}</div>
          <hr style={{ marginTop: 6, marginBottom: 10 }} />

          <button onClick={() => { setView("applications"); loadApplications(); }} style={{ ...sideBtn, background: "#0d6efd" }}>📝 Student Applications</button>

          <button onClick={() => { setView("college_master"); loadCollegeMaster(collegeSearch); }} style={{ ...sideBtn, background: "#6f42c1" }}>🏫 College Master (View)</button>

          <button onClick={() => { signOut(auth); nav("/"); }} style={{ ...sideBtn, background: "#dc3545" }}>🚪 Logout</button>
        </div>
      </div>

      <div style={rightPane}>
        <div style={{ padding: "30px 50px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ color: "#333" }}>Supervisor Panel — <span style={{ color: "#006400" }}>{view === "applications" ? "Applications" : "College Master"}</span></h2>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => refreshCurrent()} style={{ ...applyBtn, marginRight: 8 }}>Refresh</button>
            </div>
          </div>

          {view === "applications" && (
            <div>
              {/* --- (MODIFIED) Filter buttons --- */}
              <div style={{ margin: "10px 0 18px 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={appFilter === "pending" ? applyBtn : { ...applyBtn, background: "#6c757d" }} onClick={() => setAppFilter("pending")}>Pending Approval</button>
                <button style={appFilter === "approved" ? applyBtn : { ...applyBtn, background: "#6c757d" }} onClick={() => setAppFilter("approved")}>Pending Payment</button>
                <button style={appFilter === "confirmation" ? applyBtn : { ...applyBtn, background: "#6c757d" }} onClick={() => setAppFilter("confirmation")}>Pending Appointment</button>
              </div>

              {filteredApplications.length === 0 ? (
                <div>No applications found for this filter.</div>
              ) : (
                /* --- (NEW) Render Logic for 3 Card Types --- */
                filteredApplications.map((app) => {
                  // 1. Pending Approval
                  if (app.status === "pending") {
                    return (
                      <ApplicationCard 
                        key={app.id} 
                        app={app} 
                        onApprove={supervisorApprove} 
                        onReject={supervisorReject} 
                        onRequestCoverLetter={supervisorRequestCoverLetter} 
                        formatDate={formatDate} 
                  _     working={working} 
                        isExpanded={expandedAppId === app.id} 
                        onToggle={() => setExpandedAppId(expandedAppId === app.id ? null : app.id)} 
                      />
                    );
                  }
                  // 2. Pending Payment (or waiting for confirmation submission)
                  if (app.status === "approved" || app.status === "accepted") {
                    return (
                      <PaymentVerificationCard 
                        key={app.id} 
                        app={app} 
                        onUpdatePayment={supervisorUpdatePayment} 
                        formatDate={formatDate} 
                        working={working} 
                        isExpanded={expandedAppId === app.id} 
                        onToggle={() => setExpandedAppId(expandedAppId === app.id ? null : app.id)} 
                      />
                    );
                  }
                  // 3. Pending Confirmation Verification
                  if (app.status === "pending_confirmation") {
                    return (
                      <ConfirmationVerificationCard
                    _   key={app.id}
                        app={app}
                        onComplete={supervisorCompleteInternship}
                        onReject={supervisorRejectConfirmation}
                        formatDate={formatDate}
                        working={working}
                        isExpanded={expandedAppId === app.id}
Two                     onToggle={() => setExpandedAppId(expandedAppId === app.id ? null : app.id)}
                      />
                    );
                  }
                  return null; // Fallback for other statuses (e.g., completed, rejected)
                })
              )}
            </div>
          )}

          {view === "college_master" && (
            <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                <input placeholder="Search colleges by name..." value={collegeSearch} onChange={(e) => setCollegeSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") loadCollegeMaster(collegeSearch); }} style={{ ...inputStyle, width: 360, margin: 0 }} />
                <button onClick={() => loadCollegeMaster(collegeSearch)} style={applyBtn}>Search</button>
                <button onClick={() => { setCollegeSearch(""); loadCollegeMaster(""); }} style={{ ...applyBtn, background: "#6c757d" }}>Clear</button>
              </div>

              {collegeMasterList.length === 0 ? (
                <div>No colleges found.</div>
              ) : (
                collegeMasterList.map((c) => (
                  <div key={c.id} style={card}>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{c.name}</div>
                  <div style={{ fontSize: 14, color: "#444", marginTop: 4 }}>{c.address || "No address"}</div>
                    <div style={{ fontSize: 14, color: "#444", marginTop: 4 }}>{c.email || "No email"} | {c.contact || "No contact"}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- STYLES (no change) ---------- */
const wrap = { position: "fixed", inset: 0, display: "flex", width: "100vw", height: "100vh", overflow: "hidden" };
const leftPane = { flex: "0 0 20%", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 20, background: "linear-gradient(180deg, #b7e4b7, #d3f0c2)" };
const leftHeading = { fontSize: "22px", fontWeight: "700", color: "#006400", textAlign: "center", marginTop: 10, lineHeight: "1.3" };
const rightPane = { flex: "0 0 80%", background: "#ffffff", display: "flex", flexDirection: "column", justifyContent: "flex-start", overflowY: "auto", overflowX: "hidden", height: "100vh" };
const profileCard = { background: "#fff", width: "85%", marginTop: 30, padding: 15, borderRadius: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", textAlign: "center" };
const sideBtn = { display: "block", width: "100%", padding: "10px 0", marginTop: 10, borderRadius: 6, border: "none", cursor: "pointer", color: "white", fontWeight: 600, transition: "0.2s" };
const card = { background: "#fff", padding: 18, marginTop: 12, borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" };
const inputStyle = { display: "block", width: "100%", margin: "8px 0 12px 0", padding: "10px 12px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14 };
const applyBtn = { background: "#006400", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", cursor: "pointer", fontWeight: 600 };