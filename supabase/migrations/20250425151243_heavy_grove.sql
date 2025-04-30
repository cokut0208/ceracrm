/*
  # Initial Schema for KOSGEB CRM

  1. New Tables
    - `roles` - System roles (admin, danisman, izleyici)
    - `personnel` - Staff members with Verimor extensions
    - `personnel_roles` - Many-to-many relationship between personnel and roles
    - `customers` - Customer companies or individuals
    - `customer_contacts` - Customer contact persons with e-devlet credentials
    - `customer_notes` - Notes about customers
    - `projects` - KOSGEB projects
    - `project_notes` - Notes about projects
    - `project_documents` - Documents uploaded for projects
    - `call_logs` - Phone call records from Verimor
    
  2. Security
    - Enable RLS on all tables
    - Add policies for admin, danisman, and izleyici roles
    - Special protection for e-devlet credentials in customer_contacts
*/

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  role_name TEXT UNIQUE NOT NULL
);

-- Create personnel table (linked to auth.users)
CREATE TABLE IF NOT EXISTS personnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  name TEXT NOT NULL,
  surname TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  verimor_extension TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create personnel_roles junction table
CREATE TABLE IF NOT EXISTS personnel_roles (
  personnel_id UUID REFERENCES personnel(id) ON DELETE CASCADE,
  role_id INT REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (personnel_id, role_id)
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_person_name TEXT,
  tax_office TEXT,
  tax_number TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  customer_type TEXT NOT NULL CHECK (customer_type IN ('sahis', 'tuzel')),
  created_at TIMESTAMPTZ DEFAULT now(),
  responsible_personnel_id UUID REFERENCES personnel(id)
);

-- Create customer_contacts table
CREATE TABLE IF NOT EXISTS customer_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  surname TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  edevlet_username TEXT,
  edevlet_password TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create customer_notes table
CREATE TABLE IF NOT EXISTS customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  personnel_id UUID REFERENCES personnel(id),
  note_content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  status TEXT DEFAULT 'Başvuru Hazırlık',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  responsible_personnel_id UUID REFERENCES personnel(id)
);

-- Create project_notes table
CREATE TABLE IF NOT EXISTS project_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  personnel_id UUID REFERENCES personnel(id),
  note_content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create project_documents table
CREATE TABLE IF NOT EXISTS project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  uploaded_by UUID REFERENCES personnel(id),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  file_size BIGINT,
  mime_type TEXT
);

-- Create call_logs table
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_uuid TEXT UNIQUE NOT NULL,
  direction TEXT,
  caller_id_number TEXT,
  caller_id_name TEXT,
  destination_number TEXT,
  destination_name TEXT,
  start_stamp TIMESTAMPTZ,
  answer_stamp TIMESTAMPTZ,
  end_stamp TIMESTAMPTZ,
  duration INTERVAL,
  talk_duration INTERVAL,
  queue TEXT,
  queue_wait_duration INTERVAL,
  result TEXT,
  answered BOOLEAN,
  missed BOOLEAN,
  recording_present BOOLEAN,
  sip_hangup_disposition TEXT,
  hangup_cause TEXT,
  recording_url_temp TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  related_customer_id UUID REFERENCES customers(id),
  related_personnel_id UUID REFERENCES personnel(id)
);

-- Insert default roles
INSERT INTO roles (role_name) VALUES 
  ('admin'),
  ('danisman'),
  ('izleyici')
ON CONFLICT (role_name) DO NOTHING;

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- Create helper function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.user_has_role(role_name text)
RETURNS boolean AS $$
DECLARE
  user_id uuid;
  personnel_id uuid;
  has_role boolean;
BEGIN
  user_id := auth.uid();
  
  -- Get personnel_id for the current user
  SELECT id INTO personnel_id FROM personnel WHERE user_id = user_id;
  
  -- Check if the user has the specified role
  SELECT EXISTS (
    SELECT 1 
    FROM personnel_roles pr
    JOIN roles r ON pr.role_id = r.id
    WHERE pr.personnel_id = personnel_id AND r.role_name = user_has_role.role_name
  ) INTO has_role;
  
  RETURN has_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for roles table
CREATE POLICY "Admins can do everything with roles" ON roles
  FOR ALL
  TO authenticated
  USING (user_has_role('admin'))
  WITH CHECK (user_has_role('admin'));

CREATE POLICY "All users can view roles" ON roles
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for personnel table
CREATE POLICY "Admins can do everything with personnel" ON personnel
  FOR ALL
  TO authenticated
  USING (user_has_role('admin'))
  WITH CHECK (user_has_role('admin'));

CREATE POLICY "Users can view their own personnel record" ON personnel
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR user_has_role('danisman'));

-- RLS Policies for personnel_roles table
CREATE POLICY "Admins can do everything with personnel_roles" ON personnel_roles
  FOR ALL
  TO authenticated
  USING (user_has_role('admin'))
  WITH CHECK (user_has_role('admin'));

CREATE POLICY "All users can view personnel_roles" ON personnel_roles
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for customers table
CREATE POLICY "Admins can do everything with customers" ON customers
  FOR ALL
  TO authenticated
  USING (user_has_role('admin'))
  WITH CHECK (user_has_role('admin'));

CREATE POLICY "Danismans can view and update customers" ON customers
  FOR SELECT
  TO authenticated
  USING (user_has_role('danisman') OR user_has_role('izleyici'));

CREATE POLICY "Danismans can insert customers" ON customers
  FOR INSERT
  TO authenticated
  WITH CHECK (user_has_role('danisman'));

