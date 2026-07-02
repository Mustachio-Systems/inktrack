import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, Mail, User, ShieldAlert } from 'lucide-react';

interface AuthProps {
  setAuth: (val: boolean) => void;
  mode: 'login' | 'signup';
}

export default function Auth({ setAuth, mode }: AuthProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [artistName, setArtistName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Strict Client-Side Input Validation (QA Layer Pre-flight check)
    if (!email || !password || (mode === 'signup' && !artistName)) {
      setError('All credential fields must be properly populated.');
      return;
    }

    if (password.length < 6) {
      setError('Security parameter check failed: Password requires minimum 6 characters.');
      return;
    }

    // Explicit Auth Mutation Bypass (To be linked with Supabase/D1 token validation)
    setAuth(true);
    navigate('/dashboard');
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
            {mode === 'login' ? 'Secure ledger gateway for authorized artists' : 'Provision your independent accounting instance'}
          </p>
        </div>

        {/* Auth Panel Matrix */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl shadow-black/40">
          <h2 className="text-xl font-bold tracking-tight text-zinc-100 mb-6">
            {mode === 'login' ? 'Sign In to Studio' : 'Create Artist Profile'}
          </h2>

          {error && (
            <div className="bg-red-950/40 border border-red-900/60 p-3 rounded-xl flex items-center gap-2 text-sm text-red-400 mb-5 animate-headShake">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Professional/Artist Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-3.5 h-4 w-4 text-zinc-500" />
                  <input 
                    type="text"
                    value={artistName}
                    onChange={(e) => setArtistName(e.target.value)}
                    placeholder="e.g., Alex Ink"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-emerald-500 text-zinc-100 placeholder:text-zinc-600 transition-colors"
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="artist@studio.com"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-emerald-500 text-zinc-100 placeholder:text-zinc-600 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Password Matrix</label>
              <div className="relative">
                <KeyRound className="absolute left-4 top-3.5 h-4 w-4 text-zinc-500" />
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-emerald-500 text-zinc-100 placeholder:text-zinc-600 transition-colors"
                />
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold py-3 rounded-xl text-sm transition-colors mt-2 shadow-md shadow-emerald-500/5"
            >
              {mode === 'login' ? 'Authenticate Token' : 'Initialize Account Record'}
            </button>
          </form>

          <div className="border-t border-zinc-800/80 mt-6 pt-6 text-center text-xs text-zinc-500">
            {mode === 'login' ? (
              <span>New to the suite? <Link to="/signup" className="text-emerald-400 font-semibold hover:underline">Provision account</Link></span>
            ) : (
              <span>Already registered? <Link to="/login" className="text-emerald-400 font-semibold hover:underline">Return to validation</Link></span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}