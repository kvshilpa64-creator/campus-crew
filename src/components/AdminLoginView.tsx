import { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';

interface AdminLoginViewProps {
  onAuthenticated: (token: string, email: string) => void;
}

interface AuthStatusResponse {
  configured: boolean;
  mode: 'env' | 'claimed' | 'unclaimed';
  emailHint?: string;
}

export function AdminLoginView({ onAuthenticated }: AdminLoginViewProps) {
  const [statusLoading, setStatusLoading] = useState(true);
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [authMode, setAuthMode] = useState<'env' | 'claimed' | 'unclaimed'>('unclaimed');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/status')
      .then(async (res) => {
        if (!res.ok) throw new Error('Unable to reach authentication service.');
        return (await res.json()) as AuthStatusResponse;
      })
      .then((data) => {
        if (!active) return;
        setIsSetupMode(!data.configured);
        setAuthMode(data.mode);
        if (data.emailHint) {
          setEmail(data.emailHint);
        }
      })
      .catch(() => {
        if (!active) return;
        setErrorMessage('Could not verify server authentication status. Please refresh.');
      })
      .finally(() => {
        if (active) setStatusLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('Please enter your admin email and password.');
      return;
    }

    if (isSetupMode) {
      if (password.length < 8) {
        setErrorMessage('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const endpoint = isSetupMode ? '/api/auth/setup' : '/api/auth/login';
      const body = isSetupMode
        ? { email: trimmedEmail, password, confirmPassword }
        : { email: trimmedEmail, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as {
        token?: string;
        admin?: { email: string };
        error?: string;
      };

      if (!res.ok || !data.token || !data.admin) {
        setErrorMessage(data.error || 'Authentication failed.');
        if (res.status === 409 && isSetupMode) {
          setIsSetupMode(false);
        }
        return;
      }

      onAuthenticated(data.token, data.admin.email);
    } catch {
      setErrorMessage('Network error while connecting to the server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F9FF] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white border border-sky-200/80 rounded-2xl shadow-sm overflow-hidden">
        {/* Top Brand Header */}
        <div className="px-6 py-6 border-b border-sky-100 bg-sky-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-sky-950">
                OMNIS-X Admin Portal
              </h1>
              <p className="text-xs text-sky-700">
                Campus Crew Digital Twin · Operational Control
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {statusLoading ? (
            <div className="py-10 text-center text-xs text-slate-500">
              Checking admin authentication status...
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-slate-900">
                  {isSetupMode ? 'Set Admin Email & Password' : 'Administrator Sign In'}
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {isSetupMode
                    ? 'First-time setup: claim administrator access by setting your admin email and password.'
                    : authMode === 'env'
                    ? 'Sign in with your configured administrator email and passcode.'
                    : 'Sign in with your administrator email and password to manage campus operations.'}
                </p>
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800"
                >
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="admin-email"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Admin Email Address
                  </label>
                  <div className="relative">
                    <Mail
                      className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                      aria-hidden="true"
                    />
                    <input
                      id="admin-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@omnis-campus.edu"
                      className="w-full pl-9 pr-3 py-2.5 text-xs bg-sky-50/40 border border-sky-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="admin-password"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    {isSetupMode ? 'Set Password (min 8 characters)' : 'Password'}
                  </label>
                  <div className="relative">
                    <Lock
                      className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                      aria-hidden="true"
                    />
                    <input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={isSetupMode ? 8 : 1}
                      autoComplete={isSetupMode ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isSetupMode ? 'Create a strong password' : 'Enter password'}
                      className="w-full pl-9 pr-10 py-2.5 text-xs bg-sky-50/40 border border-sky-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {isSetupMode && (
                  <div>
                    <label
                      htmlFor="admin-confirm-password"
                      className="block text-xs font-medium text-slate-700 mb-1.5"
                    >
                      Confirm Password
                    </label>
                    <div className="relative">
                      <KeyRound
                        className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                        aria-hidden="true"
                      />
                      <input
                        id="admin-confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full pl-9 pr-3 py-2.5 text-xs bg-sky-50/40 border border-sky-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60 rounded-lg transition-colors shadow-xs"
                >
                  {submitting
                    ? 'Verifying...'
                    : isSetupMode
                    ? 'Set Password & Enter Dashboard'
                    : 'Sign In to Dashboard'}
                </button>
              </form>

              <div className="pt-4 border-t border-sky-100 text-[11px] text-slate-500 leading-relaxed">
                Google Sign-In requires Firebase project provisioning, which is currently disabled. Admin credentials are verified on the server with salted password hashing.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
