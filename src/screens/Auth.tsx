import { useState } from 'react';
import { Building2, Mail, Lock, User, Phone, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

type Mode = 'signin' | 'signup' | 'forgot';

export function Auth() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [signupRole, setSignupRole] = useState<'citizen' | 'business'>('citizen');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else if (mode === 'signup') {
        if (!fullName.trim()) throw new Error('Please enter your full name.');
        const cleanPhone = phone.replace(/\D/g, '').trim();
        if (!cleanPhone || cleanPhone.length !== 10) {
          throw new Error('Please enter a valid 10-digit mobile number for registration.');
        }

        // Check if phone already registered to any existing profile
        const { data: existingPhone, error: phoneCheckErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone', cleanPhone)
          .maybeSingle();

        if (existingPhone) {
          throw new Error(`Mobile number ${cleanPhone} is already registered to another user account. Each account must have a unique mobile number.`);
        }

        const signUpData = await signUp(email.trim(), password, fullName.trim(), cleanPhone, signupRole);
        if (signUpData && !signUpData.session) {
          alert("Account created successfully! Please check your email to verify your account before logging in.");
          setMode('signin');
          setPassword('');
        }
      } else {
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin
        });
        if (resetErr) throw resetErr;
        alert("Password reset link has been sent to your email. Please check your inbox!");
        setMode('signin');
      }
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(
        msg.toLowerCase().includes('invalid login')
          ? 'Invalid email or password'
          : msg.toLowerCase().includes('already registered')
            ? 'This email is already registered. Try signing in.'
            : msg
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Dynamic Ambient Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-teal-500/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-cyan-500/10 rounded-full blur-[160px] pointer-events-none" />
      
      {/* Subtle Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Floating Smart City Status Pill Badges */}
      <div className="hidden lg:flex absolute top-8 left-8 items-center gap-2 px-4 py-2 rounded-full bg-slate-900/60 border border-white/10 text-xs font-semibold text-emerald-400 backdrop-blur-md shadow-xl animate-pulse">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        CityZen Smart Grid v2.5 Online
      </div>
      <div className="hidden lg:flex absolute top-8 right-8 items-center gap-2 px-4 py-2 rounded-full bg-slate-900/60 border border-white/10 text-xs font-semibold text-cyan-400 backdrop-blur-md shadow-xl">
        <ShieldCheck className="w-4 h-4" />
        256-bit Encrypted Portal
      </div>

      {/* Main Glassmorphism Card */}
      <div className="w-full max-w-[440px] bg-slate-900/80 border border-white/10 rounded-[36px] p-7 sm:p-9 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative z-10 backdrop-blur-2xl animate-fade-in">
        
        {/* Glowing Top Edge Highlight */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-70" />

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="relative mb-3 group">
            <div className="absolute inset-0 bg-cyan-500/30 rounded-2xl blur-lg group-hover:blur-xl transition-all" />
            <div className="relative w-20 h-20 rounded-2xl border border-white/20 overflow-hidden shadow-2xl bg-slate-950 flex items-center justify-center">
              <img src="/logo.jpg" alt="CityZen Logo" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            </div>
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            CityZen <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold uppercase">Portal</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium max-w-xs leading-relaxed">
            {mode === 'signin' ? 'Sign in to manage your city services, bills & reports' : 
             mode === 'signup' ? 'Create your unified citizen identity account' : 
             'Reset your account credentials securely'}
          </p>
        </div>

        {/* Navigation Mode Segment Switcher */}
        {mode !== 'forgot' && (
          <div className="grid grid-cols-2 p-1.5 bg-slate-950/80 border border-white/10 rounded-2xl mb-6 shadow-inner">
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(null); }}
              className={`py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                mode === 'signin' 
                  ? 'bg-gradient-to-r from-primary-600 to-teal-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); }}
              className={`py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                mode === 'signup' 
                  ? 'bg-gradient-to-r from-primary-600 to-teal-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sign Up Role Toggle Card */}
          {mode === 'signup' && (
            <div className="space-y-2 mb-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Account Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSignupRole('citizen')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                    signupRole === 'citizen'
                      ? 'bg-primary-500/15 border-primary-500 text-white shadow-lg shadow-primary-500/10'
                      : 'bg-slate-950/40 border-white/5 text-slate-400 hover:border-white/15'
                  }`}
                >
                  <User className={`w-4 h-4 ${signupRole === 'citizen' ? 'text-primary-400' : 'text-slate-500'}`} />
                  <div>
                    <p className="text-xs font-extrabold">Citizen</p>
                    <p className="text-[9px] opacity-75">Public User</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSignupRole('business')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                    signupRole === 'business'
                      ? 'bg-primary-500/15 border-primary-500 text-white shadow-lg shadow-primary-500/10'
                      : 'bg-slate-950/40 border-white/5 text-slate-400 hover:border-white/15'
                  }`}
                >
                  <Building2 className={`w-4 h-4 ${signupRole === 'business' ? 'text-primary-400' : 'text-slate-500'}`} />
                  <div>
                    <p className="text-xs font-extrabold">Merchant</p>
                    <p className="text-[9px] opacity-75">Hospital/Biz</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Full Name (Sign up only) */}
          {mode === 'signup' && (
            <Field
              icon={<User className="w-4 h-4" />}
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={setFullName}
            />
          )}
          
          {/* Email Address */}
          <Field
            icon={<Mail className="w-4 h-4" />}
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={setEmail}
          />
          
          {/* Phone Number (Sign up only) */}
          {mode === 'signup' && (
            <Field
              icon={<Phone className="w-4 h-4" />}
              type="tel"
              placeholder="10-Digit Mobile Number"
              value={phone}
              onChange={(val) => setPhone(val.replace(/\D/g, '').slice(0, 10))}
            />
          )}
          
          {/* Password Input */}
          {mode !== 'forgot' && (
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-11 pr-11 py-3 bg-slate-950/80 border border-white/10 rounded-2xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/10 transition-all font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          )}

          {/* Forgot Password Link */}
          {mode === 'signin' && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => { setMode('forgot'); setError(null); }}
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer transition-colors"
              >
                Forgot Password?
              </button>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 rounded-2xl p-3 border border-red-500/20 font-medium animate-shake">
              ⚠️ {error}
            </div>
          )}

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white rounded-2xl text-sm font-extrabold shadow-lg shadow-emerald-500/25 transition-all transform active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>{mode === 'signin' ? 'Sign In to Portal' : mode === 'signup' ? 'Create Unified Account' : 'Send Recovery Link'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Google SSO Button */}
        {mode !== 'forgot' && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={() => { setError(null); signInWithGoogle(); }}
              className="w-full flex items-center justify-center gap-3 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-white hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              <GoogleIcon className="w-5 h-5" />
              <span>Continue with Google</span>
            </button>
          </>
        )}

        {/* Footer Navigation */}
        <p className="text-center text-xs text-slate-400 mt-6 font-medium">
          {mode === 'forgot' ? (
            <>
              Remember your credentials?{' '}
              <button
                onClick={() => { setMode('signin'); setError(null); }}
                className="text-cyan-400 font-bold hover:underline cursor-pointer"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              {mode === 'signin' ? "Don't have a citizen account? " : 'Already registered? '}
              <button
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
                className="text-cyan-400 font-bold hover:underline cursor-pointer"
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </>
          )}
        </p>
      </div>

      {/* Footer Tagline */}
      <p className="text-center text-[11px] text-slate-500 mt-6 font-semibold tracking-wider uppercase z-10">
        CityZen Municipal Network · One City One App
      </p>
    </div>
  );
}

function Field({
  icon, type, placeholder, value, onChange,
}: {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">{icon}</div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full pl-11 pr-4 py-3 bg-slate-950/80 border border-white/10 rounded-2xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/10 transition-all font-medium"
      />
    </div>
  );
}
