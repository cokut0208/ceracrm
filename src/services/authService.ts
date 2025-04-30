import supabase from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { User, Permission } from '@/types';

interface SignInCredentials {
  email: string;
  password: string;
}

interface SignUpCredentials extends SignInCredentials {
  name: string;
  role: 'admin' | 'manager' | 'employee' | 'supervisor';
  department: string;
  position: string;
  extensionNumber?: string;
  sipPassword?: string;
}

const formatUserData = async (userId: string): Promise<User | null> => {
  try {
    // Fetch user details
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      console.error('User data fetch error:', userError);
      return null;
    }

    // Fetch user permissions
    const { data: permissionsData, error: permissionsError } = await supabase
      .from('user_permissions')
      .select('permission')
      .eq('user_id', userId);

    if (permissionsError) {
      console.error('Permissions fetch error:', permissionsError);
      return null;
    }

    // Format the user object to match our application's User type
    const user: User = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      department: userData.department,
      position: userData.position,
      status: userData.status,
      phone: userData.phone || undefined,
      extensionNumber: userData.extension_number || undefined,
      sipPassword: userData.sip_password || undefined,
      avatarUrl: userData.avatar_url || undefined,
      permissions: permissionsData?.map(p => p.permission as Permission) || [],
      createdAt: userData.created_at,
      updatedAt: userData.updated_at,
    };

    return user;
  } catch (error) {
    console.error('Error formatting user data:', error);
    return null;
  }
};

export const signIn = async ({ email, password }: SignInCredentials) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    if (data.user) {
      const user = await formatUserData(data.user.id);
      if (user) {
        // Update auth store with user info and token
        useAuthStore.getState().login(user, data.session?.access_token || '');
        return { user, success: true };
      }
    }

    throw new Error('Kullanıcı bilgileri alınamadı.');
  } catch (error) {
    console.error('Sign in error:', error);
    return { success: false, error };
  }
};

export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    useAuthStore.getState().logout();
    return { success: true };
  } catch (error) {
    console.error('Sign out error:', error);
    return { success: false, error };
  }
};

export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;

    const user = await formatUserData(data.user.id);
    return user;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
};

export const createUser = async (userData: Omit<SignUpCredentials, 'password'> & { password?: string }) => {
  try {
    // Generate a random password if not provided (for user creation by admin)
    const password = userData.password || Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    
    // Get the session token for the current user
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
    }
    
    // Call the create-user edge function with the user's session token
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const functionUrl = `${supabaseUrl}/functions/v1/create-user`;
    
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        ...userData,
        password,
      }),
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(result.error || "Kullanıcı oluşturulurken bir hata oluştu");
    }

    return { success: true, user: result.user };
  } catch (error) {
    console.error('Create user error:', error);
    return { success: false, error };
  }
};

export const resetPassword = async (email: string) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Reset password error:', error);
    return { success: false, error };
  }
};

export const updatePassword = async (password: string) => {
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Update password error:', error);
    return { success: false, error };
  }
};

export default {
  signIn,
  signOut,
  getCurrentUser,
  createUser,
  resetPassword,
  updatePassword,
};