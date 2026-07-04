import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, Mail, User, ShieldAlert, ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react';

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

  const resetFeedback = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const switchTo = (mode: AuthViewMode) => {
    setViewMode(mode);
    resetFeedback();
  };

  // 🛡️ Pre-flight Input Validation Engine
  const validateForm = (): boolean => {
    if (!email) {
      setError('An email address is required.');
      return false;
    }

    if (viewMode !== 'forgot') {
      if (!password) {
        setError('Password cannot be blank.');
        return false;
      }
      if (password.length < 8) {
        setError('Password needs at least 8 characters.');
        return false;
      }
    }

    if (viewMode === 'signup' && !artistName.trim()) {
      setError('Your artist name is required.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();

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
          body: JSON.stringify({ email: email.trim(), password }),
        });

        const data = await response.json() as any;

        if (!response.ok) {
          throw new Error(data.error || 'Could not verify those credentials.');
        }

        // 🛡️ Lock down the session JWT token string safely
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
          body: JSON.stringify({ email: email.trim(), password, artistName: artistName.trim() }),
        });

        const data = await response.json() as any;

        if (!response.ok) {
          throw new Error(data.error || 'Could not create your account.');
        }

        setViewMode('login');
        setPassword('');
        setSuccessMessage('Ledger opened. Sign in to reach your dashboard.');
      }

      // ---------------------------------------------------------
      // 🔑 SUBMIT ROUTE 3: INITIALIZE PASSWORD RESET LOOP
      // ---------------------------------------------------------
      else if (viewMode === 'forgot') {
        const response = await fetch(`${BASE_API}/api/auth/forgot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });

        const data = await response.json() as any;

        if (!response.ok) {
          throw new Error(data.error || 'Could not send the reset link.');
        }

        setSuccessMessage('If that email has a ledger, a reset link is on its way.');
      }
    } catch (err: any) {
      setError(err?.message || 'Connection timed out. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#16130F] text-[#EFE7D8] min-h-screen flex flex-col justify-center items-center px-6 py-12 font-[Inter,sans-serif]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rye&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .font-display { font-family: 'Rye', serif; }
        .font-mono-ledger { font-family: 'IBM Plex Mono', monospace; }
        .font-body { font-family: 'IBM Plex Sans', sans-serif; }
      `}</style>

      <div className="w-full max-w-md font-body">
        {/* Brand anchor */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C39A48] rounded">
            <div className="h-9 w-9 rounded-full border-2 border-[#C39A48] bg-[#A83A2C] flex items-center justify-center font-display text-lg">
              i
            </div>
            <span className="text-2xl font-display tracking-wide">
              inktrack<span className="text-[#C39A48]">.</span>
            </span>
          </Link>
          <p className="text-sm text-[#EFE7D8]/55 mt-3">
            {viewMode === 'login' && 'Sign back into your ledger'}
            {viewMode === 'signup' && "Open your shop's ledger — free"}
            {viewMode === 'forgot' && "We'll send a link to get you back in"}
          </p>
        </div>

        {/* Auth card — styled like a paper ticket */}
        <div className="bg-[#EFE7D8] text-[#16130F] rounded-sm p-8 shadow-2xl shadow-black/50">

          <div className="flex items-center justify-between mb-6 border-b border-dashed border-[#16130F]/15 pb-5">
            <div>
              <p className="font-mono-ledger text-[10px] uppercase tracking-[0.2em] text-[#16130F]/40 mb-1">
                {viewMode === 'login' && 'Access'}
                {viewMode === 'signup' && 'New Account'}
                {viewMode === 'forgot' && 'Recovery'}
              </p>
              <h2 className="font-display text-2xl">
                {viewMode === 'login' && 'Sign In'}
                {viewMode === 'signup' && 'Start Your Ledger'}
                {viewMode === 'forgot' && 'Reset Password'}
              </h2>
            </div>
            {viewMode === 'forgot' && (
              <button
                onClick={() => switchTo('login')}
                className="text-[#16130F]/50 hover:text-[#16130F] text-xs font-semibold flex items-center gap-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A83A2C] rounded p-1"
              >
                <ArrowLeft className="w-3 h-3" /> Back
              </button>
            )}
          </div>

          {/* Flash feedback */}
          {error && (
            <div className="bg-[#A83A2C]/10 border border-[#A83A2C]/30 p-3 rounded-sm flex items-center gap-2 mb-5">
              <ShieldAlert className="w-4 h-4 shrink-0 text-[#A83A2C]" />
              <span className="font-mono-ledger text-xs font-semibold text-[#A83A2C]">{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-[#3F6B62]/10 border border-[#3F6B62]/30 p-3 rounded-sm flex items-center gap-2 mb-5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#2F544A]" />
              <span className="font-mono-ledger text-xs font-semibold text-[#2F544A]">{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {viewMode === 'signup' && (
              <div>
                <label className="block text-[11px] font-mono-ledger font-semibold text-[#16130F]/50 uppercase tracking-wider mb-2">
                  Artist Name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-3.5 h-4 w-4 text-[#16130F]/40" />
                  <input
                    type="text"
                    disabled={isLoading}
                    value={artistName}
                    onChange={(e) => setArtistName(e.target.value)}
                    placeholder="e.g., Alex Ink"
                    className="w-full bg-white border border-[#16130F]/15 rounded-sm py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-[#A83A2C] text-[#16130F] placeholder:text-[#16130F]/30 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-mono-ledger font-semibold text-[#16130F]/50 uppercase tracking-wider mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 h-4 w-4 text-[#16130F]/40" />
                <input
                  type="email"
                  disabled={isLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="artist@studio.com"
                  className="w-full bg-white border border-[#16130F]/15 rounded-sm py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-[#A83A2C] text-[#16130F] placeholder:text-[#16130F]/30 transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            {viewMode !== 'forgot' && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[11px] font-mono-ledger font-semibold text-[#16130F]/50 uppercase tracking-wider">
                    Password
                  </label>
                  {viewMode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchTo('forgot')}
                      className="text-xs text-[#A83A2C] hover:underline font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A83A2C] rounded"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-3.5 h-4 w-4 text-[#16130F]/40" />
                  <input
                    type="password"
                    disabled={isLoading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white border border-[#16130F]/15 rounded-sm py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-[#A83A2C] text-[#16130F] placeholder:text-[#16130F]/30 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#A83A2C] hover:bg-[#c04430] disabled:bg-[#16130F]/15 disabled:text-[#16130F]/40 text-[#EFE7D8] font-bold py-3.5 rounded-sm text-sm transition-colors mt-2 shadow-md flex items-center justify-center gap-2 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16130F]"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                <>
                  {viewMode === 'login' && 'Sign In'}
                  {viewMode === 'signup' && 'Create My Ledger'}
                  {viewMode === 'forgot' && 'Send Reset Link'}
                </>
              )}
            </button>
          </form>

          {/* Context switching footers */}
          <div className="border-t border-dashed border-[#16130F]/15 mt-6 pt-6 text-center text-xs text-[#16130F]/50">
            {viewMode === 'login' && (
              <span>
                New here?{' '}
                <button
                  onClick={() => switchTo('signup')}
                  className="text-[#A83A2C] font-semibold hover:underline bg-transparent border-none cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A83A2C] rounded"
                >
                  Start your ledger
                </button>
              </span>
            )}
            {viewMode === 'signup' && (
              <span>
                Already have a ledger?{' '}
                <button
                  onClick={() => switchTo('login')}
                  className="text-[#A83A2C] font-semibold hover:underline bg-transparent border-none cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A83A2C] rounded"
                >
                  Sign in
                </button>
              </span>
            )}
            {viewMode === 'forgot' && (
              <span>
                Remembered it?{' '}
                <button
                  onClick={() => switchTo('login')}
                  className="text-[#A83A2C] font-semibold hover:underline bg-transparent border-none cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A83A2C] rounded"
                >
                  Sign in here
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}