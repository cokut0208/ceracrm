import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type User, type Permission } from '@/types';
import supabase from '@/lib/supabase';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  updateUser: (updatedUser: Partial<User>) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      
      login: (user, token) => set({ user, token, isAuthenticated: true }),
      
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
      
      hasPermission: (permission) => {
        const { user } = get();
        if (!user) return false;
        
        // Admin has all permissions
        if (user.role === 'admin') return true;
        
        return user.permissions?.includes(permission) || false;
      },
      
      updateUser: (updatedUser) => {
        const { user } = get();
        if (!user) return;
        
        // Only update if there are actual changes
        const hasChanges = Object.keys(updatedUser).some(
          key => key !== 'updatedAt' && updatedUser[key as keyof typeof updatedUser] !== user[key as keyof User]
        );
        
        if (hasChanges) {
          set({ 
            user: { 
              ...user, 
              ...updatedUser,
              updatedAt: new Date().toISOString() 
            } 
          });
        }
      },
      
      setLoading: (isLoading) => set({ isLoading })
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);