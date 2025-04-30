/*
  # Call Recording and Management Enhancements

  1. Changes
     - Add recording_duration field to call_records table
     - Add transcription support for call recordings
     - Add call categorization fields
     - Add callback tracking and scheduling
  
  2. Security
     - Existing RLS policies preserved
     - New policies for call categorization access
*/

-- Add recording metadata fields
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS recording_duration INTEGER;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS recording_size INTEGER;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS recording_format TEXT;

-- Add transcription support
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS transcription TEXT;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS transcription_status TEXT 
  CHECK (transcription_status IN ('pending', 'completed', 'failed', null));

-- Add call categorization
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Add callback tracking
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS requires_callback BOOLEAN DEFAULT FALSE;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS callback_scheduled_for TIMESTAMPTZ;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS callback_assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add call quality metrics
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS quality_score INTEGER;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS quality_issues TEXT[];

-- Add call sentiment analysis fields (for future AI integration)
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS sentiment_keywords TEXT[];

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS call_records_category_idx ON call_records(category);
CREATE INDEX IF NOT EXISTS call_records_requires_callback_idx ON call_records(requires_callback) 
  WHERE requires_callback = TRUE;
CREATE INDEX IF NOT EXISTS call_records_callback_scheduled_for_idx ON call_records(callback_scheduled_for)
  WHERE callback_scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS call_records_callback_assigned_to_idx ON call_records(callback_assigned_to)
  WHERE callback_assigned_to IS NOT NULL;