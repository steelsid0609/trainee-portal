// src/pages/FinishVerify.jsx
import React, { useEffect, useState } from "react";
import { applyActionCode, checkActionCode } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function FinishVerify() {
  const [status, setStatus] = useState("checking");
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      const url = window.location.href;
      // The verification link contains an oobCode parameter
      const params = new URLSearchParams(window.location.search);
      const oobCode = params.get("oobCode");
      if (!oobCode) {
        setStatus("no-code");
        return;
      }

      try {
        // optional: checkActionCode to inspect info
        await checkActionCode(auth, oobCode);
        await applyActionCode(auth, oobCode); // verifies the email
        setStatus("done");
        alert("Email verified! You may now sign in.");
        nav("/login");
      } catch (err) {
        console.error("verify error", err);
        setStatus("error");
      }
    })();
  }, [nav]);

  if (status === "checking") return <div>Verifying...</div>;
  if (status === "done") return <div>Verified — redirecting...</div>;
  if (status === "error") return <div>Verification failed. The link may be invalid or expired.</div>;
  return <div>Invalid request.</div>;
}
