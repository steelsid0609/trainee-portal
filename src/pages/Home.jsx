import React from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png"; // your company logo

export default function Home() {
  const nav = useNavigate();

  return (
    <div
      style={{
        height: "98vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          background: "white",
          padding: "40px",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          maxWidth: "400px",
          width: "100%",
          textAlign: "center",
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: "20px" }}>
          <img
            src={logo}
            alt="Company Logo"
            style={{ width: "80px", marginBottom: "10px" }}
          />
          <h2 style={{ margin: "10px 0", color: "#006400" }}>
            Rashtriya Chemical and Fertilizer Limited
          </h2>
          <p style={{ fontWeight: "bold", color: "#444" }}>
            Training & Internship Portal
          </p>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <button onClick={() => nav("/login?role=student")} style={buttonStyle}>
            Student Login
          </button>

          <button
            onClick={() => nav("/login?role=institute")}
            style={buttonStyle}
          >
            Institute Login
          </button>

          <button
            onClick={() => nav("/login?role=admin")}
            style={{ ...buttonStyle, background: "#cc0000" }}
          >
            Admin Login
          </button>
        </div>
      </div>
    </div>
  );
}

const buttonStyle = {
  padding: "12px",
  fontSize: "16px",
  fontWeight: "bold",
  border: "none",
  borderRadius: "8px",
  background: "#28a745",
  color: "white",
  cursor: "pointer",
  transition: "0.3s",
};
