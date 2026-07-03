import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';

// Full Physical View Core Matrix
import Landing from './views/Landing/Landing';
import Auth from './views/Auth/Auth';
import Dashboard from './views/Dashboard/Dashboard';
import ResetPassword from './views/Auth/ResetPassword';

// 🔐 Reads the stored session token and does a lightweight local check on
// its `exp` claim. This does NOT verify the signature — only the API can do
// that. It just avoids using an obviously expired token on first load.
function hasUsableToken(): boolean {
  const token = localStorage.getItem('inktrack_token');

  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));

    if (!payload.exp) return true;

    return Math.floor(Date.now() / 1000) < payload.exp;
  } catch {
    localStorage.removeItem('inktrack_token');
    return false;
  }
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(hasUsableToken);

  return (
    <Router>
      <Routes>
        {/* Marketing / landing page */}
        <Route path="/" element={<Landing />} />

        {/* Authentication */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Auth setAuth={setIsAuthenticated} mode="login" />
            )
          }
        />

        <Route
          path="/signup"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Auth setAuth={setIsAuthenticated} mode="signup" />
            )
          }
        />

        {/* Password reset must remain public.
            The artist arrives here from:
            /reset-password?token=... */}
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected ledger */}
        <Route
          path="/dashboard"
          element={
            isAuthenticated ? (
              <Dashboard setAuth={setIsAuthenticated} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        {/* Keep this last so valid routes do not fall into it */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}