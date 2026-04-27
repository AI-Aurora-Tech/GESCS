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
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id, session.user.email || '');
      }
      setLoading(false);
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email || '').finally(() => {
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (id: string, email: string) => {
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
            // Fetch it again after creation via API
            const fetchAgain = await fetch(`/api/users/profile/${id}`);
            if (fetchAgain.ok) {
              const newData = await fetchAgain.json();
              setProfile(newData as UserProfile);
            } else {
              setProfile({
                id: id,
                email: email,
                display_name: email.split('@')[0] || 'Usuário',
                role: 'user_lojinha',
                requires_password_change: false
              });
            }
          } else {
            // If API fails (e.g. user already exists in auth but not profiles), fallback
            const newProfile = {
              id: id,
              email: email,
              display_name: email.split('@')[0] || 'Usuário',
              role: 'user_lojinha',
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
              // Ultimate fallback so user is not stuck
              setProfile(newProfile);
            }
          }
        } catch (apiError) {
           console.error('API Error:', apiError);
        }
      } else {
        setProfile(data as UserProfile);
      }
    } catch (e: any) {
      setErrorMsg('Exception: ' + e.message);
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
    await supabase.auth.signOut();
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
