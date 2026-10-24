import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { User } from './types';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import api, { getAdminQueuesUrl } from './services/api';

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '374574606908-pqfg4kmug9ega0f18af6eoof2the50oe.apps.googleusercontent.com';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  // If the user navigates directly to /admin/queues on the frontend domain,
  // redirect them seamlessly to the Bull-Board dashboard on the backend server.
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin/queues')) {
    window.location.href = getAdminQueuesUrl();
    return (
      <div className="min-h-screen bg-[#0B0E14] flex flex-col items-center justify-center text-white space-y-4">
        <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Redirecting to Bull-Board Queue Monitor...</p>
      </div>
    );
  }

  useEffect(() => {
    const token = localStorage.getItem('reachinbox_token');
    if (token) {
      api.getCurrentUser()
        .then((user) => {
          setCurrentUser(user);
        })
        .catch(() => {
          localStorage.removeItem('reachinbox_token');
          setCurrentUser(null);
        })
        .finally(() => {
          setInitializing(false);
        });
    } else {
      setInitializing(false);
    }
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('reachinbox_token');
    setCurrentUser(null);
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {currentUser ? (
        <Dashboard user={currentUser} onLogout={handleLogout} />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
    </GoogleOAuthProvider>
  );
}

export default App;
