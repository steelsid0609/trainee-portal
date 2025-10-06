import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { sendSignInLinkToEmail } from "firebase/auth";
import { auth } from "../firebase";
import logo from "../assets/transparent-logo.png";

export default function AuthRequest() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState(null);
  const [params] = useSearchParams();
  const nav = useNavigate();
  const role = params.get("role") || "student";

  const actionCodeSettings = {
    url: `${window.location.origin}/finishSignIn?role=${encodeURIComponent(role)}`,
    handleCodeInApp: true,
  };

  async function handleSend(e) {
    e.preventDefault();
    if (!email) {
      alert("Enter email");
      return;
    }
    try {
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem("emailForSignIn", email);
      setSentTo(email);
      alert("Link sent. Open the link in the same browser/device to finish sign-in.");
    } catch (err) {
      console.error("sendSignInLink error", err);
      alert("Error sending link: " + err.message);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* Left 25% - background (logo in center top) */}
      <div
        style={{
          flex: "0 0 25%",
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          paddingTop: "20px",
          boxSizing: "border-box",
        }}
      >
        <img
          src={logo}
          alt="Company Logo"
          style={{ width: "100px", cursor: "pointer" }}
          onClick={() => nav("/")}
        />
      </div>

      {/* Right 75% - white section */}
      <div
        style={{
          flex: "0 0 75%",
          background: "#ffffff",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header text */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #eee",
            fontSize: 20,
            fontWeight: 700,
            color: "#006400",
          }}
        >
          Rashtriya Chemical and Fertilizers
        </div>

        {/* Card container */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              background: "#fff",
              padding: "32px",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          >
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                textTransform: "uppercase",
                marginBottom: 24,
              }}
            >
              {role}  Login
            </h1>

            {sentTo ? (
              <div style={{ fontSize: 14 }}>
                Link sent to <strong>{sentTo}</strong>. Check your email.
              </div>
            ) : (
              <form
                onSubmit={handleSend}
                style={{
                  display: "flex",
                  gap: 12,
                  flexDirection: "row",
                  flexWrap: "wrap",
                }}
              >
                <input
                  type="email"
                  placeholder="Enter Your Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    flex: "1 1 260px",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #ccc",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #000",
                    background: "#000",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Verify
                </button>
              </form>
            )}

            <p style={{ fontSize: 12, marginTop: 50, color: "#555" }}>
              If you opened the link on a different device, return here and paste
              the same email to finish sign-in.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
