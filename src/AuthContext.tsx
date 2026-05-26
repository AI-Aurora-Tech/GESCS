import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { User } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  role: 'admin_geral' | 'admin_cantina' | 'user_cantina' | 'admin_lojinha' | 'user_lojinha' | 'admin_ativos' | 'user_ativos' | 'admin_financeiro' | 'user_financeiro' | 'admin_scout' | 'user_scout';
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Check active sessions and subscribe to auth changes
    let active = true;

    const fetchSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id, session.user.email || '');
        }
      } catch (err) {
        console.error("Error fetching session:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        try {
          await fetchProfile(session.user.id, session.user.email || '');
        } catch (err) {
          console.error("Error setting profile on auth change:", err);
        } finally {
          if (active) setLoading(false);
        }
      } else {
        setProfile(null);
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
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
      console.log(`Buscando perfil para UID: ${id}`);
      // Try to fetch via API to bypass RLS issues
      const response = await fetch(`/api/users/profile/${id}`);
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const data = await response.json();
          setProfile(data as UserProfile);
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
          const createResponse = await fetch('/api/users/create', {
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
              const fetchAgain = await fetch(`/api/users/profile/${id}`);
              if (fetchAgain.ok) {
                const fetchContentType = fetchAgain.headers.get("content-type");
                if (fetchContentType && fetchContentType.includes("application/json")) {
                  const newData = await fetchAgain.json();
                  setProfile(newData as UserProfile);
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

          const { data: createdData, error: createError } = await supabase
            .from('profiles')
            .upsert([newProfile])
            .select()
            .single();

          if (createdData) {
            setProfile(createdData as UserProfile);
          } else {
            setProfile(newProfile);
          }
        } catch (apiError) {
          console.error('API Error, using fallback:', apiError);
          setProfile(fallbackProfile);
        }
      } else {
        setProfile(data as UserProfile);
      }
    } catch (e: any) {
      console.error('Exception fetching profile, using fallback:', e);
      setErrorMsg('Exception: ' + e.message);
      setProfile(fallbackProfile);
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
      setUser(null);
      setProfile(null);
      // Force redirect to login page
      window.location.href = '/login';
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
