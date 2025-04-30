/*
  # Create customers table

  1. New Tables
    - `customers`: Store customer information for call center integration
    
  2. Security
    - Enable RLS on the table
    - Add appropriate policies for access control
*/

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  company TEXT,
  assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'lead' CHECK (status IN ('lead', 'customer', 'inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign key to call_records for customer_id
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

-- Enable Row Level Security
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Customers table policies
CREATE POLICY "Customers are viewable by authenticated users" 
  ON customers FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Customers can be inserted by authenticated users" 
  ON customers FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Customers can be updated by users with permission" 
  ON customers FOR UPDATE 
  TO authenticated 
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin' OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'manager' OR
    auth.uid() = assigned_user_id
  );

CREATE POLICY "Customers can be deleted by admins" 
  ON customers FOR DELETE 
  TO authenticated 
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS customers_name_idx ON customers (name);
CREATE INDEX IF NOT EXISTS customers_email_idx ON customers (email);
CREATE INDEX IF NOT EXISTS customers_phone_idx ON customers (phone);
CREATE INDEX IF NOT EXISTS customers_mobile_idx ON customers (mobile);
CREATE INDEX IF NOT EXISTS customers_company_idx ON customers (company);
CREATE INDEX IF NOT EXISTS customers_status_idx ON customers (status);
CREATE INDEX IF NOT EXISTS customers_assigned_user_id_idx ON customers (assigned_user_id);