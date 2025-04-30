/*
  # Admin User Creation

  This migration creates an initial admin user in the system
  by adding a user record to the users table and setting
  necessary permissions.
*/

-- First, insert admin user into users table
INSERT INTO users (
  email, 
  name, 
  role, 
  department, 
  position, 
  status, 
  extension_number
)
VALUES (
  'cenk.okut@ceradijital.com.tr',
  'Admin User',
  'admin',
  'Yönetim',
  'Sistem Yöneticisi',
  'active',
  '100'
);

-- Grant admin all available permissions
INSERT INTO user_permissions (user_id, permission)
SELECT 
  (SELECT id FROM users WHERE email = 'cenk.okut@ceradijital.com.tr'),
  unnest(ARRAY[
    'user:create', 
    'user:read', 
    'user:update', 
    'user:delete',
    'department:create',
    'department:read',
    'department:update',
    'department:delete',
    'call:make',
    'call:receive',
    'call:record',
    'call:listen',
    'call:report',
    'customer:create',
    'customer:read',
    'customer:update',
    'customer:delete'
  ]);

-- Insert initial Verimor configuration (update with real values later)
INSERT INTO verimor_config (api_key, api_secret, pbx_url)
VALUES (
  'DUMMY_API_KEY',
  'DUMMY_API_SECRET',
  'https://api.bulutsantralim.com'
);