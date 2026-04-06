import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, Profile } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

const API_URL = import.meta.env.VITE_API_URL || '';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  passwordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signUp: (email: string, password: string, profileData: {
    name: string;
    phone: string;
    address_line1: string;
    address_line2: string;
    city: string;
    postcode: string;
    country: string;
    gender: 'Male' | 'Female';
    age_group: string;
    marital_status: string;
  }) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
      }
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    // On mobile, browsers (especially iOS Safari) can clear localStorage when
    // the tab is backgrounded, causing silent logouts. When the user returns to
    // the app, attempt a session refresh before treating them as logged out.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            setUser(session.user);
            loadProfile(session.user.id);
          }
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      // If user has been banned, sign them out immediately
      if (data?.is_banned) {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    profileData: {
      name: string;
      phone: string;
      address_line1: string;
      address_line2: string;
      city: string;
      postcode: string;
      country: string;
      gender: 'Male' | 'Female';
      age_group: string;
      marital_status: string;
    }
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;

    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: data.user.id,
            user_id: data.user.id,
            email,
            name: profileData.name,
            phone: profileData.phone,
            address_line1: profileData.address_line1,
            address_line2: profileData.address_line2 || null,
            city: profileData.city,
            postcode: profileData.postcode,
            country: profileData.country,
            gender: profileData.gender,
            age_group: profileData.age_group || null,
            marital_status: profileData.marital_status || null,
            travel_status: 'solo',
          },
        ]);

      if (profileError) throw profileError;

      // Notify admin of new registration (fire-and-forget)
      fetch(`${API_URL}/api/notify-new-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: { name: profileData.name, email, phone: profileData.phone, gender: profileData.gender, age_group: profileData.age_group, city: profileData.city } }),
      }).catch(() => {});

      await loadProfile(data.user.id);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    if (data.user) {
      const { data: profile } = await supabase.from('profiles').select('is_banned').eq('id', data.user.id).single();
      if (profile?.is_banned) {
        await supabase.auth.signOut();
        throw new Error('There seems to be an issue with your account. Please contact support.');
      }
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore Supabase errors (e.g. session already expired)
    }
    // Always clear local state so the app treats the user as logged out
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (data: Partial<Profile>) => {
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', user.id);

    if (error) throw error;

    await loadProfile(user.id);
  };

  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadProfile(user.id);
    }
  }, [user]);

  const clearPasswordRecovery = () => setPasswordRecovery(false);

  const value = {
    user,
    profile,
    loading,
    passwordRecovery,
    clearPasswordRecovery,
    signUp,
    signIn,
    signOut,
    updateProfile,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
