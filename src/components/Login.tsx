import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  auth, 
  db, 
  doc, 
  setDoc, 
  GoogleAuthProvider, 
  signInWithPopup, 
  updateProfile 
} from '../lib/firebase';
import { ShieldAlert, PlayCircle, Loader2, Mail, Lock, User, Shield, LogIn, UserPlus } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (mode: 'real' | 'demo') => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'manager' | 'operator'>('admin');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isSignUp) {
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (fullName.trim()) {
          await updateProfile(user, { displayName: fullName.trim() });
        }

        // Store user role and metadata in Firebase Firestore
        await setDoc(doc(db, 'settings', `user_role_${user.uid}`), {
          uid: user.uid,
          email: user.email,
          displayName: fullName.trim() || user.email?.split('@')[0],
          role: role,
          createdAt: new Date().toISOString()
        }, { merge: true });

      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onLoginSuccess('real');
    } catch (err: any) {
      console.error('Firebase Auth Error:', err);
      let msg = err.message || 'Authentication failed';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email address already exists. Please sign in instead.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters long.';
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Invalid email or password. Please check your credentials.';
      } else if (err.code === 'auth/popup-closed-by-user') {
        msg = 'Google sign-in popup was closed before completing.';
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Ensure user profile & role doc exists in Firestore
      await setDoc(doc(db, 'settings', `user_role_${user.uid}`), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0],
        role: 'admin',
        updatedAt: new Date().toISOString()
      }, { merge: true });

      onLoginSuccess('real');
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Failed to sign in with Google');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        
{/* Enterprise Brand Header */}
<div className="relative overflow-hidden bg-gradient-to-br from-[#007BC4] via-[#0A84D6] to-[#0064A0] px-8 py-10 text-center">

  {/* Background Decoration */}
  <div className="absolute inset-0 opacity-10">
    <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white"></div>
    <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full bg-white"></div>
  </div>

  {/* Logo */}
  <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur border border-white/20 shadow-lg">
    <Shield className="w-8 h-8 text-white" />
  </div>

  {/* Company */}
  <h1 className="relative mt-6 text-4xl font-extrabold tracking-tight text-white">
    Aperture
  </h1>

  {/* Company Description */}
  <p className="relative mt-2 text-sm tracking-[0.25em] uppercase text-sky-100 font-semibold">
    Enterprise Construction Systems
  </p>

  {/* Divider */}
  <div className="relative flex justify-center my-6">
    <div className="w-16 h-[2px] rounded-full bg-white/40"></div>
  </div>

  {/* Product */}
  <h2 className="relative text-2xl font-bold text-white">
    Construction People Tracking System
  </h2>

  {/* Tagline */}
  <p className="relative mt-3 text-sm text-sky-100 max-w-xs mx-auto leading-6">
    Enterprise RFID Workforce Tracking, Live Location Monitoring &
    Construction Safety Management
  </p>

</div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={() => { setIsSignUp(false); setError(''); }}
            className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition ${
              !isSignUp 
                ? 'bg-white text-[#007BC4] border-b-2 border-[#007BC4]' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(true); setError(''); }}
            className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition ${
              isSignUp 
                ? 'bg-white text-[#007BC4] border-b-2 border-[#007BC4]' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Create Account
          </button>
        </div>

        {/* Form Body */}
        <div className="p-8">
          <form onSubmit={handleAuth} className="space-y-4">
            
            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    required={isSignUp}
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg pl-10 pr-4 py-2 text-sm outline-none focus:border-[#007BC4] focus:ring-1 focus:ring-[#007BC4] transition"
                    placeholder="John Doe"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg pl-10 pr-4 py-2 text-sm outline-none focus:border-[#007BC4] focus:ring-1 focus:ring-[#007BC4] transition"
                  placeholder="admin@domain.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg pl-10 pr-4 py-2 text-sm outline-none focus:border-[#007BC4] focus:ring-1 focus:ring-[#007BC4] transition"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
            </div>

            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Access Role
                </label>
                <select
                  value={role}
                  onChange={(e: any) => setRole(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2 text-sm outline-none focus:border-[#007BC4] focus:ring-1 focus:ring-[#007BC4] transition"
                >
                  <option value="admin">Administrator (Full Access)</option>
                  <option value="manager">Manager (Operations & Analytics)</option>
                  <option value="operator">Operator (Live Tracking & Attendance)</option>
                </select>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-start gap-2 text-sm">
                <ShieldAlert className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-[#007BC4] text-white rounded-lg px-4 py-2.5 font-semibold hover:bg-[#0064A0] transition disabled:opacity-70 flex justify-center items-center gap-2 shadow-sm"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isSignUp ? (
                <>
                  <UserPlus className="w-5 h-5" />
                  Create Aperture Account
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In with Aperture
                </>
              )}
            </button>
          </form>

          {/* Google Sign In Divider */}
          <div className="mt-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="px-2 bg-white text-slate-400 font-medium">Or continue with</span>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full bg-white border border-slate-200 text-slate-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-50 transition flex justify-center items-center gap-2 shadow-xs"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              Sign In with Google
            </button>

            <button 
              type="button"
              onClick={() => onLoginSuccess('demo')}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-100 transition flex justify-center items-center gap-2"
            >
              <PlayCircle className="w-4 h-4 text-emerald-600" />
              Start Interactive Demo Mode
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

