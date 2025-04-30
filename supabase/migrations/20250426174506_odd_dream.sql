/*
  # Add Avatar Support for Personnel

  1. Changes
    - Add avatar_url column to personnel table
    - Create storage bucket for avatars
    - Add policies for avatar access and upload

  2. Security
    - Enable public read access for avatars
    - Restrict uploads to authenticated users
    - Restrict deletions to admin users
*/

-- Add avatar_url column to personnel table
ALTER TABLE personnel 
ADD COLUMN avatar_url TEXT;

-- Create storage bucket for avatars (if not exists)
DO $$
BEGIN
    -- This function will be executed by Supabase
    -- Create avatars bucket if it doesn't exist
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('avatars', 'avatars', true)
    ON CONFLICT (id) DO NOTHING;

    -- Create policy to allow public access to avatars
    CREATE POLICY "Avatars are publicly accessible"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

    -- Create policy to allow authenticated users to upload avatars
    CREATE POLICY "Users can upload avatars"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'avatars');

    -- Create policy to allow users to update their own avatars
    CREATE POLICY "Users can update their own avatars"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'avatars' AND (auth.uid())::text = (SPLIT_PART(name, '/', 1)));

    -- Create policy to allow admins to delete avatars
    CREATE POLICY "Admins can delete avatars"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'avatars' AND EXISTS (
        SELECT 1 FROM personnel_roles pr
        JOIN roles r ON pr.role_id = r.id
        JOIN personnel p ON pr.personnel_id = p.id
        WHERE p.user_id = auth.uid() AND r.role_name = 'admin'
    ));
END $$;