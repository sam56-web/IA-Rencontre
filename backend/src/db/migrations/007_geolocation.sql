-- Migration 007: Géolocalisation pour le Globe 3D

-- Ajouter colonnes de géolocalisation aux users (approximatives pour confidentialité)
ALTER TABLE users ADD COLUMN IF NOT EXISTS approximate_latitude DECIMAL(10, 6);
ALTER TABLE users ADD COLUMN IF NOT EXISTS approximate_longitude DECIMAL(11, 6);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- Table pour les connexions actives (cache pour performance)
CREATE TABLE IF NOT EXISTS active_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connection_type VARCHAR(20) NOT NULL CHECK (connection_type IN ('conversation', 'match', 'mutual_interest')),
    intensity_score INTEGER DEFAULT 0 CHECK (intensity_score >= 0 AND intensity_score <= 100),
    last_interaction_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, connection_id)
);

-- Table pour le cache des connexions du globe
CREATE TABLE IF NOT EXISTS globe_connections_cache (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '5 minutes',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, connection_id)
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_active_connections_user ON active_connections(user_id, last_interaction_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_geolocation ON users(approximate_latitude, approximate_longitude)
    WHERE approximate_latitude IS NOT NULL AND approximate_longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_globe_cache_expires ON globe_connections_cache(expires_at);

-- Fonction pour nettoyer le cache expiré
CREATE OR REPLACE FUNCTION cleanup_expired_globe_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM globe_connections_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Fonction pour générer des coordonnées approximatives depuis la ville
CREATE OR REPLACE FUNCTION generate_approximate_coordinates(p_city TEXT, p_country TEXT DEFAULT NULL)
RETURNS TABLE(lat DECIMAL, lon DECIMAL) AS $$
BEGIN
    -- Coordonnées par villes/pays principaux (avec randomisation pour confidentialité)
    IF p_city ILIKE '%paris%' THEN
        lat := 48.8566 + (RANDOM() * 0.2 - 0.1);
        lon := 2.3522 + (RANDOM() * 0.2 - 0.1);
    ELSIF p_city ILIKE '%lyon%' THEN
        lat := 45.7640 + (RANDOM() * 0.15 - 0.075);
        lon := 4.8357 + (RANDOM() * 0.15 - 0.075);
    ELSIF p_city ILIKE '%marseille%' THEN
        lat := 43.2965 + (RANDOM() * 0.15 - 0.075);
        lon := 5.3698 + (RANDOM() * 0.15 - 0.075);
    ELSIF p_city ILIKE '%toulouse%' THEN
        lat := 43.6047 + (RANDOM() * 0.15 - 0.075);
        lon := 1.4442 + (RANDOM() * 0.15 - 0.075);
    ELSIF p_city ILIKE '%nice%' THEN
        lat := 43.7102 + (RANDOM() * 0.1 - 0.05);
        lon := 7.2620 + (RANDOM() * 0.1 - 0.05);
    ELSIF p_city ILIKE '%bordeaux%' THEN
        lat := 44.8378 + (RANDOM() * 0.15 - 0.075);
        lon := -0.5792 + (RANDOM() * 0.15 - 0.075);
    ELSIF p_city ILIKE '%lille%' THEN
        lat := 50.6292 + (RANDOM() * 0.1 - 0.05);
        lon := 3.0573 + (RANDOM() * 0.1 - 0.05);
    ELSIF p_city ILIKE '%new york%' THEN
        lat := 40.7128 + (RANDOM() * 0.3 - 0.15);
        lon := -74.0060 + (RANDOM() * 0.3 - 0.15);
    ELSIF p_city ILIKE '%los angeles%' THEN
        lat := 34.0522 + (RANDOM() * 0.4 - 0.2);
        lon := -118.2437 + (RANDOM() * 0.4 - 0.2);
    ELSIF p_city ILIKE '%tokyo%' THEN
        lat := 35.6762 + (RANDOM() * 0.4 - 0.2);
        lon := 139.6503 + (RANDOM() * 0.4 - 0.2);
    ELSIF p_city ILIKE '%london%' OR p_city ILIKE '%londres%' THEN
        lat := 51.5074 + (RANDOM() * 0.2 - 0.1);
        lon := -0.1278 + (RANDOM() * 0.2 - 0.1);
    ELSIF p_city ILIKE '%berlin%' THEN
        lat := 52.5200 + (RANDOM() * 0.2 - 0.1);
        lon := 13.4050 + (RANDOM() * 0.2 - 0.1);
    ELSIF p_city ILIKE '%barcelona%' OR p_city ILIKE '%barcelone%' THEN
        lat := 41.3851 + (RANDOM() * 0.15 - 0.075);
        lon := 2.1734 + (RANDOM() * 0.15 - 0.075);
    ELSIF p_city ILIKE '%rome%' OR p_city ILIKE '%roma%' THEN
        lat := 41.9028 + (RANDOM() * 0.15 - 0.075);
        lon := 12.4964 + (RANDOM() * 0.15 - 0.075);
    ELSIF p_city ILIKE '%amsterdam%' THEN
        lat := 52.3676 + (RANDOM() * 0.1 - 0.05);
        lon := 4.9041 + (RANDOM() * 0.1 - 0.05);
    ELSIF p_city ILIKE '%sydney%' THEN
        lat := -33.8688 + (RANDOM() * 0.3 - 0.15);
        lon := 151.2093 + (RANDOM() * 0.3 - 0.15);
    ELSIF p_city ILIKE '%montreal%' OR p_city ILIKE '%montréal%' THEN
        lat := 45.5017 + (RANDOM() * 0.2 - 0.1);
        lon := -73.5673 + (RANDOM() * 0.2 - 0.1);
    ELSIF p_country ILIKE '%france%' THEN
        lat := 46.2276 + (RANDOM() * 6 - 3);
        lon := 2.2137 + (RANDOM() * 6 - 3);
    ELSIF p_country ILIKE '%usa%' OR p_country ILIKE '%états-unis%' OR p_country ILIKE '%united states%' THEN
        lat := 39.8283 + (RANDOM() * 20 - 10);
        lon := -98.5795 + (RANDOM() * 40 - 20);
    ELSIF p_country ILIKE '%japan%' OR p_country ILIKE '%japon%' THEN
        lat := 36.2048 + (RANDOM() * 8 - 4);
        lon := 138.2529 + (RANDOM() * 8 - 4);
    ELSIF p_country ILIKE '%uk%' OR p_country ILIKE '%united kingdom%' OR p_country ILIKE '%royaume-uni%' THEN
        lat := 55.3781 + (RANDOM() * 6 - 3);
        lon := -3.4360 + (RANDOM() * 6 - 3);
    ELSIF p_country ILIKE '%germany%' OR p_country ILIKE '%allemagne%' THEN
        lat := 51.1657 + (RANDOM() * 6 - 3);
        lon := 10.4515 + (RANDOM() * 6 - 3);
    ELSIF p_country ILIKE '%spain%' OR p_country ILIKE '%espagne%' THEN
        lat := 40.4637 + (RANDOM() * 6 - 3);
        lon := -3.7492 + (RANDOM() * 6 - 3);
    ELSIF p_country ILIKE '%italy%' OR p_country ILIKE '%italie%' THEN
        lat := 41.8719 + (RANDOM() * 6 - 3);
        lon := 12.5674 + (RANDOM() * 6 - 3);
    ELSIF p_country ILIKE '%canada%' THEN
        lat := 56.1304 + (RANDOM() * 15 - 7.5);
        lon := -106.3468 + (RANDOM() * 30 - 15);
    ELSIF p_country ILIKE '%australia%' OR p_country ILIKE '%australie%' THEN
        lat := -25.2744 + (RANDOM() * 15 - 7.5);
        lon := 133.7751 + (RANDOM() * 20 - 10);
    ELSIF p_country ILIKE '%brazil%' OR p_country ILIKE '%brésil%' THEN
        lat := -14.2350 + (RANDOM() * 20 - 10);
        lon := -51.9253 + (RANDOM() * 20 - 10);
    ELSE
        -- Coordonnées aléatoires dans le monde (hors pôles)
        lat := (RANDOM() * 140 - 70);
        lon := (RANDOM() * 360 - 180);
    END IF;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Mettre à jour les utilisateurs existants avec des coordonnées
DO $$
DECLARE
    user_record RECORD;
    coords RECORD;
BEGIN
    FOR user_record IN
        SELECT id, location_city, location_country
        FROM users
        WHERE approximate_latitude IS NULL
        AND (location_city IS NOT NULL OR location_country IS NOT NULL)
    LOOP
        SELECT * INTO coords FROM generate_approximate_coordinates(
            user_record.location_city,
            user_record.location_country
        );

        UPDATE users
        SET approximate_latitude = coords.lat,
            approximate_longitude = coords.lon
        WHERE id = user_record.id;
    END LOOP;
END $$;
