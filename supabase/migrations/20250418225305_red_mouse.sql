/*
  # Department Structure Enhancement Migration

  1. Changes
     - Add `manager_name` column to departments table
     - Add `department_code` column to departments
     - Improve department hierarchy support
     - Add department-level permission structure
  
  2. Security
     - All existing RLS policies are preserved
     - New department-specific policies added
*/

-- Add manager_name to departments table
ALTER TABLE departments ADD COLUMN IF NOT EXISTS manager_name TEXT;

-- Add department_code for internal reference
ALTER TABLE departments ADD COLUMN IF NOT EXISTS department_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS departments_code_idx ON public.departments (department_code) 
WHERE department_code IS NOT NULL;

-- Add order_index for displaying departments
ALTER TABLE departments ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Add is_active flag for departments
ALTER TABLE departments ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add department_permissions table for fine-grained access control
CREATE TABLE IF NOT EXISTS department_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (department_id, permission)
);

-- Enable RLS on department_permissions
ALTER TABLE department_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for department_permissions
CREATE POLICY "Department permissions are viewable by authenticated users" 
  ON department_permissions FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Department permissions can be inserted by admins" 
  ON department_permissions FOR INSERT 
  TO authenticated 
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Department permissions can be updated by admins" 
  ON department_permissions FOR UPDATE 
  TO authenticated 
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Department permissions can be deleted by admins" 
  ON department_permissions FOR DELETE 
  TO authenticated 
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Add index for performance
CREATE INDEX IF NOT EXISTS department_permissions_department_id_idx ON department_permissions(department_id);

-- Update users table with full_department_path for hierarchical queries
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_department_path TEXT[];