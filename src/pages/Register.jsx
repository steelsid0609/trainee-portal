// src/pages/Register.jsx
import React, { useState } from "react";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  async function handleRegister(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      // send verification link
      await sendEmailVerification(res.user, {
        url: `${window.location.origin}/finishVerify`,
        handleCodeInApp: true
      });
      alert("Registration success — a verification email was sent. Please check your inbox.");
      nav("/"); // or to a page telling user to verify
    } catch (err) {
      console.error(err);
      alert("Register error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Register</h2>
      <form onSubmit={handleRegister}>
        <input type="email" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} required/>
        <br/>
        <input type="password" placeholder="password" value={password} onChange={e=>setPassword(e.target.value)} required />
        <br/>
        <button type="submit" disabled={loading}>{loading ? "Registering..." : "Register"}</button>
      </form>
    </div>
  );
}
