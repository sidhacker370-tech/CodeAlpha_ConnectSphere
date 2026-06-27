import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { UserPlus, User, Key, Mail, Video, Shield } from 'lucide-react';

export const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const { register, googleLogin, devLogin, error, isLoading, clearError } = useAuthStore();
  const navigate = useNavigate();

  const isSupabaseConfigured = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === "https://your-project.supabase.co" ? false : true;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    clearError();

    if (!name || !email || !password || !confirmPassword) {
      setFormError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setFormError('Password must be at least 6 characters long');
      return;
    }

    try {
      if (!isSupabaseConfigured) {
        await devLogin(name, email);
      } else {
        await register({ name, email, password });
      }
      navigate('/dashboard');
    } catch (err) {
      // Handled by store
    }
  };

  const handleGoogleSignIn = async () => {
    setFormError('');
    clearError();
    try {
      if (!isSupabaseConfigured) {
        await devLogin("Google Developer", "google-developer@connectsphere.local");
      } else {
        await googleLogin();
      }
      navigate('/dashboard');
    } catch (err) {
      // Handled by store
    }
  };

  const handleDevBypass = async () => {
    setFormError('');
    clearError();
    try {
      await devLogin(name);
      navigate('/dashboard');
    } catch (err) {
      // Handled by store
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#030303] overflow-hidden grid-bg px-4 py-12">
      {/* Ambient Glows */}
      <div className="glow-orb-indigo -top-20 -right-20" />
      <div className="glow-orb-purple -bottom-20 -left-20" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-brand-indigo/5 to-brand-purple/5 filter blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Brand Header */}
        <div className="mb-6 text-center flex flex-col items-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-indigo via-indigo-600 to-brand-purple text-white shadow-xl shadow-brand-indigo/15 border border-white/10 mb-4 transition duration-300 hover:scale-105">
            <Video className="h-6 w-6" />
          </div>
          <span className="text-sm font-bold tracking-widest text-brand-indigo uppercase mb-1">
            Get Started
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            ConnectSphere
          </h1>
        </div>

        {/* Form Card */}
        <div className="rounded-3xl glass-card p-8 md:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-indigo/30 to-transparent" />

          <h2 className="text-2xl font-bold text-white text-left mb-6 flex items-center gap-2">
            <UserPlus className="h-5.5 w-5.5 text-brand-indigo" />
            <span>Create Account</span>
          </h2>

          {!isSupabaseConfigured && (
            <div className="mb-6 rounded-2xl border border-amber-550/10 bg-amber-500/5 p-4 text-sm text-amber-400 text-left">
              <p className="font-semibold mb-1 text-amber-300">Supabase Configuration not set</p>
              <p className="text-xs text-gray-455 mb-3 leading-relaxed">
                ConnectSphere is running in demo mode. Update your environment variables or click below to bypass registration.
              </p>
              <button
                type="button"
                onClick={handleDevBypass}
                className="w-full inline-flex items-center justify-center px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-xs font-bold text-amber-300 transition duration-155 active:scale-[0.98]"
              >
                Developer Bypass Mode
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {(formError || error) && (
              <div className="rounded-2xl border border-red-500/10 bg-red-500/5 px-4 py-3 text-sm text-red-400 text-left flex items-start gap-2">
                <Shield className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span>{formError || error}</span>
              </div>
            )}

            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full rounded-2xl border border-gray-800/80 bg-gray-950/40 py-3 pl-12 pr-4 text-white placeholder-gray-600 outline-none transition duration-205 focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-2xl border border-gray-800/80 bg-gray-950/40 py-3 pl-12 pr-4 text-white placeholder-gray-600 outline-none transition duration-205 focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Password
              </label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-gray-800/80 bg-gray-950/40 py-3 pl-12 pr-4 text-white placeholder-gray-600 outline-none transition duration-205 focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Confirm Password
              </label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-gray-800/80 bg-gray-950/40 py-3 pl-12 pr-4 text-white placeholder-gray-600 outline-none transition duration-205 focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-brand-indigo to-indigo-600 py-3.5 font-bold text-white shadow-xl shadow-brand-indigo/15 hover:brightness-110 active:scale-[0.99] transition disabled:opacity-50"
            >
              {isLoading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="relative my-6 flex items-center justify-center">
            <div className="absolute inset-x-0 h-px bg-gray-800/60" />
            <span className="relative px-3 text-xs uppercase tracking-wider text-gray-500 font-semibold bg-[#0a0a0f] rounded-full py-0.5 border border-gray-850">
              Or continue with
            </span>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="relative flex w-full items-center justify-center gap-3 rounded-2xl border border-gray-800 bg-gray-950/40 py-3.5 px-4 font-semibold text-white shadow-lg hover:bg-gray-900/60 active:scale-[0.99] transition duration-200 disabled:opacity-50 overflow-hidden"
          >
            <svg className="h-5.5 w-5.5" viewBox="0 0 24 24" width="24" height="24">
              <path
                fill="#EA4335"
                d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582l3.51-3.51C17.642 1.09 14.974 0 12 0 7.354 0 3.307 2.659 1.277 6.545l3.99 3.22z"
              />
              <path
                fill="#4285F4"
                d="M23.64 12.273c0-.818-.073-1.609-.208-2.373H12v4.582h6.545A5.66 5.66 0 0 1 16 18.064l3.9 3.018c2.282-2.1 3.74-5.2 3.74-8.809z"
              />
              <path
                fill="#FBBC05"
                d="M5.266 14.235L1.277 17.455A11.968 11.968 0 0 0 12 24c2.93 0 5.66-.954 7.6-2.618l-3.9-3.018A7.094 7.094 0 0 1 12 19.091a7.077 7.077 0 0 1-6.734-4.856z"
              />
              <path
                fill="#34A853"
                d="M5.266 9.765a7.042 7.042 0 0 1 0 4.47l-3.989 3.22A11.942 11.942 0 0 1 0 12c0-1.99.48-3.873 1.277-5.545l3.99 3.31z"
              />
            </svg>
            <span>Google</span>
          </button>

          <p className="mt-6 text-center text-sm text-gray-405">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-brand-indigo hover:text-brand-purple hover:underline transition"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
