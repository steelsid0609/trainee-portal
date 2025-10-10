// src/pages/FinishVerify.jsx
import React, { useEffect, useState } from "react";
import { applyActionCode, checkActionCode } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export default function FinishVerify() {
  const [status, setStatus] = useState("checking"); // checking | need-code | processing | done | error | invalid
  const [errorMessage, setErrorMessage] = useState("");
  const [manualCode, setManualCode] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    // Helper: get oobCode from query or hash (some email clients put params in fragment)
    function extractOobCode() {
      try {
        const qs = new URLSearchParams(window.location.search || "");
        let code = qs.get("oobCode");
        if (code) return { code, mode: qs.get("mode") || null };

        // Try to read from the fragment/hash part (after #)
        // Example hash: "#/finishVerify?oobCode=XXX&mode=verifyEmail"
        const hash = window.location.hash || "";
        if (hash) {
          const idx = hash.indexOf("?");
          const params = idx >= 0 ? new URLSearchParams(hash.slice(idx + 1)) : new URLSearchParams(hash);
          code = params.get("oobCode");
          if (code) return { code, mode: params.get("mode") || null };
        }

        return null;
      } catch (e) {
        console.warn("extractOobCode error", e);
        return null;
      }
    }

    (async () => {
      setStatus("checking");
      const found = extractOobCode();
      if (!found || !found.code) {
        setStatus("need-code");
        return;
      }

      const { code, mode } = found;

      // If there is a 'mode' param and it's not verifyEmail, show an informative message
      if (mode && mode !== "verifyEmail") {
        setStatus("invalid");
        setErrorMessage(`This link is for "${mode}". Use the correct flow.`);
        return;
      }

      setStatus("processing");
      try {
        // Optional: checkActionCode can give metadata about the code (email etc)
        await checkActionCode(auth, code);
        // applyActionCode actually applies the verification
        await applyActionCode(auth, code);
        setStatus("done");
        toast.success("Email verified! Redirecting to sign-in...");
        // small delay so user sees toast then redirect
        setTimeout(() => nav("/login"), 1400);
      } catch (err) {
        console.error("verify error", err);
        setStatus("error");
        // pick a friendly message
        setErrorMessage(err?.message || String(err) || "Verification failed. The link may be invalid or expired.");
      }
    })();
    // we only want to run this on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav]);

  async function handleManualSubmit(e) {
    e.preventDefault();
    const code = (manualCode || "").trim();
    if (!code) return toast.warn("Enter code from the email (oobCode).");
    setStatus("processing");
    try {
      await checkActionCode(auth, code);
      await applyActionCode(auth, code);
      setStatus("done");
      toast.success("Email verified! Redirecting to sign-in...");
      setTimeout(() => nav("/login"), 1200);
    } catch (err) {
      console.error("manual verify error", err);
      setStatus("error");
      setErrorMessage(err?.message || "Failed to apply the code. It may be expired/invalid.");
    }
  }

  return (
    <div style={{ padding: 24 }}>
      {status === "checking" && <div>Checking verification link...</div>}

      {status === "processing" && <div>Verifying your email — please wait...</div>}

      {status === "done" && <div>Verified — redirecting to sign-in...</div>}

      {status === "need-code" && (
        <div>
          <h3>Verification link incomplete</h3>
          <p>
            We couldn't find a verification code in the link you opened. This can happen
            if the email client removed parameters, or if you opened a shortened link.
          </p>

          <p>
            <strong>What to do:</strong>
          </p>
          <ol>
            <li>Open the verification email and click the link again (preferably in the same browser).</li>
            <li>If that doesn't work, click "Copy link" in the email and paste the full URL into the box below.</li>
          </ol>

          <form onSubmit={handleManualSubmit} style={{ marginTop: 12 }}>
            <label style={{ display: "block", marginBottom: 6 }}>Paste the full verification URL or oobCode:</label>
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Paste the full link or oobCode here"
              style={{ width: "90%", padding: 8, marginRight: 8 }}
            />
            <button type="submit" style={{ padding: "8px 12px" }}>Verify</button>
          </form>

          <div style={{ marginTop: 12 }}>
            <small>
              Tip: the verification link should contain a parameter named <code>oobCode</code> (or paste only the code).
            </small>
          </div>
        </div>
      )}

      {status === "invalid" && (
        <div>
          <h3>Invalid link type</h3>
          <p>{errorMessage || "This verification link appears to be for a different action."}</p>
        </div>
      )}

      {status === "error" && (
        <div>
          <h3>Verification failed</h3>
          <p style={{ color: "crimson" }}>{errorMessage}</p>
          <p>Try opening the link again from your email, or paste the link/code below.</p>

          <form onSubmit={handleManualSubmit} style={{ marginTop: 12 }}>
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Paste the full link or oobCode here"
              style={{ width: "90%", padding: 8, marginRight: 8 }}
            />
            <button type="submit" style={{ padding: "8px 12px" }}>Verify</button>
          </form>
        </div>
      )}
    </div>
  );
}
