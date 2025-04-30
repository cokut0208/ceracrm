/*
  # Add SIP Password Field to Users

  1. Changes
     - Add sip_password column to users table
     - This allows storing SIP authentication credentials separately from user passwords
  
  2. Security
     - All existing RLS policies are preserved
     - SIP passwords are stored as plain text for compatibility with SIP clients
     - In a production environment, better encryption might be considered
*/

-- Add sip_password column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS sip_password TEXT;