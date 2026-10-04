"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface OfficerProfile {
  id: string;
  email: string;
  agency: string;
  badgeId: string;
  role: "Lead Dispatcher" | "Watch Officer" | "Traffic Analyst";
  isDemo?: boolean;
}

interface AuthContextType {
  user: User | null;
  officer: OfficerProfile | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, agency: string) => Promise<{ error: string | null; confirmationRequired?: boolean }>;
  signOut: () => Promise<void>;
  demoSignIn: (customEmail?: string, customAgency?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_STORAGE_KEY = "visionx_demo_officer_session";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [officer, setOfficer] = useState<OfficerProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      // 1. Check for active Supabase session if configured
      if (isSupabaseConfigured) {
        try {
          const { data: { session: currentSession }, error } = await supabase.auth.getSession();
          if (!error && currentSession?.user && mounted) {
            setSession(currentSession);
            setUser(currentSession.user);
            const userMeta = currentSession.user.user_metadata || {};
            setOfficer({
              id: currentSession.user.id,
              email: currentSession.user.email || "officer@agency.gov",
              agency: userMeta.agency || "NCR Traffic Police & ITS",
              badgeId: userMeta.badgeId || `VX-${currentSession.user.id.slice(0, 5).toUpperCase()}`,
              role: (userMeta.role as OfficerProfile["role"]) || "Watch Officer",
            });
            setIsLoading(false);
            return;
          }
        } catch (err) {
          console.warn("Supabase auth session fetch warning:", err);
        }
      }

      // 2. Check for local demo session
      try {
        const storedDemo = localStorage.getItem(DEMO_STORAGE_KEY);
        if (storedDemo && mounted) {
          const parsed = JSON.parse(storedDemo) as OfficerProfile;
          setOfficer(parsed);
          // Mock user object for compatibility
          setUser({
            id: parsed.id,
            email: parsed.email,
            app_metadata: {},
            user_metadata: { agency: parsed.agency, badgeId: parsed.badgeId, role: parsed.role },
            aud: "authenticated",
            created_at: new Date().toISOString(),
          } as unknown as User);
        }
      } catch (err) {
        console.warn("Could not read demo session:", err);
      }

      if (mounted) {
        setIsLoading(false);
      }
    }

    initAuth();

    // Listen to real Supabase auth state changes if configured
    if (isSupabaseConfigured) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user || null);

        if (newSession?.user) {
          const meta = newSession.user.user_metadata || {};
          setOfficer({
            id: newSession.user.id,
            email: newSession.user.email || "officer@agency.gov",
            agency: meta.agency || "NCR Traffic Police & ITS",
            badgeId: meta.badgeId || `VX-${newSession.user.id.slice(0, 5).toUpperCase()}`,
            role: (meta.role as OfficerProfile["role"]) || "Watch Officer",
          });
          // Clear demo storage if real auth succeeded
          localStorage.removeItem(DEMO_STORAGE_KEY);
        } else {
          // If not in demo mode, clear officer
          const hasDemo = localStorage.getItem(DEMO_STORAGE_KEY);
          if (!hasDemo) {
            setOfficer(null);
          }
        }
        setIsLoading(false);
      });

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    }

    return () => {
      mounted = false;
    };
  }, []);

  // Real Supabase sign in
  const signInWithEmail = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return {
        error: "Supabase credentials are not configured in .env.local. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, or use Instant Demo Operator mode.",
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        setUser(data.user);
        setSession(data.session);
        const meta = data.user.user_metadata || {};
        setOfficer({
          id: data.user.id,
          email: data.user.email || email,
          agency: meta.agency || "NCR Traffic Police & ITS",
          badgeId: meta.badgeId || `VX-${data.user.id.slice(0, 5).toUpperCase()}`,
          role: (meta.role as OfficerProfile["role"]) || "Watch Officer",
        });
        localStorage.removeItem(DEMO_STORAGE_KEY);
      }

      return { error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      return { error: message };
    }
  };

  // Real Supabase sign up
  const signUpWithEmail = async (email: string, password: string, agency: string) => {
    if (!isSupabaseConfigured) {
      return {
        error: "Supabase credentials are not configured in .env.local. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, or use Instant Demo Operator mode.",
      };
    }

    try {
      const badgeNumber = Math.floor(1000 + Math.random() * 9000);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            agency,
            badgeId: `VX-${badgeNumber}`,
            role: "Watch Officer",
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        return {
          error: null,
          confirmationRequired: true,
        };
      }

      if (data.user) {
        setUser(data.user);
        setSession(data.session);
        setOfficer({
          id: data.user.id,
          email: data.user.email || email,
          agency,
          badgeId: `VX-${badgeNumber}`,
          role: "Watch Officer",
        });
        localStorage.removeItem(DEMO_STORAGE_KEY);
      }

      return { error: null, confirmationRequired: false };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed";
      return { error: message };
    }
  };

  // Demo Sign-in for immediate hackathon / review testing
  const demoSignIn = (
    customEmail = "officer.deshmukh@traffic.delhipolice.gov.in",
    customAgency = "Delhi Traffic Police / NHAI Command"
  ) => {
    const demoOfficer: OfficerProfile = {
      id: "demo-officer-" + Date.now(),
      email: customEmail,
      agency: customAgency,
      badgeId: `VX-${Math.floor(1000 + Math.random() * 9000)}`,
      role: "Lead Dispatcher",
      isDemo: true,
    };
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoOfficer));
    setOfficer(demoOfficer);
    setUser({
      id: demoOfficer.id,
      email: demoOfficer.email,
      app_metadata: {},
      user_metadata: {
        agency: demoOfficer.agency,
        badgeId: demoOfficer.badgeId,
        role: demoOfficer.role,
      },
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as unknown as User);
    setIsLoading(false);
  };

  // Sign out
  const signOut = async () => {
    localStorage.removeItem(DEMO_STORAGE_KEY);
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn("Supabase sign out warning:", err);
      }
    }
    setUser(null);
    setOfficer(null);
    setSession(null);
  };

  const value = useMemo(
    () => ({
      user,
      officer,
      session,
      isLoading,
      isConfigured: isSupabaseConfigured,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      demoSignIn,
    }),
    [user, officer, session, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
