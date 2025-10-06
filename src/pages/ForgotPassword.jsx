// src/pages/ForgotPassword.jsx
import React, { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSend(e) {
    e.preventDefault();
    try {
      await sendPasswordResetEmail(auth, email, { url: `${window.location.origin}/finishReset`, handleCodeInApp: true });
      setSent(true);
    } catch (err) {
      console.error(err);
      alert("Error sending reset email: " + err.message);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Forgot password</h2>
      {sent ? <div>Reset email sent. Check your inbox.</div> : (
        <form onSubmit={handleSend}>
          <input type="email" placeholder="your email" value={email} onChange={e=>setEmail(e.target.value)} required />
          <button type="submit">Send reset link</button>
        </form>
      )}
    </div>
  );
}
