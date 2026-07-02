import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, Mail, User, ShieldAlert, ArrowLeft, RefreshCw } from 'lucide-react';

interface AuthProps {
  setAuth: (val: boolean) => void;
  mode: 'login' | 'signup';
}

type AuthViewMode = 'login' | 'signup' | 'forgot';

export default function Auth({ setAuth, mode: initialMode }: AuthProps) {
  const navigate = useNavigate();
  
  // 🔄 Dynamic View-State Machine Manager
  const [viewMode, setViewMode] = useState<AuthViewMode>(initialMode);
  
  // 💾 Form Buffers
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [artistName, setArtistName] = useState('');
  
  // Status Managers
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 🛡️ Pre-flight Input Validation Engine
  const validateForm = (): boolean => {
    if (!email) {
      setError('A valid email destination must be declared.');
      return false;
    }
    
    if (viewMode !== 'forgot') {
      if (!password) {
        setError('Password credentials cannot be blank.');
        return false;
      }
      if (password.length < 8) {
        setError('Security check failed: Password requires a minimum of 8 characters.');
        return false;
      }
    }
    
    if (viewMode === 'signup' && !artistName.trim()) {
      setError('Professional artist identifier name is required.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!validateForm()) return;
    setIsLoading(true);

    // 🌐 Dynamic Environment API Routing Matrix
    const BASE_API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:8787'
      : 'https://inktrack-api.lapgonzalez96.workers.dev';

    try {
      // ---------------------------------------------------------
      // 🔓 SUBMIT ROUTE 1: AUTHENTICATE / SIGN IN
      // ---------------------------------------------------------
      if (viewMode === 'login') {
        const response = await fetch(`${BASE_API}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json() as any;

        if (!response.ok) {
          throw new Error(data.error || 'Identity credentials validation failed.');
        }

        // 🛡️ QA DATA BOUNDARY POLICY: Lock down the session JWT token string safely
        localStorage.setItem('inktrack_token', data.token);
        
        setAuth(true);
        navigate('/dashboard');
      } 
      
      // ---------------------------------------------------------
      // 📝 SUBMIT ROUTE 2: PROVISION PROFILE / SIGN UP
      // ---------------------------------------------------------
      else if (viewMode === 'signup') {
        const response = await fetch(`${BASE_API}/api/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, artistName }),
        });

        const data = await response.json() as any;

        if (!response.ok) {
          throw new Error(data.error || 'Profile initiation encountered a structural issue.');
        }

        setSuccessMessage('Profile initiated securely! Authenticate your token to access the studio dashboard.');
        setViewMode('login');
        setPassword(''); // Clear security fields
      } 
      
      // ---------------------------------------------------------
      // 🔑 SUBMIT ROUTE 3: INITIALIZE PASSWORD RESET LOOP
      // ---------------------------------------------------------
      else if (viewMode === 'forgot') {
        const response = await fetch(`${BASE_API}/api/auth/forgot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        const data = await response.json() as any;

        if (!response.ok) {
          throw new Error(data.error || 'Verification network transmission error.');
        }

        setSuccessMessage('If this configuration profile exists, an authorized verification sequence has initialized.');
      }
    } catch (err: any) {
      setError(err?.message || 'A network communication timeout occurred inside the authorization engine.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-zinc-950 text-zinc-50 min-h-screen flex flex-col justify-center items-center px-6 py-12">
      
      <div className="w-full max-w-md">
        {/* Brand Anchor */}
        <div className="text-center mb-8">
          <Link to="/" className="text-3xl font-black tracking-tighter text-zinc-100">
            inktrack<span className="text-emerald-400">.</span>
          </Link>
          <p className="text-sm text-zinc-400 mt-2">
            {viewMode === 'login' && 'Secure ledger gateway for authorized artists'}
            {viewMode === 'signup' && 'Provision your independent accounting instance'}
            {viewMode === 'forgot' && 'Issue standard cryptographic password recovery link'}
          </p>
        </div>

        {/* Auth Panel Matrix */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl shadow-black/40">
          
          {/* Header Action Row */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold tracking-tight text-zinc-100">
              {viewMode === 'login' && 'Sign In to Studio'}
              {viewMode === 'signup' && 'Create Artist Profile'}
              {viewMode === 'forgot' && 'Reset Password'}
            </h2>
            {viewMode === 'forgot' && (
              <button 
                onClick={() => { setViewMode('login'); setError(null); setSuccessMessage(null); }}
                className="text-zinc-500 hover:text-zinc-300 text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-3 h-3" /> Back
              </button>
            )}
          </div>

          {/* Flash Feedback Indicators */}
          {error && (
            <div className="bg-red-950/40 border border-red-900/60 p-3 rounded-xl flex items-center gap-2 text-sm text-red-400 mb-5">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span className="font-medium text-xs">{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-950/40 border border-emerald-900/60 p-3 rounded-xl flex items-center gap-2 text-sm text-emerald-400 mb-5">
              <span className="font-medium text-xs">{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {viewMode === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Professional/Artist Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-3.5 h-4 w-4 text-zinc-500" />
                  <input 
                    type="text"
                    disabled={isLoading}
                    value={artistName}
                    onChange={(e) => setArtistName(e.target.value)}
                    placeholder="e.g., Alex Ink"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-emerald-500 text-zinc-100 placeholder:text-zinc-600 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Secure Email Endpoint</label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 h-4 w-4 text-zinc-500" />
                <input 
                  type="email"
                  disabled={isLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="artist@studio.com"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-emerald-500 text-zinc-100 placeholder:text-zinc-600 transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            {viewMode !== 'forgot' && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">Password Matrix</label>
                  {viewMode === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setViewMode('forgot'); setError(null); setSuccessMessage(null); }}
                      className="text-xs text-emerald-400 hover:underline font-semibold"
                    >
                      Forgot access key?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-3.5 h-4 w-4 text-zinc-500" />
                  <input 
                    type="password"
                    disabled={isLoading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-emerald-500 text-zinc-100 placeholder:text-zinc-600 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 text-zinc-950 disabled:text-zinc-600 font-bold py-3 rounded-xl text-sm transition-colors mt-2 shadow-md flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Verifying Parameters...
                </>
              ) : (
                <>
                  {viewMode === 'login' && 'Authenticate Token'}
                  {viewMode === 'signup' && 'Initialize Account Record'}
                  {viewMode === 'forgot' && 'Send Verification Token'}
                </>
              )}
            </button>
          </form>

          {/* Context Switching Footers */}
          <div className="border-t border-zinc-800/80 mt-6 pt-6 text-center text-xs text-zinc-500">
            {viewMode === 'login' && (
              <span>New to the suite? <button onClick={() => { setViewMode('signup'); setError(null); setSuccessMessage(null); }} className="text-emerald-400 font-semibold hover:underline bg-transparent border-none cursor-pointer">Provision account</button></span>
            )}
            {viewMode === 'signup' && (
              <span>Already registered? <button onClick={() => { setViewMode('login'); setError(null); setSuccessMessage(null); }} className="text-emerald-400 font-semibold hover:underline bg-transparent border-none cursor-pointer">Return to validation</button></span>
            )}
            {viewMode === 'forgot' && (
              <span>Remembered details? <button onClick={() => { setViewMode('login'); setError(null); setSuccessMessage(null); }} className="text-emerald-400 font-semibold hover:underline bg-transparent border-none cursor-pointer">Log in here</button></span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}