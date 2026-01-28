-- AI Connect - Section Multiple Photos Migration
-- Allows multiple photos per section (integrated into profile text)

-- Drop old single-photo columns from profiles
ALTER TABLE profiles DROP COLUMN IF EXISTS photo_current_life;
ALTER TABLE profiles DROP COLUMN IF EXISTS photo_looking_for;
ALTER TABLE profiles DROP COLUMN IF EXISTS photo_important;
ALTER TABLE profiles DROP COLUMN IF EXISTS photo_not_looking_for;

-- Drop old index if exists
DROP INDEX IF EXISTS idx_profiles_has_section_photos;

-- Create section_photos table for multiple photos per section
CREATE TABLE IF NOT EXISTS section_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    section VARCHAR(50) NOT NULL CHECK (section IN ('current_life', 'looking_for', 'important')),
    url VARCHAR(500) NOT NULL,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient queries by user and section
CREATE INDEX IF NOT EXISTS idx_section_photos_user_section ON section_photos(user_id, section, position);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_section_photos_url ON section_photos(url);

-- Comment: Section limits are enforced in application code:
-- current_life: max 4 photos
-- looking_for: max 4 photos
-- important: max 2 photos
-- not_looking_for: 0 photos (not allowed)
