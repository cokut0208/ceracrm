import supabase from '@/lib/supabase';
import { Department } from '@/types';

// Helper function to map database department to our Department type
const mapDatabaseDepartmentToDepartment = (dbDepartment: any): Department => {
  return {
    id: dbDepartment.id,
    name: dbDepartment.name,
    managerId: dbDepartment.manager_id || undefined,
    parentDepartmentId: dbDepartment.parent_department_id || undefined,
    createdAt: dbDepartment.created_at,
    updatedAt: dbDepartment.updated_at,
  };
};

class DepartmentService {
  async getDepartments(): Promise<Department[]> {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      
      return data.map(mapDatabaseDepartmentToDepartment);
    } catch (error) {
      console.error('Error fetching departments:', error);
      throw error;
    }
  }

  async getDepartmentById(id: string): Promise<Department> {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Departman bulunamadı.');
      
      return mapDatabaseDepartmentToDepartment(data);
    } catch (error) {
      console.error('Error fetching department by ID:', error);
      throw error;
    }
  }

  async createDepartment(departmentData: Partial<Department>): Promise<Department> {
    try {
      const { data, error } = await supabase
        .from('departments')
        .insert({
          name: departmentData.name,
          manager_id: departmentData.managerId,
          parent_department_id: departmentData.parentDepartmentId,
        })
        .select()
        .single();

      if (error) throw error;
      
      return mapDatabaseDepartmentToDepartment(data);
    } catch (error) {
      console.error('Error creating department:', error);
      throw error;
    }
  }

  async updateDepartment(id: string, departmentData: Partial<Department>): Promise<Department> {
    try {
      const updateData: Record<string, any> = {};
      if (departmentData.name) updateData.name = departmentData.name;
      if ('managerId' in departmentData) updateData.manager_id = departmentData.managerId;
      if ('parentDepartmentId' in departmentData) updateData.parent_department_id = departmentData.parentDepartmentId;
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('departments')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      return mapDatabaseDepartmentToDepartment(data);
    } catch (error) {
      console.error('Error updating department:', error);
      throw error;
    }
  }

  async deleteDepartment(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting department:', error);
      throw error;
    }
  }

  async getDepartmentUsers(id: string): Promise<{ id: string; name: string }[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .eq('department', id);

      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Error fetching department users:', error);
      throw error;
    }
  }

  async getDepartmentTree(): Promise<Department[]> {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      
      // Build a nested tree structure recursively
      const departments = data.map(mapDatabaseDepartmentToDepartment);
      
      // This doesn't actually create a tree, but returns all departments.
      // In a real application, you'd build a recursive structure here.
      return departments;
    } catch (error) {
      console.error('Error fetching department tree:', error);
      throw error;
    }
  }
}

export default new DepartmentService();