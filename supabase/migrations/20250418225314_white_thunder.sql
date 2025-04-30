/*
  # Customer Metadata and Tagging System

  1. Changes
     - Add metadata JSON field to customers table for flexible data storage
     - Create customer_tags table for tagging and categorization
     - Add last_contact_date field to track engagement
  
  2. Security
     - Existing RLS policies preserved for customers table
     - New RLS policies added for customer_tags table
*/

-- Add metadata field to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add last_contact_date to track when customer was last contacted
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMPTZ;

-- Create customer_tags table
CREATE TABLE IF NOT EXISTS customer_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, tag)
);

-- Enable RLS on customer_tags
ALTER TABLE customer_tags ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for customer_tags
CREATE POLICY "Customer tags are viewable by authenticated users" 
  ON customer_tags FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Customer tags can be inserted by authorized users" 
  ON customer_tags FOR INSERT 
  TO authenticated 
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'manager') OR
    (SELECT assigned_user_id FROM customers WHERE id = customer_id) = auth.uid()
  );

CREATE POLICY "Customer tags can be deleted by authorized users" 
  ON customer_tags FOR DELETE 
  TO authenticated 
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'manager') OR
    (SELECT assigned_user_id FROM customers WHERE id = customer_id) = auth.uid() OR
    created_by = auth.uid()
  );

-- Create index for performance
CREATE INDEX IF NOT EXISTS customer_tags_customer_id_idx ON customer_tags(customer_id);
CREATE INDEX IF NOT EXISTS customer_tags_tag_idx ON customer_tags(tag);

-- Add customer classification field
ALTER TABLE customers ADD COLUMN IF NOT EXISTS classification TEXT DEFAULT 'standard'
  CHECK (classification IN ('vip', 'standard', 'inactive'));

-- Add fields for tracking customer lifecycle
ALTER TABLE customers ADD COLUMN IF NOT EXISTS acquisition_source TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS acquisition_date TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lifetime_value DECIMAL DEFAULT 0;