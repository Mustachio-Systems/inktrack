import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';

// Full Physical View Core Matrix
import Landing from './views/Landing/Landing';
import Auth from './views/Auth/Auth';
import Dashboard from './views/Dashboard/Dashboard';

// 🔐 Reads the stored session token and does a lightweight local check on
// its `exp` claim. This does NOT verify the signature (only the API can do
// that) — it just avoids trusting an obviously-expired token on first paint.
// Anything that slips past this still gets caught by Dashboard's authFetch,
// which force-logs-out on a 401 from the API.
function hasUsableToken(): boolean {
  const token = localStorage.getItem('inktrack_token');
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return true;
    return Math.floor(Date.now() / 1000) < payload.exp;
  } catch {
    return false;
  }
}

export default function App() {
  // 🛡️ Lazy initializer so this only runs once on mount, not every render.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(hasUsableToken);

  return (
    <Router>
      <Routes>
        {/* Core Marketing Shell */}
        <Route path="/" element={<Landing />} />

        {/* Dynamic State Sign-in/Sign-up Forms */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Auth setAuth={setIsAuthenticated} mode="login" />}
        />
        <Route
          path="/signup"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Auth setAuth={setIsAuthenticated} mode="signup" />}
        />

        {/* Protected Ledger Routing */}
        <Route
          path="/dashboard"
          element={isAuthenticated ? <Dashboard setAuth={setIsAuthenticated} /> : <Navigate to="/login" replace />}
        />

        {/* Global Boundary Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}