-- Migration: Add full-text search to profiles
-- Description: Create search vector column with GIN index for fast text search

-- Add search vector column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Function to update the search vector
CREATE OR REPLACE FUNCTION profiles_search_vector_update() RETURNS trigger AS $$
DECLARE
  username_text text;
BEGIN
  -- Get username from users table
  SELECT username INTO username_text FROM users WHERE id = NEW.user_id;

  NEW.search_vector :=
    setweight(to_tsvector('french', coalesce(username_text, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(NEW.current_life, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(NEW.looking_for, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(NEW.whats_important, '')), 'C') ||
    setweight(to_tsvector('french', coalesce(NEW.not_looking_for, '')), 'C') ||
    setweight(to_tsvector('french', coalesce(array_to_string(NEW.extracted_themes, ' '), '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Trigger for auto-update on insert/update
DROP TRIGGER IF EXISTS profiles_search_vector_trigger ON profiles;
CREATE TRIGGER profiles_search_vector_trigger
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_search_vector_update();

-- GIN index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_search ON profiles USING GIN(search_vector);

-- Update existing profiles
UPDATE profiles p SET search_vector =
  setweight(to_tsvector('french', coalesce(u.username, '')), 'A') ||
  setweight(to_tsvector('french', coalesce(p.current_life, '')), 'B') ||
  setweight(to_tsvector('french', coalesce(p.looking_for, '')), 'B') ||
  setweight(to_tsvector('french', coalesce(p.whats_important, '')), 'C') ||
  setweight(to_tsvector('french', coalesce(p.not_looking_for, '')), 'C') ||
  setweight(to_tsvector('french', coalesce(array_to_string(p.extracted_themes, ' '), '')), 'B')
FROM users u
WHERE p.user_id = u.id;

-- Create index on user_themes for theme search
CREATE INDEX IF NOT EXISTS idx_user_themes_theme ON user_themes(theme_id);
