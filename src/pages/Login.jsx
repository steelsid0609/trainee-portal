// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  sendEmailVerification,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import logo from "../assets/transparent-logo.png";

export default function Login() {
  const nav = useNavigate();
  const location = useLocation();

  // detect login role (student/admin/institute)
  const params = new URLSearchParams(location.search);
  const intentRole = (
    (location.state && location.state.role) ||
    params.get("role") ||
    "student"
  ).toLowerCase();

  // clean up ?role=student from URL
  if (location.search) {
    window.history.replaceState({}, "", location.pathname);
  }

  // state hooks
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regInfo, setRegInfo] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotInfo, setForgotInfo] = useState("");

  // helper — ensure Firestore user doc exists (doesn't set role here)
  async function ensureUserDoc(user) {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        email: user.email,
        fullName: "",
        phone: "",
        address: "",
        state: "",
        role: "student",
        createdAt: serverTimestamp(),
      });
      console.log("✅ Firestore user document created.");
    }
  }

  // --- LOGIN HANDLER ---
  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setInfo("");

    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      const user = res.user;

      // email verification check
      if (!user.emailVerified) {
        const resend = window.confirm(
          "Your email is not verified. Would you like to resend the verification email?"
        );
        if (resend) {
          await sendEmailVerification(user, {
            url: `${window.location.origin}/finishVerify`,
            handleCodeInApp: true,
          });
          alert("Verification email sent. Please check your inbox.");
        }
        await auth.signOut();
        setLoading(false);
        return;
      }

      // ensure Firestore doc exists
      await ensureUserDoc(user);

      // First try to get role from ID token claims (most secure)
      const idTokenResult = await user.getIdTokenResult(true);
      let role = (idTokenResult.claims.role || "").toLowerCase();

      // If no role claim present, fall back to users/{uid} doc (less secure),
      // but safe for redirect decision because users can read their own doc.
      if (!role) {
        try {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data && data.role) role = String(data.role).toLowerCase();
          }
        } catch (err) {
          console.warn("Failed to read users doc for role fallback:", err);
        }
      }

      // default to student
      if (!role) role = "student";

      // redirect by role
      if (role === "admin") nav("/admin");
      else if (role === "institute") nav("/institute/profile");
      else nav("/student/profile");
    } catch (err) {
      console.error("Login error:", err);
      setInfo(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  // --- REGISTER HANDLER (writes role into users doc) ---
  async function handleRegister(e) {
    e.preventDefault();
    setRegLoading(true);
    setRegInfo("");

    try {
      const res = await createUserWithEmailAndPassword(
        auth,
        regEmail,
        regPassword
      );
      const user = res.user;

      // IMPORTANT:
      // We write a 'role' field into the user's Firestore document
      // based on intentRole (student | institute). If your Firestore
      // security rules deny this write from client, this call will fail.
      const resolvedRole =
        intentRole === "institute" ? "institute" : "student";

      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        email: user.email,
        fullName: "",
        phone: "",
        address: "",
        state: "",
        role: resolvedRole,
        createdAt: serverTimestamp(),
      });

      // send verification link
      await sendEmailVerification(user, {
        url: `${window.location.origin}/finishVerify`,
        handleCodeInApp: true,
      });

      setRegInfo(
        "Registration successful — verification email sent. Please check your inbox."
      );

      setRegEmail("");
      setRegPassword("");
      setShowRegister(false);
      setEmail(user.email || "");
    } catch (err) {
      console.error("Register error:", err);
      setRegInfo(err.message || "Registration failed");
    } finally {
      setRegLoading(false);
    }
  }

  // --- FORGOT PASSWORD HANDLER ---
  async function handleForgot(e) {
    e.preventDefault();
    setForgotLoading(true);
    setForgotInfo("");

    try {
      await sendPasswordResetEmail(auth, forgotEmail, {
        url: `${window.location.origin}/finishVerify`,
        handleCodeInApp: true,
      });
      setForgotInfo(
        "Password reset email sent. Please check your inbox (and spam)."
      );
      setForgotEmail("");
      setShowForgot(false);
    } catch (err) {
      console.error("Forgot password error:", err);
      setForgotInfo(err.message || "Failed to send reset email");
    } finally {
      setForgotLoading(false);
    }
  }

  // ---------- UI ----------
  return (
    <div style={wrap}>
      {/* LEFT PANE */}
      <div style={leftPane}>
        <div style={{ padding: "20px", textAlign: "center" }}>
          <img
            src={logo}
            alt="Company Logo"
            style={{ width: "100px", cursor: "pointer" }}
            onClick={() => nav("/")}
          />
          <h1 style={leftHeading}>Rashtriya Chemical and Fertilizer Limited</h1>
        </div>
      </div>

      {/* RIGHT PANE */}
      <div style={rightPane}>
        <div style={cardWrap}>
          {showForgot ? (
            // FORGOT PASSWORD
            <div style={card}>
              <h2>Reset Password</h2>
              <p style={{ color: "#555" }}>
                Enter your email to receive password reset instructions.
              </p>
              <form onSubmit={handleForgot}>
                <input
                  type="email"
                  placeholder="Email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  style={input}
                />
                <button type="submit" disabled={forgotLoading} style={primaryBtn}>
                  {forgotLoading ? "Sending..." : "Send reset email"}
                </button>
              </form>
              <div style={{ marginTop: 20 }}>
                <button
                  onClick={() => {
                    setShowForgot(false);
                    setForgotInfo("");
                  }}
                  style={linkBtn}
                >
                  ← Back to sign in
                </button>
              </div>
              {forgotInfo && (
                <div
                  style={{
                    marginTop: 12,
                    color: forgotInfo.startsWith("Password") ? "green" : "crimson",
                  }}
                >
                  {forgotInfo}
                </div>
              )}
            </div>
          ) : !showRegister ? (
            // LOGIN CARD
            <div style={card}>
              <h2 style={{ marginBottom: 20 }}>
                {intentRole === "admin"
                  ? "Admin Login"
                  : intentRole === "institute"
                  ? "Institute Login"
                  : "Student Login"}
              </h2>
              <form onSubmit={handleLogin}>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={input}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={input}
                />
                <button type="submit" disabled={loading} style={primaryBtn}>
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>
              <div
                style={{
                  marginTop: 35,
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                }}
              >
                <button onClick={() => setShowForgot(true)} style={linkBtn}>
                  Forgot password?
                </button>

                {/* HIDE 'Register' for admin role */}
                {intentRole !== "admin" ? (
                  <button onClick={() => setShowRegister(true)} style={linkBtn}>
                    Register
                  </button>
                ) : (
                  <div /> // preserve layout spacing
                )}
              </div>
              {info && (
                <div style={{ marginTop: 12, color: "crimson" }}>{info}</div>
              )}
            </div>
          ) : (
            // REGISTER CARD
            <div style={card}>
              <h2>Register ({intentRole === "institute" ? "Institute" : "Student"})</h2>
              <p style={{ color: "#555" }}>
                Create an account — a verification email will be sent.
              </p>
              <form onSubmit={handleRegister}>
                <input
                  type="email"
                  placeholder="Email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  style={input}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  style={input}
                />
                <button type="submit" disabled={regLoading} style={primaryBtn}>
                  {regLoading ? "Registering..." : "Register"}
                </button>
              </form>
              <div style={{ marginTop: 35 }}>
                <button onClick={() => setShowRegister(false)} style={linkBtn}>
                  ← Back to sign in
                </button>
              </div>
              {regInfo && (
                <div
                  style={{
                    marginTop: 12,
                    color: regInfo.startsWith("Registration") ? "green" : "crimson",
                  }}
                >
                  {regInfo}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Styles ---------- */
const wrap = {
  position: "fixed",
  inset: 0,
  display: "flex",
  width: "100vw",
  height: "100vh",
  overflow: "hidden",
};

const leftPane = {
  flex: "0 0 25%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const leftHeading = {
  marginTop: "20px",
  fontSize: "40px",
  fontWeight: "700",
  color: "#006400",
  textAlign: "center",
  lineHeight: "1.4",
};

const rightPane = {
  flex: "0 0 75%",
  height: "100%",
  background: "#ffffff",
  display: "flex",
  flexDirection: "column",
};

const cardWrap = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "32px",
};

const card = {
  width: 550,
  padding: 28,
  borderRadius: 12,
  background: "#fff",
  boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
  textAlign: "center",
};

const input = {
  width: "80%",
  padding: "12px 12px",
  marginTop: 20,
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 14,
};

const primaryBtn = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "none",
  marginTop: 25,
  background: "#28a745",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};

const linkBtn = {
  background: "transparent",
  border: "none",
  color: "#0066cc",
  cursor: "pointer",
  padding: 0,
  fontSize: 14,
};
