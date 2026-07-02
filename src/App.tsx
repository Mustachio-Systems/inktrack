import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';

// Full Physical View Core Matrix
import Landing from './views/Landing/Landing';
import Auth from './views/Auth/Auth';
import Dashboard from './views/Dashboard/Dashboard';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

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