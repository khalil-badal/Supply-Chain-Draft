import { FormEvent, useState } from 'react';
import { LogIn, Loader2 } from 'lucide-react';
import { api, ApiUser } from '../api';

interface LoginViewProps {
  onLoggedIn: (user: ApiUser) => void;
}

const DEMO_ACCOUNTS = [
  {
    email: 'sales@microgenesis.com',
    password: 'password123',
    name: 'Maria Reyes',
    role: 'Sales Coordinator',
    initials: 'MR',
    avatarBg: 'bg-blue-600',
    roleBadge: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    email: 'logistics@microgenesis.com',
    password: 'password123',
    name: 'Juan Santos',
    role: 'Logistics',
    initials: 'JS',
    avatarBg: 'bg-emerald-600',
    roleBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    email: 'tass@microgenesis.com',
    password: 'password123',
    name: 'Ana Cruz',
    role: 'TASS',
    initials: 'AC',
    avatarBg: 'bg-purple-600',
    roleBadge: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    email: 'admin@microgenesis.com',
    password: 'admin123',
    name: 'System Admin',
    role: 'Admin',
    initials: 'SA',
    avatarBg: 'bg-[#1F3864]',
    roleBadge: 'bg-slate-100 text-slate-700 border-slate-200',
  },
] as const;

export default function LoginView({ onLoggedIn }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await api.login(email.trim(), password);
      onLoggedIn(user);
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string, demoPassword: string) => {
    setError(null);
    setLoading(true);
    try {
      const user = await api.login(demoEmail, demoPassword);
      onLoggedIn(user);
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F8F9FB] px-4" id="login-screen">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-40 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
            <img src="/microgenesis_logo.png" alt="Microgenesis - Making It Easy For You!" className="w-full h-auto" />
          </div>
          <h1 className="text-lg font-black text-[#1F3864] mt-4 text-center">Supply Chain Portal</h1>
          <p className="text-xs text-slate-500 text-center mt-1">Sign in with your Microgenesis account to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-4" id="login-form">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@microgenesis.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-[#0078C1]"
              id="login-email"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-[#0078C1]"
              id="login-password"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg px-3 py-2" id="login-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1F3864] hover:bg-blue-900 disabled:opacity-60 text-white font-bold uppercase tracking-wider text-xs py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            Sign In
          </button>
        </form>

        {/* Quick Switch — demo accounts */}
        <div className="mt-4" id="quick-switch-panel">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quick Switch</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map(account => (
              <button
                key={account.email}
                onClick={() => handleQuickLogin(account.email, account.password)}
                disabled={loading}
                className="bg-white border border-slate-200 rounded-xl p-3 text-left flex items-start gap-2.5 hover:border-[#0078C1] hover:shadow-sm transition-all cursor-pointer disabled:opacity-50 group"
                title={`Sign in as ${account.name}`}
              >
                <div className={`w-8 h-8 rounded-full ${account.avatarBg} flex items-center justify-center text-white text-[11px] font-black shrink-0`}>
                  {account.initials}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate leading-tight">{account.name}</p>
                  <span className={`inline-block mt-1 px-1.5 py-0.5 rounded border text-[9px] font-bold tracking-wide ${account.roleBadge}`}>
                    {account.role}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
