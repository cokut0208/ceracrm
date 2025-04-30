import supabase from '@/lib/supabase';
import { User, Permission } from '@/types';

interface GetUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  department?: string;
  role?: string;
  status?: 'active' | 'inactive';
}

interface GetUsersResponse {
  users: User[];
  total: number;
}

// Helper function to convert database user to our application User type
const mapDatabaseUserToUser = (dbUser: any, permissions: Permission[] = []): User => {
  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role,
    department: dbUser.department,
    position: dbUser.position,
    status: dbUser.status,
    phone: dbUser.phone || undefined,
    extensionNumber: dbUser.extension_number || undefined,
    sipPassword: dbUser.sip_password || undefined,
    avatarUrl: dbUser.avatar_url || undefined,
    permissions,
    createdAt: dbUser.created_at,
    updatedAt: dbUser.updated_at,
  };
};

class UserService {
  async getUsers(params: GetUsersParams = {}): Promise<GetUsersResponse> {
    try {
      const {
        page = 1,
        limit = 100,
        search = '',
        department,
        role,
        status,
      } = params;

      // Calculate pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      // Start building the query
      let query = supabase
        .from('users')
        .select('*', { count: 'exact' })
        .range(from, to);

      // Apply filters if they exist
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      if (department) {
        query = query.eq('department', department);
      }

      if (role) {
        query = query.eq('role', role);
      }

      if (status) {
        query = query.eq('status', status);
      }

      // Execute the query
      const { data: users, error, count } = await query;

      if (error) throw error;

      // Fetch permissions for all users
      const { data: permissions, error: permissionsError } = await supabase
        .from('user_permissions')
        .select('user_id, permission');

      if (permissionsError) throw permissionsError;

      // Group permissions by user_id
      const permissionsByUser: Record<string, Permission[]> = {};
      permissions.forEach(p => {
        if (!permissionsByUser[p.user_id]) {
          permissionsByUser[p.user_id] = [];
        }
        permissionsByUser[p.user_id].push(p.permission as Permission);
      });

      // Map database users to our User type with permissions
      const mappedUsers = users.map(user => 
        mapDatabaseUserToUser(user, permissionsByUser[user.id] || [])
      );

      return {
        users: mappedUsers,
        total: count || mappedUsers.length,
      };
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  async getUserById(id: string): Promise<User> {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!user) throw new Error('Kullanıcı bulunamadı.');

      // Fetch user permissions
      const { data: permissions, error: permissionsError } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', id);

      if (permissionsError) throw permissionsError;

      return mapDatabaseUserToUser(
        user,
        permissions.map(p => p.permission as Permission)
      );
    } catch (error) {
      console.error('Error fetching user by ID:', error);
      throw error;
    }
  }

  async createUser(userData: Partial<User>): Promise<User> {
    try {
      const { permissions, ...userDataWithoutPermissions } = userData;

      // Insert user
      const { data: user, error } = await supabase
        .from('users')
        .insert({
          name: userDataWithoutPermissions.name,
          email: userDataWithoutPermissions.email,
          role: userDataWithoutPermissions.role,
          department: userDataWithoutPermissions.department,
          position: userDataWithoutPermissions.position,
          status: userDataWithoutPermissions.status || 'active',
          extension_number: userDataWithoutPermissions.extensionNumber,
          sip_password: userDataWithoutPermissions.sipPassword,
          phone: userDataWithoutPermissions.phone,
          avatar_url: userDataWithoutPermissions.avatarUrl,
        })
        .select()
        .single();

      if (error) throw error;

      // If permissions are provided, insert them
      if (permissions && permissions.length > 0) {
        const permissionsToInsert = permissions.map(permission => ({
          user_id: user.id,
          permission,
        }));

        const { error: permissionsError } = await supabase
          .from('user_permissions')
          .insert(permissionsToInsert);

        if (permissionsError) throw permissionsError;
      }

      return mapDatabaseUserToUser(user, permissions || []);
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    try {
      const { permissions, ...userDataToUpdate } = userData;

      // Prepare the user data for update
      const updateData: Record<string, any> = {};
      if (userDataToUpdate.name) updateData.name = userDataToUpdate.name;
      if (userDataToUpdate.email) updateData.email = userDataToUpdate.email;
      if (userDataToUpdate.role) updateData.role = userDataToUpdate.role;
      if (userDataToUpdate.department) updateData.department = userDataToUpdate.department;
      if (userDataToUpdate.position) updateData.position = userDataToUpdate.position;
      if (userDataToUpdate.status) updateData.status = userDataToUpdate.status;
      if ('extensionNumber' in userDataToUpdate) updateData.extension_number = userDataToUpdate.extensionNumber;
      if ('sipPassword' in userDataToUpdate) updateData.sip_password = userDataToUpdate.sipPassword;
      if ('phone' in userDataToUpdate) updateData.phone = userDataToUpdate.phone;
      if ('avatarUrl' in userDataToUpdate) updateData.avatar_url = userDataToUpdate.avatarUrl;
      updateData.updated_at = new Date().toISOString();

      // Update user
      const { data: user, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // If permissions are provided, update them
      if (permissions) {
        // First, delete existing permissions
        const { error: deleteError } = await supabase
          .from('user_permissions')
          .delete()
          .eq('user_id', id);

        if (deleteError) throw deleteError;

        // Then, insert new permissions if there are any
        if (permissions.length > 0) {
          const permissionsToInsert = permissions.map(permission => ({
            user_id: id,
            permission,
          }));

          const { error: insertError } = await supabase
            .from('user_permissions')
            .insert(permissionsToInsert);

          if (insertError) throw insertError;
        }
      }

      return mapDatabaseUserToUser(user, permissions || []);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  async updateUserStatus(id: string, status: 'active' | 'inactive'): Promise<User> {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Fetch user permissions
      const { data: permissions, error: permissionsError } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', id);

      if (permissionsError) throw permissionsError;

      return mapDatabaseUserToUser(
        user,
        permissions.map(p => p.permission as Permission)
      );
    } catch (error) {
      console.error('Error updating user status:', error);
      throw error;
    }
  }

  async getUserPermissions(id: string): Promise<Permission[]> {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', id);

      if (error) throw error;

      return data.map(p => p.permission as Permission);
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      throw error;
    }
  }

  async updateUserPermissions(id: string, permissions: Permission[]): Promise<void> {
    try {
      // First, delete existing permissions
      const { error: deleteError } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', id);

      if (deleteError) throw deleteError;

      // Then, insert new permissions
      if (permissions.length > 0) {
        const permissionsToInsert = permissions.map(permission => ({
          user_id: id,
          permission,
        }));

        const { error: insertError } = await supabase
          .from('user_permissions')
          .insert(permissionsToInsert);

        if (insertError) throw insertError;
      }
    } catch (error) {
      console.error('Error updating user permissions:', error);
      throw error;
    }
  }
}

export default new UserService();