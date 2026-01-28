-- AI Connect - Section Photos Migration
-- Adds photo columns for each profile section

ALTER TABLE profiles
ADD COLUMN photo_current_life VARCHAR(500),
ADD COLUMN photo_looking_for VARCHAR(500),
ADD COLUMN photo_important VARCHAR(500),
ADD COLUMN photo_not_looking_for VARCHAR(500);

-- Add index for profiles with section photos (for discovery queries)
CREATE INDEX idx_profiles_has_section_photos ON profiles(user_id)
WHERE photo_current_life IS NOT NULL
   OR photo_looking_for IS NOT NULL
   OR photo_important IS NOT NULL
   OR photo_not_looking_for IS NOT NULL;
