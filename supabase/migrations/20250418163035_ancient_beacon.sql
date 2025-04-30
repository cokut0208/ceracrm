/*
  # Initial Schema Setup for CRM System

  1. New Tables
    - `users`: Store user information including role and department
    - `user_permissions`: Manage user permissions
    - `departments`: Organizational structure
    - `call_records`: Call history and details
    - `verimor_config`: Verimor API integration settings

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for access control
*/

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'employee', 'supervisor')),
  department TEXT NOT NULL,
  position TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  extension_number TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User permissions table (many-to-many)
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission)
);

-- Departments table
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  parent_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Call records table
CREATE TABLE IF NOT EXISTS call_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  caller TEXT NOT NULL,
  recipient TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('answered', 'missed', 'voicemail', 'failed')),
  recording_url TEXT,
  notes TEXT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Verimor configuration
CREATE TABLE IF NOT EXISTS verimor_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key TEXT NOT NULL,
  api_secret TEXT NOT NULL,
  pbx_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE verimor_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users table policies
CREATE POLICY "Users are viewable by authenticated users" 
  ON users FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Users can be inserted by authenticated users" 
  ON users FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Users can be updated by admins or themselves" 
  ON users FOR UPDATE 
  TO authenticated 
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin' OR 
    auth.uid() = id
  );

-- User permissions policies
CREATE POLICY "User permissions are viewable by authenticated users" 
  ON user_permissions FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "User permissions can be inserted by admins" 
  ON user_permissions FOR INSERT 
  TO authenticated 
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "User permissions can be updated by admins" 
  ON user_permissions FOR UPDATE 
  TO authenticated 
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "User permissions can be deleted by admins" 
  ON user_permissions FOR DELETE 
  TO authenticated 
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Department policies
CREATE POLICY "Departments are viewable by authenticated users" 
  ON departments FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Departments can be inserted by admins" 
  ON departments FOR INSERT 
  TO authenticated 
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Departments can be updated by admins" 
  ON departments FOR UPDATE 
  TO authenticated 
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Departments can be deleted by admins" 
  ON departments FOR DELETE 
  TO authenticated 
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Call records policies
CREATE POLICY "Call records are viewable by authenticated users"
  ON call_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own call records"
  ON call_records FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own call records"
  ON call_records FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Verimor config policies
CREATE POLICY "Verimor config is viewable by authenticated users"
  ON verimor_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Verimor config can be inserted by admins"
  ON verimor_config FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Verimor config can be updated by admins"
  ON verimor_config FOR UPDATE
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Verimor config can be deleted by admins"
  ON verimor_config FOR DELETE
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS users_department_idx ON users (department);
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);
CREATE INDEX IF NOT EXISTS users_status_idx ON users (status);
CREATE INDEX IF NOT EXISTS user_permissions_user_id_idx ON user_permissions (user_id);
CREATE INDEX IF NOT EXISTS call_records_user_id_idx ON call_records (user_id);
CREATE INDEX IF NOT EXISTS call_records_direction_idx ON call_records (direction);
CREATE INDEX IF NOT EXISTS call_records_status_idx ON call_records (status);
CREATE INDEX IF NOT EXISTS call_records_start_time_idx ON call_records (start_time);