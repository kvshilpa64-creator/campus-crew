import { useState } from 'react';
import { KeyRound, X } from 'lucide-react';

interface ChangePasswordModalProps {
  authToken: string;
  adminEmail: string;
  onClose: () => void;
  onPasswordUpdated: (newToken: string) => void;
}

export function ChangePasswordModal({
  authToken,
  adminEmail,
  onClose,
  onPasswordUpdated,
}: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        token?: string;
        error?: string;
      };

      if (!res.ok || !data.token) {
        setErrorMessage(data.error || 'Unable to update password.');
        return;
      }

      onPasswordUpdated(data.token);
      onClose();
    } catch {
      setErrorMessage('Network error while updating password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white border border-sky-200 rounded-xl overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-sky-100 bg-sky-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-sky-600" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-900">Set New Admin Password</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-900 rounded"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="text-slate-600">
            Signed in as <span className="font-semibold text-slate-900">{adminEmail}</span>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800"
            >
              {errorMessage}
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-medium mb-1.5">Current Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 bg-sky-50/40 border border-sky-200 rounded-lg text-slate-900 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1.5">
              New Password (min 8 characters)
            </label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 bg-sky-50/40 border border-sky-200 rounded-lg text-slate-900 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-sky-50/40 border border-sky-200 rounded-lg text-slate-900 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="pt-3 border-t border-sky-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-medium text-slate-700 bg-sky-50 hover:bg-sky-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60 rounded-lg"
            >
              {submitting ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
