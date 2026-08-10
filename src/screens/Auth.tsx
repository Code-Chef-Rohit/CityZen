import { useState } from 'react';
import { Building2, Mail, Lock, User, Phone, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/Button';
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
        if (!fullName.trim()) throw new Error('Please enter your name');
        await signUp(email.trim(), password, fullName.trim(), phone.trim(), signupRole);
      } else {
        // Mode 'forgot' password reset email flow
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
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-slate-900 border border-white/5 rounded-[32px] p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 left-1/4 w-1/2 h-1 bg-gradient-to-r from-transparent via-primary-500 to-transparent opacity-50" />
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary-500/10 flex items-center justify-center text-primary-400 mb-4 border border-primary-500/20">
            <Building2 className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">CityZen Portal</h1>
          <p className="text-xs text-slate-400 mt-1.5 font-medium">
            {mode === 'signin' ? 'Access your civic administration services' : 
             mode === 'signup' ? 'Join the digitized municipality network' : 
             'Request password recovery secure link'}
          </p>
        </div>

        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">Onboard Account As</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-white/5">
                    <button
                      type="button"
                      onClick={() => setSignupRole('citizen')}
                      className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        signupRole === 'citizen' ? 'bg-primary-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Citizen User
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignupRole('business')}
                      className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        signupRole === 'business' ? 'bg-primary-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Merchant (Hospital)
                    </button>
                  </div>
                </div>

                <Field
                  icon={<User className="w-4 h-4" />}
                  type="text"
                  placeholder="Full name"
                  value={fullName}
                  onChange={setFullName}
                />
              </div>
            )}
            
            <Field
              icon={<Mail className="w-4 h-4" />}
              type="email"
              placeholder="Email address"
              value={email}
              onChange={setEmail}
            />
            
            {mode === 'signup' && (
              <Field
                icon={<Phone className="w-4 h-4" />}
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={setPhone}
              />
            )}
            
            {mode !== 'forgot' && (
              <Field
                icon={<Lock className="w-4 h-4" />}
                type="password"
                placeholder="Password"
                value={password}
                onChange={setPassword}
              />
            )}

            {mode === 'signin' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(null); }}
                  className="text-xs font-bold text-primary-500 hover:text-primary-400 hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 rounded-xl px-4 py-2.5 border border-red-500/15">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" loading={loading} className="w-full">
              {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          {mode !== 'forgot' && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-slate-500 font-medium">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={() => { setError(null); signInWithGoogle(); }}
                className="w-full flex items-center justify-center gap-3 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <GoogleIcon className="w-5 h-5" />
                Continue with Google
              </button>
            </>
          )}

          <p className="text-center text-xs text-slate-400 mt-4">
            {mode === 'forgot' ? (
              <>
                Back to{' '}
                <button
                  onClick={() => { setMode('signin'); setError(null); }}
                  className="text-primary-500 font-bold hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
                  className="text-primary-500 font-bold hover:underline cursor-pointer"
                >
                  {mode === 'signin' ? 'Sign up' : 'Sign in'}
                </button>
              </>
            )}
          </p>
        </div>
      </div>
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
        className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary-500 transition-all"
      />
    </div>
  );
}
