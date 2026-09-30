import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { User } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  role: 'admin_geral' | 'admin_cantina' | 'user_cantina' | 'admin_lojinha' | 'user_lojinha' | 'admin_ativos' | 'user_ativos' | 'admin_financeiro' | 'user_financeiro' | 'admin_scout' | 'user_scout' | 'chefia' | 'user_comunicacao';
  branch?: string; // ramo (usado pela Chefia): Filhote | Lobinho | Escoteiro | Sênior | Pioneiro
  photo_url?: string;
  requires_password_change?: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// fetch() that can never hang forever: aborts after `timeoutMs`.
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 6000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const activeRef = useRef(true);
  // Which user id we already loaded a profile for — avoids re-fetching on every
  // auth event (TOKEN_REFRESHED, USER_UPDATED, etc.).
  const loadedForId = useRef<string | null>(null);

  useEffect(() => {
    activeRef.current = true;

    // Safety net: the app must never get stuck on the "Carregando..." screen.
    // Whatever happens with the network, stop showing the loader after 8s.
    const safety = setTimeout(() => {
      if (activeRef.current) setLoading(false);
    }, 8000);

    // NOTE: We rely on onAuthStateChange, which fires an INITIAL_SESSION event
    // right after subscribing (supabase-js v2), so it covers both the first
    // page load and every later change (login, logout, token refresh, updateUser).
    //
    // IMPORTANT: never run awaited Supabase/network calls *synchronously* inside
    // this callback. supabase-js holds an internal auth lock while the callback
    // runs; awaiting here deadlocks token refresh and updateUser — which is what
    // caused the infinite "loading" screen and password changes that never
    // completed. So we defer all profile work to a timeout (outside the lock).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!activeRef.current) return;

      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        loadedForId.current = null;
        setProfile(null);
        setLoading(false);
        return;
      }

      // Same user we already have a profile for: nothing to fetch.
      if (loadedForId.current === nextUser.id) {
        setLoading(false);
        return;
      }

      // Fetch the profile outside the auth-lock context.
      setTimeout(() => {
        if (!activeRef.current) return;
        fetchProfile(nextUser.id, nextUser.email || '')
          .then(() => { loadedForId.current = nextUser.id; })
          .finally(() => { if (activeRef.current) setLoading(false); });
      }, 0);
    });

    return () => {
      activeRef.current = false;
      clearTimeout(safety);
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (id: string, email: string) => {
    const fallbackProfile: UserProfile = {
      id: id,
      email: email,
      display_name: email.split('@')[0] || 'Usuário',
      role: 'user_lojinha',
      requires_password_change: false
    };

    try {
      // Try to fetch via API to bypass RLS issues (bounded by a timeout).
      const response = await fetchWithTimeout(`/api/users/profile/${id}`);
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const data = await response.json();
          if (activeRef.current) setProfile(data as UserProfile);
          return;
        } else {
          const text = await response.text();
          console.error("API returned non-JSON response:", text.substring(0, 300));
        }
      } else {
        console.warn(`API profile fetch failed with status: ${response.status}`);
      }

      // If API fails (e.g. not found), try to fetch via Supabase directly just in case
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        // Create profile if it doesn't exist via our API
        try {
          const createResponse = await fetchWithTimeout('/api/users/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: email,
              password: Math.random().toString(36).slice(-8) + 'A1!',
              displayName: email.split('@')[0] || 'Usuário',
              role: 'user_lojinha'
            })
          });

          if (createResponse.ok) {
            const createContentType = createResponse.headers.get("content-type");
            if (createContentType && createContentType.includes("application/json")) {
              // Fetch it again after creation via API
              const fetchAgain = await fetchWithTimeout(`/api/users/profile/${id}`);
              if (fetchAgain.ok) {
                const fetchContentType = fetchAgain.headers.get("content-type");
                if (fetchContentType && fetchContentType.includes("application/json")) {
                  const newData = await fetchAgain.json();
                  if (activeRef.current) setProfile(newData as UserProfile);
                  return;
                }
              }
            }
          }

          // Fallback if API fails or returns HTML/other formats
          const newProfile = {
            id: id,
            email: email,
            display_name: email.split('@')[0] || 'Usuário',
            role: 'user_lojinha' as const,
            requires_password_change: false
          };

          const { data: createdData } = await supabase
            .from('profiles')
            .upsert([newProfile])
            .select()
            .single();

          if (activeRef.current) setProfile((createdData as UserProfile) || newProfile);
        } catch (apiError) {
          console.error('API Error, using fallback:', apiError);
          if (activeRef.current) setProfile(fallbackProfile);
        }
      } else {
        if (activeRef.current) setProfile(data as UserProfile);
      }
    } catch (e: any) {
      console.error('Exception fetching profile, using fallback:', e);
      if (activeRef.current) setProfile(fallbackProfile);
    }
  };

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error signing out via Supabase, forcing local cleanup:", err);
    } finally {
      // Clean up Supabase session localStorage records to guarantee logout even when client is unconfigured
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch (storageErr) {
        console.error("LocalStorage clearing error:", storageErr);
      }
      loadedForId.current = null;
      setUser(null);
      setProfile(null);
      // Redirect to the origin root without path to avoid Vercel 404 for SPA.
      // Once it loads the root path, ProtectedRoute will securely client-side navigate them to /login.
      window.location.replace(window.location.origin);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
