import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword"; // <-- semicolon added
import StudentProfile from "./pages/StudentProfile";
import FinishVerify from "./pages/FinishVerify";
import AdminDashboard from "./pages/AdminPanel"; // <-- make sure this path exists
import AdminRoute from "./routes/AdminRoute";
import bgImage from "./assets/bg.jpg";

function NotFound() {
  return <div style={{ padding: 32 }}>404 – Page not found</div>;
}

export default function App() {
  return (
    <>
      {/* Fixed background */}
      <div
        className="app-bg-fixed"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          backgroundImage: `url(${bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
      {/* Foreground app area */}
      <div
        className="app-inner-scroll"
        style={{ position: "relative", zIndex: 1, minHeight: "100vh" }}
      >
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot" element={<ForgotPassword />} />
          <Route path="/finishVerify" element={<FinishVerify />} />
          <Route path="/student/profile" element={<StudentProfile />} />

          {/* Admin (protected) */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </>
  );
}


/*export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/auth" element={<AuthRequest />} />
      <Route path="/finishSignIn" element={<FinishSignIn />} />
      <Route path="/student/profile" element={<StudentProfile />} />
      <Route path="/admin" element={<AdminPanel />} />
    </Routes>
  );
}
*/
