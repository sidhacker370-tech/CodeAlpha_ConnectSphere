import { create } from 'zustand';
import api from '../services/api';
import { supabase } from '../config/supabase';

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: { name: string; email: string; password: string }) => Promise<void>;
  googleLogin: () => Promise<void>;
  devLogin: (name?: string, email?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

let resolveInit: () => void;
const initPromise = new Promise<void>((resolve) => {
  resolveInit = resolve;
});

export const useAuthStore = create<AuthState>((set) => {
  let isInitialized = false;

  // Listen for Supabase Auth state changes
  supabase.auth.onAuthStateChange(async (_event, session) => {
    // 1. Check if there is an existing dev mock token in localStorage
    const existingToken = localStorage.getItem('accessToken');
    if (existingToken && existingToken.startsWith('{')) {
      try {
        const res = await api.get('/auth/profile');
        set({ 
          user: res.data, 
          isAuthenticated: true, 
          isLoading: false,
          error: null 
        });
      } catch (err: any) {
        localStorage.removeItem('accessToken');
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
      if (!isInitialized) {
        isInitialized = true;
        resolveInit();
      }
      return;
    }

    // 2. Otherwise use standard Supabase listener logic
    if (session) {
      try {
        const token = session.access_token;
        localStorage.setItem('accessToken', token);
        
        // Fetch/sync user profile from local backend database
        const res = await api.get('/auth/profile');
        set({ 
          user: res.data, 
          isAuthenticated: true, 
          isLoading: false,
          error: null 
        });
      } catch (err: any) {
        console.error('Error syncing user profile with backend:', err);
        set({ 
          user: null, 
          isAuthenticated: false, 
          isLoading: false,
          error: 'Session synchronization failed.' 
        });
      }
    } else {
      // Only clear if we aren't in dev mode bypass (dev tokens are JSON strings)
      const currentToken = localStorage.getItem('accessToken');
      if (!currentToken || !currentToken.startsWith('{')) {
        localStorage.removeItem('accessToken');
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    }
    
    if (!isInitialized) {
      isInitialized = true;
      resolveInit();
    }
  });

  return {
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,

    login: async ({ email, password }) => {
      set({ isLoading: true, error: null });
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } catch (err: any) {
        set({
          error: err.message || 'Login failed. Check credentials.',
          isLoading: false,
        });
        throw err;
      }
    },

    register: async ({ name, email, password }) => {
      set({ isLoading: true, error: null });
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name,
            },
          },
        });
        if (error) throw error;
        if (data.session) {
          localStorage.setItem('accessToken', data.session.access_token);
        }
      } catch (err: any) {
        set({
          error: err.message || 'Registration failed. Check inputs.',
          isLoading: false,
        });
        throw err;
      }
    },

    googleLogin: async () => {
      set({ isLoading: true, error: null });
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin + '/dashboard',
          },
        });
        if (error) throw error;
      } catch (err: any) {
        set({
          error: err.message || 'Google Sign-In failed.',
          isLoading: false,
        });
        throw err;
      }
    },

    devLogin: async (name?: string, email?: string) => {
      set({ isLoading: true, error: null });
      try {
        const devId = Math.floor(1000 + Math.random() * 9000);
        const devName = name || `Developer ${devId}`;
        const devEmail = email || `dev-${devId}@connectsphere.local`;
        const mockUser = {
          uid: `dev-user-${devId}`,
          email: devEmail,
          name: devName
        };
        const token = JSON.stringify(mockUser);
        localStorage.setItem('accessToken', token);
        
        // Fetch/sync user profile from local backend database
        const res = await api.get('/auth/profile');
        set({ 
          user: res.data, 
          isAuthenticated: true, 
          isLoading: false,
          error: null 
        });
      } catch (err: any) {
        localStorage.removeItem('accessToken');
        set({
          error: 'Dev Login Bypass failed. Verify backend server is running.',
          isLoading: false,
        });
        throw err;
      }
    },

    logout: async () => {
      set({ isLoading: true });
      try {
        // If we are currently logged in with a dev mock token, just clear localStorage directly!
        const existingToken = localStorage.getItem('accessToken');
        if (existingToken && existingToken.startsWith('{')) {
          localStorage.removeItem('accessToken');
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        localStorage.removeItem('accessToken');
        set({ user: null, isAuthenticated: false, isLoading: false });
      } catch (err: any) {
        console.error('Logout error:', err);
        set({ isLoading: false, error: err.message });
      }
    },

    checkAuth: async () => {
      await initPromise;
    },

    clearError: () => set({ error: null }),
  };
});

