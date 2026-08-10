import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile } from './types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, phone: string, role: 'citizen' | 'business') => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const seedUserSandboxData = async (userId: string) => {
    try {
      const { data: notifs } = await supabase.from('notifications').select('id').eq('user_id', userId).limit(1);
      if (notifs && notifs.length === 0) {
        await supabase.from('notifications').insert([
          {
            user_id: userId,
            title: 'Welcome to City Zen!',
            message: 'Your unified citizen account has been successfully verified. Explore city services, file complaints, and check real-time environmental metrics.',
            type: 'government',
            read: false
          }
        ]);
      }

      const { data: envs } = await supabase.from('environmental_readings').select('id').limit(1);
      if (envs && envs.length === 0) {
        await supabase.from('environmental_readings').insert([
          { metric: 'temperature', value: 29.5, unit: '°C' },
          { metric: 'aqi', value: 78, unit: '' },
          { metric: 'humidity', value: 65, unit: '%' },
          { metric: 'water_quality', value: 88, unit: '%' },
          { metric: 'noise', value: 62, unit: 'dB' },
          { metric: 'co2', value: 420, unit: 'ppm' }
        ]);
      }

      const { data: maps } = await supabase.from('map_points').select('id').limit(1);
      if (maps && maps.length === 0) {
        await supabase.from('map_points').insert([
          { name: 'AIIMS Hospital Bhubaneswar', category: 'hospital', lat: 20.2223, lng: 85.7335, address: 'Sijua, Patrapada, Bhubaneswar, Odisha 751019', phone: '0674-247-6600', open_24h: true },
          { name: 'Tamando Police Station', category: 'police', lat: 20.2185, lng: 85.7275, address: 'NH 16, Tamando, Bhubaneswar, Odisha 751028', phone: '100', open_24h: true },
          { name: 'Gohiria Mo Bus Stop', category: 'transit', lat: 20.2263, lng: 85.7483, address: 'Janla, Odisha 752054', phone: '1077', open_24h: true },
          { name: 'Khandagiri Fire Station', category: 'fire', lat: 20.2612, lng: 85.7885, address: 'Khandagiri, Bhubaneswar, Odisha 751030', phone: '101', open_24h: true }
        ]);
      }
    } catch (e) {
      console.warn('Seeding sandbox data failed (migrations might not be run yet):', e);
    }
  };

  const loadProfile = async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    if (error) {
      console.warn('profile load error', error.message);
      return;
    }
    setProfile(data as Profile | null);
    await seedUserSandboxData(uid);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName: string, phone: string, role: 'citizen' | 'business') => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone, role } },
    });
    if (error) throw error;

    // Fallback: Directly upsert role in profiles table to bypass any outdated auth trigger constraints
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName,
        phone,
        role: role
      });
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  };

  const refreshProfile = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signUp, signInWithGoogle, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
