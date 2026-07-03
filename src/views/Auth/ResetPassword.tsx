import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

type Feedback = {
  type: 'success' | 'error';
  text: string;
} | null;

const getApiBaseUrl = () =>
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8787'
    : 'https://inktrack-api.lapgonzalez96.workers.dev';

export default function ResetPassword() {
  const navigate = useNavigate();

  const token = useMemo(
    () => new URLSearchParams(window.location.search).get('token')?.trim() ?? '',
    [],
  );

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const submitReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (!token) {
      setFeedback({
        type: 'error',
        text: 'This reset link is missing its security token. Request a new reset email.',
      });
      return;
    }

    if (newPassword.length < 8) {
      setFeedback({
        type: 'error',
        text: 'Your new password needs at least 8 characters.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback({
        type: 'error',
        text: 'The passwords do not match.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/auth/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });

      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.error || 'Could not reset your password.');
      }

      setFeedback({
        type: 'success',
        text: 'Password updated. Redirecting you to sign in…',
      });

      window.setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Connection failed. Try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#16130F] px-6 py-12 text-[#EFE7D8] flex items-center justify-center font-[Inter,sans-serif]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rye&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .font-display { font-family: 'Rye', serif; }
        .font-mono-ledger { font-family: 'IBM Plex Mono', monospace; }
        .font-body { font-family: 'IBM Plex Sans', sans-serif; }
      `}</style>

      <div className="w-full max-w-md font-body">
        <div className="mb-8 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C39A48]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#C39A48] bg-[#A83A2C] font-display text-lg">
              i
            </div>
            <span className="font-display text-2xl tracking-wide">
              inktrack<span className="text-[#C39A48]">.</span>
            </span>
          </Link>
          <p className="mt-3 text-sm text-[#EFE7D8]/55">
            Set a new password for your artist ledger
          </p>
        </div>

        <div className="rounded-sm bg-[#EFE7D8] p-8 text-[#16130F] shadow-2xl shadow-black/50">
          <div className="mb-6 flex items-center justify-between border-b border-dashed border-[#16130F]/15 pb-5">
            <div>
              <p className="mb-1 font-mono-ledger text-[10px] uppercase tracking-[0.2em] text-[#16130F]/40">
                Recovery
              </p>
              <h1 className="font-display text-2xl">Create New Password</h1>
            </div>

            <Link
              to="/login"
              className="flex items-center gap-1 rounded p-1 text-xs font-semibold text-[#16130F]/50 transition-colors hover:text-[#16130F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A83A2C]"
            >
              <ArrowLeft className="h-3 w-3" /> Sign in
            </Link>
          </div>

          {!token && (
            <div className="mb-5 flex items-start gap-2 rounded-sm border border-[#A83A2C]/30 bg-[#A83A2C]/10 p-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#A83A2C]" />
              <span className="font-mono-ledger text-xs font-semibold text-[#A83A2C]">
                This reset link is incomplete. Please request another reset email.
              </span>
            </div>
          )}

          {feedback && (
            <div
              className={`mb-5 flex items-start gap-2 rounded-sm border p-3 ${
                feedback.type === 'success'
                  ? 'border-[#3F6B62]/30 bg-[#3F6B62]/10'
                  : 'border-[#A83A2C]/30 bg-[#A83A2C]/10'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2F544A]" />
              ) : (
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#A83A2C]" />
              )}
              <span
                className={`font-mono-ledger text-xs font-semibold ${
                  feedback.type === 'success' ? 'text-[#2F544A]' : 'text-[#A83A2C]'
                }`}
              >
                {feedback.text}
              </span>
            </div>
          )}

          <form onSubmit={submitReset} className="space-y-5">
            <div>
              <label className="mb-2 block font-mono-ledger text-[11px] font-semibold uppercase tracking-wider text-[#16130F]/50">
                New Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-4 top-3.5 h-4 w-4 text-[#16130F]/40" />
                <input
                  type="password"
                  autoComplete="new-password"
                  disabled={isSubmitting || !token}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-sm border border-[#16130F]/15 bg-white py-3 pl-11 pr-4 text-sm text-[#16130F] placeholder:text-[#16130F]/30 transition-colors focus:border-[#A83A2C] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block font-mono-ledger text-[11px] font-semibold uppercase tracking-wider text-[#16130F]/50">
                Confirm New Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-4 top-3.5 h-4 w-4 text-[#16130F]/40" />
                <input
                  type="password"
                  autoComplete="new-password"
                  disabled={isSubmitting || !token}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat your new password"
                  className="w-full rounded-sm border border-[#16130F]/15 bg-white py-3 pl-11 pr-4 text-sm text-[#16130F] placeholder:text-[#16130F]/30 transition-colors focus:border-[#A83A2C] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <p className="mt-2 text-[11px] text-[#16130F]/45">
                Reset links are valid for one hour and can only be used once.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !token}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-sm bg-[#A83A2C] py-3.5 text-sm font-bold text-[#EFE7D8] shadow-md transition-colors hover:bg-[#c04430] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#16130F]/15 disabled:text-[#16130F]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16130F]"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Updating password…
                </>
              ) : (
                'Update Password'
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-dashed border-[#16130F]/15 pt-6 text-center text-xs text-[#16130F]/50">
            Need another link?{' '}
            <Link
              to="/login"
              className="rounded font-semibold text-[#A83A2C] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A83A2C]"
            >
              Return to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
