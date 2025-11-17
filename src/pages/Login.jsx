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
import { toast } from "react-toastify";
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

  // clean up ?role=... from URL
  if (location.search) {
    window.history.replaceState({}, "", location.pathname);
  }

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // ensure Firestore user doc exists (doesn't set admin role from client)
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

  async function handleLogin(e) {
    e?.preventDefault?.();
    setLoading(true);

    // client side validation (basic)
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.warn("Please enter a valid email.");
      setLoading(false);
      return;
    }
    if (!password || password.length < 6) {
      toast.warn("Please enter a password with at least 6 characters.");
      setLoading(false);
      return;
    }

    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      const user = res.user;

      if (!user.emailVerified) {
        const resend = window.confirm("Email not verified. Resend verification email?");
        if (resend) {
          await sendEmailVerification(user, {
            url: `${window.location.origin}/finishVerify`,
            handleCodeInApp: true,
          });
          toast.success("Verification email sent. Check inbox/spam.");
        }
        await auth.signOut();
        setLoading(false);
        return;
      }

      await ensureUserDoc(user);

      // prefer role claim from ID token (for paid plan)
      const idTokenResult = await user.getIdTokenResult(true);
      let role = (idTokenResult.claims.role || "").toLowerCase();

      // fallback to users/{uid} (for free plan)
      if (!role) {
        try {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data?.role) role = String(data.role).toLowerCase();
          }
        } catch (err) {
          console.warn("Role fallback failed:", err);
        }
      }

      if (!role) role = "student";

      // --- CHANGE 1: Rejection Logic ---
      // if user came to admin/supervisor login page but has wrong role -> reject
      if (intentRole === "admin" && !["admin", "supervisor"].includes(role)) {
        await auth.signOut();
        toast.error("This account is not an admin or supervisor account.");
        setLoading(false);
        return;
      }

      // store token/role in localStorage for quick checks (not a security boundary)
      try {
        const token = await user.getIdToken();
        localStorage.setItem("rcf_id_token", token);
        localStorage.setItem("rcf_user_role", role);
      } catch (e) {
        console.warn("Failed writing token to localStorage", e);
      }

      // --- CHANGE 2: Redirect Logic ---
      if (role === "admin") nav("/admin");
      else if (role === "supervisor") nav("/supervisor"); // Added supervisor redirect
      else if (role === "institute") nav("/institute/profile");
      else nav("/student/profile");

    } catch (err) {
      console.error("Login error:", err);
      toast.error(err.message || "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  // Registration logic unchanged but uses toast
  const [showRegister, setShowRegister] = useState(false);
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  async function handleRegister(e) {
    e?.preventDefault?.();
    setRegLoading(true);

    if (!/^\S+@\S+\.\S+$/.test(regEmail)) {
      toast.warn("Enter a valid email.");
      setRegLoading(false);
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      toast.warn("Password must be at least 6 characters.");
      setRegLoading(false);
      return;
    }

    try {
      const res = await createUserWithEmailAndPassword(auth, regEmail, regPassword);
      const user = res.user;

      const resolvedRole = intentRole === "institute" ? "institute" : "student";

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

      await sendEmailVerification(user, {
        url: `${window.location.origin}/finishVerify`,
        handleCodeInApp: true,
      });

      toast.success("Registration successful — verification email sent.");
      setShowRegister(false);
      setRegEmail("");
      setRegPassword("");
      setEmail(user.email || "");
    } catch (err) {
      console.error("Register error:", err);
      toast.error(err.message || "Registration failed");
    } finally {
      setRegLoading(false);
    }
  }

  // Forgot password
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  async function handleForgot(e) {
    e?.preventDefault?.();
    setForgotLoading(true);
    try {
      await sendPasswordResetEmail(auth, forgotEmail, {
        url: `${window.location.origin}/finishVerify`,
        handleCodeInApp: true,
      });
      toast.success("Password reset email sent. Check inbox/spam.");
      setForgotEmail("");
      setShowForgot(false);
    } catch (err) {
      console.error("Forgot password error:", err);
      toast.error(err.message || "Failed to send reset email");
    } finally {
      setForgotLoading(false);
    }
  }

  /* ------------------ UI (kept nearly identical) ------------------ */
  return (
    <div style={wrap}>
      <div style={leftPane}>
        <div style={{ padding: "20px", textAlign: "center" }}>
          <img
            src={logo}
            alt="Logo"
            style={{ width: "100px", cursor: "pointer" }}
            onClick={() => nav("/")}
          />
          <h1 style={leftHeading}>Rashtriya Chemical and Fertilizer Limited</h1>
        </div>
      </div>

      <div style={rightPane}>
        <div style={cardWrap}>
          {showForgot ? (
            <div style={card}>
              <h2>Reset Password</h2>
              <form onSubmit={handleForgot}>
                <input type="email" placeholder="Email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required style={input} />
                <button type="submit" disabled={forgotLoading} style={primaryBtn}>{forgotLoading ? "Sending..." : "Send reset email"}</button>
              </form>
              <div style={{ marginTop: 20 }}>
                <button onClick={() => setShowForgot(false)} style={linkBtn}>← Back to sign in</button>
              </div>
            </div>
          ) : !showRegister ? (
            <div style={card}>
              {/* --- CHANGE 3: UI Title --- */}
              <h2 style={{ marginBottom: 20 }}>{intentRole === "admin" ? "Admin / Supervisor Login" : intentRole === "institute" ? "Institute Login" : "Student Login"}</h2>

              <form onSubmit={handleLogin}>
                <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={input} />
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={input} />
                <button type="submit" disabled={loading} style={primaryBtn}>{loading ? "Signing in…" : "Sign in"}</button>
              </form>

              <div style={{ marginTop: 35, display: "flex", justifyContent: "space-between", width: "100%" }}>
                <button onClick={() => setShowForgot(true)} style={linkBtn}>Forgot password?</button>
                {intentRole !== "admin" ? <button onClick={() => setShowRegister(true)} style={linkBtn}>Register</button> : <div />}
              </div>
            </div>
          ) : (
            <div style={card}>
              <h2>Register ({intentRole === "institute" ? "Institute" : "Student"})</h2>
              <form onSubmit={handleRegister}>
                <input type="email" placeholder="Email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required style={input} />
                <input type="password" placeholder="Password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required style={input} />
                <button type="submit" disabled={regLoading} style={primaryBtn}>{regLoading ? "Registering..." : "Register"}</button>
              </form>
              <div style={{ marginTop: 35 }}>
                <button onClick={() => setShowRegister(false)} style={linkBtn}>← Back to sign in</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Styles (kept same) ---------- */
const wrap = { position: "fixed", inset: 0, display: "flex", width: "100vw", height: "100vh", overflow: "hidden" };
const leftPane = { flex: "0 0 25%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center" };
const leftHeading = { marginTop: "20px", fontSize: "40px", fontWeight: "700", color: "#006400", textAlign: "center", lineHeight: "1.4" };
const rightPane = { flex: "0 0 75%", height: "100%", background: "#ffffff", display: "flex", flexDirection: "column" };
const cardWrap = { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px" };
const card = { width: 550, padding: 28, borderRadius: 12, background: "#fff", boxShadow: "0 6px 20px rgba(0,0,0,0.08)", textAlign: "center" };
const input = { width: "80%", padding: "12px 12px", marginTop: 20, borderRadius: 8, border: "1px solid #ddd", fontSize: 14 };
const primaryBtn = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "none", marginTop: 25, background: "#28a745", color: "white", fontWeight: 600, cursor: "pointer" };
const linkBtn = { background: "transparent", border: "none", color: "#0066cc", cursor: "pointer", padding: 0, fontSize: 14 };