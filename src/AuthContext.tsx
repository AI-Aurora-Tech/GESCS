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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id, session.user.email || '');
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (id: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        if (error.code !== 'PGRST116') {
          setErrorMsg('Error fetching profile: ' + error.message);
        }
      }

        if (error || !data) {
          // Create profile if it doesn't exist via our API
          const isAdmin = email === 'ai.auroratech@gmail.com';
          
          try {
            const response = await fetch('/api/users/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: email,
                password: Math.random().toString(36).slice(-8) + 'A1!', // Dummy password, user will login with OAuth or existing password
                displayName: email.split('@')[0] || 'Usuário',
                role: isAdmin ? 'admin_geral' : 'user_lojinha'
              })
            });
            
            if (response.ok) {
              // Fetch it again after creation, using a retry mechanism since RLS might take a moment or we might need to rely on the session
              let retries = 3;
              let newData = null;
              while (retries > 0 && !newData) {
                const { data: fetchedData } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', id)
                  .single();
                
                if (fetchedData) {
                  newData = fetchedData;
                } else {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  retries--;
                }
              }
                
              if (newData) {
                setProfile(newData as UserProfile);
              } else {
                // If we still can't fetch it (likely RLS), just set a local profile so the user can proceed
                setProfile({
                  id: id,
                  email: email,
                  display_name: email.split('@')[0] || 'Usuário',
                  role: isAdmin ? 'admin_geral' : 'user_lojinha',
                  requires_password_change: false
                });
              }
            } else {
              // If API fails (e.g. user already exists in auth but not profiles), fallback to direct upsert and hope RLS allows it (it won't for anon, but might for auth user)
              const newProfile = {
                id: id,
                email: email,
                display_name: email.split('@')[0] || 'Usuário',
                role: isAdmin ? 'admin_geral' : 'user_lojinha',
                requires_password_change: false
              };

              const { data: createdData, error: createError } = await supabase
                .from('profiles')
                .upsert([newProfile])
                .select()
                .single();

              if (createError) {
                console.error('Error creating profile:', createError);
                // Don't show error to user if they just logged in and profile creation failed, they might still be able to use the app if RLS allows reads
              }

              if (createdData) {
                setProfile(createdData as UserProfile);
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
