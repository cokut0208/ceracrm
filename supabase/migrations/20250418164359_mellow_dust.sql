-- Fix column name mismatch between code and database
ALTER TABLE call_records RENAME COLUMN caller TO "from";
ALTER TABLE call_records RENAME COLUMN recipient TO "to";