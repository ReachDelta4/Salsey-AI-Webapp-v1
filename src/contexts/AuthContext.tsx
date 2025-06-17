import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { showCustomToast } from "@/components/ui/custom-toast";

interface AuthContextProps {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const currentPathRef = useRef(location.pathname);
  const hasShownSignInToast = useRef(false);

  // Keep ref updated with latest pathname without causing re-renders
  useEffect(() => {
    currentPathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (event === 'SIGNED_IN') {
          if (!hasShownSignInToast.current) {
            showCustomToast("Successfully signed in", "success", 2000);
            hasShownSignInToast.current = true;
          }
          // Only redirect to the dashboard if the user is currently on an auth-related page
          // This prevents unexpected navigation (e.g. from Profile back to Home) when the
          // access token is silently refreshed in the background.
          if (currentPathRef.current.startsWith("/auth")) {
            navigate("/");
          }
        } else if (event === 'TOKEN_REFRESHED') {
          // Do not show toast on token refresh
        } else if (event === 'SIGNED_OUT') {
          showCustomToast("Signed out", "info", 2000);
          navigate("/auth");
          hasShownSignInToast.current = false;
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      showCustomToast("Registration successful! Please check your email to confirm your account.", "success", 4000);
    } catch (error: any) {
      showCustomToast(error.message, "error", 4000);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error: any) {
      showCustomToast(error.message, "error", 4000);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error: any) {
      showCustomToast(error.message, "error", 4000);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/auth/update-password",
      });
      if (error) throw error;
      showCustomToast("Password reset email sent. Please check your inbox.", "success", 4000);
    } catch (error: any) {
      showCustomToast(error.message, "error", 4000);
      throw error;
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      showCustomToast("Password updated successfully!", "success", 3000);
      navigate("/");
    } catch (error: any) {
      showCustomToast(error.message, "error", 4000);
      throw error;
    }
  };

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    user,
    session,
    isLoading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
  }), [user, session, isLoading, navigate]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
