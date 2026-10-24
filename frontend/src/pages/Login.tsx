import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import api from '../services/api';
import { User } from '../types';

interface LoginProps {
  onLoginSuccess: (user: User, token: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (!credentialResponse.credential) {
      setError('Google Sign-in failed. No credential received.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await api.googleLogin(credentialResponse.credential);
      localStorage.setItem('reachinbox_token', data.token);
      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Google authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const targetEmail = email.trim() || 'oliver.brown@domain.io';
      const name = targetEmail.split('@')[0].replace('.', ' ');
      const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
      const data = await api.devLogin(formattedName, targetEmail);
      localStorage.setItem('reachinbox_token', data.token);
      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      {/* Centered White Card */}
      <div className="w-full max-w-[420px] bg-white border border-[#E5E7EB] rounded-2xl p-8 shadow-sm space-y-6">
        <h1 className="text-2xl font-bold text-center text-gray-900 tracking-tight">Login</h1>

        {error && (
          <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg text-center">
            {error}
          </div>
        )}

        {/* Real Google OAuth Login */}
        <div className="space-y-4">
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google sign-in popup closed or failed.')}
              theme="outline"
              shape="rectangular"
              size="large"
              text="signin_with"
              width="356"
            />
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-gray-200 w-full" />
            <span className="bg-white px-3 text-xs text-gray-400 font-normal">
              or sign up through email
            </span>
            <div className="border-t border-gray-200 w-full" />
          </div>

          {/* Email / Password Form (Figma Match) */}
          <form onSubmit={handleEmailLogin} className="space-y-3.5">
            <div>
              <input
                type="email"
                placeholder="Email ID"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[#F3F4F6] border-0 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#00A854]"
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#F3F4F6] border-0 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#00A854]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#00A854] hover:bg-[#009248] text-white font-medium text-sm rounded-lg transition-colors shadow-sm disabled:opacity-60"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-gray-400">
          ReachInbox Onebox &bull; Outbox Labs Assignment
        </p>
      </div>
    </div>
  );
};

export default Login;