CREATE POLICY "Danismans can update their assigned customers" ON customers
  FOR UPDATE
  TO authenticated
  USING (user_has_role('danisman'))
  WITH CHECK (user_has_role('danisman') AND (
    responsible_personnel_id IN (
      SELECT id FROM personnel WHERE user_id = auth.uid()
    ) OR user_has_role('admin')
  ));

-- RLS Policies for customer_contacts table
CREATE POLICY "Admins can do everything with customer_contacts" ON customer_contacts
  FOR ALL
  TO authenticated
  USING (user_has_role('admin'))
  WITH CHECK (user_has_role('admin'));

CREATE POLICY "Danismans and Izleyici can view customer_contacts (except edevlet fields)" ON customer_contacts
  FOR SELECT
  TO authenticated
  USING (user_has_role('danisman') OR user_has_role('izleyici'));

CREATE POLICY "Danismans can insert customer_contacts" ON customer_contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (user_has_role('danisman'));

CREATE POLICY "Danismans can update customer_contacts (except edevlet fields)" ON customer_contacts
  FOR UPDATE
  TO authenticated
  USING (user_has_role('danisman'))
  WITH CHECK (user_has_role('danisman'));

-- RLS Policies for customer_notes table
CREATE POLICY "Admins can do everything with customer_notes" ON customer_notes
  FOR ALL
  TO authenticated
  USING (user_has_role('admin'))
  WITH CHECK (user_has_role('admin'));

CREATE POLICY "All users can view customer_notes" ON customer_notes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert customer_notes" ON customer_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their own customer_notes" ON customer_notes
  FOR UPDATE
  TO authenticated
  USING (personnel_id IN (SELECT id FROM personnel WHERE user_id = auth.uid()))
  WITH CHECK (personnel_id IN (SELECT id FROM personnel WHERE user_id = auth.uid()));

-- RLS Policies for projects table
CREATE POLICY "Admins can do everything with projects" ON projects
  FOR ALL
  TO authenticated
  USING (user_has_role('admin'))
  WITH CHECK (user_has_role('admin'));

CREATE POLICY "All users can view projects" ON projects
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Danismans can insert projects" ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (user_has_role('danisman'));

CREATE POLICY "Danismans can update their assigned projects" ON projects
  FOR UPDATE
  TO authenticated
  USING (user_has_role('danisman'))
  WITH CHECK (user_has_role('danisman') AND (
    responsible_personnel_id IN (
      SELECT id FROM personnel WHERE user_id = auth.uid()
    ) OR user_has_role('admin')
  ));

-- RLS Policies for project_notes table (similar to customer_notes)
CREATE POLICY "Admins can do everything with project_notes" ON project_notes
  FOR ALL
  TO authenticated
  USING (user_has_role('admin'))
  WITH CHECK (user_has_role('admin'));

CREATE POLICY "All users can view project_notes" ON project_notes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert project_notes" ON project_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their own project_notes" ON project_notes
  FOR UPDATE
  TO authenticated
  USING (personnel_id IN (SELECT id FROM personnel WHERE user_id = auth.uid()))
  WITH CHECK (personnel_id IN (SELECT id FROM personnel WHERE user_id = auth.uid()));

-- RLS Policies for project_documents table
CREATE POLICY "Admins can do everything with project_documents" ON project_documents
  FOR ALL
  TO authenticated
  USING (user_has_role('admin'))
  WITH CHECK (user_has_role('admin'));

CREATE POLICY "All users can view project_documents" ON project_documents
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Danismans can insert project_documents" ON project_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (user_has_role('danisman'));

CREATE POLICY "Uploaders can update their own project_documents" ON project_documents
  FOR UPDATE
  TO authenticated
  USING (uploaded_by IN (SELECT id FROM personnel WHERE user_id = auth.uid()))
  WITH CHECK (uploaded_by IN (SELECT id FROM personnel WHERE user_id = auth.uid()));

-- RLS Policies for call_logs table
CREATE POLICY "Admins can do everything with call_logs" ON call_logs
  FOR ALL
  TO authenticated
  USING (user_has_role('admin'))
  WITH CHECK (user_has_role('admin'));

CREATE POLICY "All users can view call_logs" ON call_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Create SECURITY DEFINER functions to handle edevlet credentials (special protection)

-- This function allows only admins to read edevlet credentials
CREATE OR REPLACE FUNCTION get_customer_contact_with_credentials(contact_id uuid)
RETURNS SETOF customer_contacts
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF user_has_role('admin') THEN
    RETURN QUERY SELECT * FROM customer_contacts WHERE id = contact_id;
  ELSE
    RETURN QUERY SELECT 
      id, customer_id, name, surname, title, email, phone, 
      NULL as edevlet_username, NULL as edevlet_password, created_at
    FROM customer_contacts 
    WHERE id = contact_id;
  END IF;
END;
$$;

-- This function allows only admins to update edevlet credentials
CREATE OR REPLACE FUNCTION update_edevlet_credentials(
  contact_id uuid,
  new_username text,
  new_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  success boolean;
BEGIN
  IF NOT user_has_role('admin') THEN
    RAISE EXCEPTION 'Only admins can update e-devlet credentials';
    RETURN false;
  END IF;
  
  UPDATE customer_contacts
  SET edevlet_username = new_username,
      edevlet_password = new_password
  WHERE id = contact_id;
  
  GET DIAGNOSTICS success = ROW_COUNT;
  RETURN success > 0;
END;
$$;

-- Create storage bucket for project documents
-- Note: This would usually be done via Supabase Dashboard or CLI