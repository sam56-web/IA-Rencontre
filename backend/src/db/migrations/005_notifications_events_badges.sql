-- Migration: Notifications, Events, Badges, Profile Views
-- Description: Add notification system, events, badges/achievements, and profile view tracking

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE is_read = FALSE;

-- ============================================================
-- PROFILE VIEWS (for affinity/who viewed me)
-- ============================================================

CREATE TABLE profile_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    viewer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    viewed_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(viewer_id, viewed_id)
);

CREATE INDEX idx_profile_views_viewed ON profile_views(viewed_id, created_at DESC);
CREATE INDEX idx_profile_views_viewer ON profile_views(viewer_id, created_at DESC);

-- ============================================================
-- EVENTS
-- ============================================================

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    theme_id UUID REFERENCES themes(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    photo_url VARCHAR(500),
    location_name VARCHAR(200),
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE,
    max_participants INTEGER,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE event_participants (
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'going' CHECK (status IN ('going', 'maybe', 'not_going')),
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (event_id, user_id)
);

CREATE INDEX idx_events_starts ON events(starts_at);
CREATE INDEX idx_events_group ON events(group_id);
CREATE INDEX idx_events_creator ON events(creator_id);
CREATE INDEX idx_events_public ON events(is_public, starts_at DESC);
CREATE INDEX idx_event_participants_user ON event_participants(user_id);

-- Trigger for updated_at
CREATE TRIGGER tr_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- BADGES
-- ============================================================

CREATE TABLE badge_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(20),
    criteria JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_badges (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    badge_id UUID REFERENCES badge_definitions(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, badge_id)
);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);
CREATE INDEX idx_user_badges_badge ON user_badges(badge_id);

-- Seed badge definitions
INSERT INTO badge_definitions (slug, name, description, icon, color, criteria) VALUES
('verified', 'Profil vérifié', 'Identité vérifiée par photo', 'badge-check', 'blue', '{"type": "manual_verification"}'),
('complete_profile', 'Profil complet', 'Profil rempli à 100%', 'user-check', 'green', '{"type": "profile_completeness", "threshold": 100}'),
('active_member', 'Membre actif', '50+ messages envoyés', 'message-circle', 'purple', '{"type": "messages_sent", "threshold": 50}'),
('conversation_starter', 'Brise-glace', '10+ conversations initiées', 'sparkles', 'yellow', '{"type": "conversations_started", "threshold": 10}'),
('group_creator', 'Créateur de communauté', 'A créé un groupe de 10+ membres', 'users', 'orange', '{"type": "group_members", "threshold": 10}'),
('event_organizer', 'Organisateur', 'A créé 3+ événements', 'calendar', 'pink', '{"type": "events_created", "threshold": 3}'),
('early_adopter', 'Early Adopter', 'Parmi les 100 premiers inscrits', 'rocket', 'red', '{"type": "user_rank", "threshold": 100}'),
('super_connector', 'Super Connecteur', '20+ contacts actifs', 'link', 'cyan', '{"type": "active_conversations", "threshold": 20}'),
('theme_expert', 'Expert thématique', '5+ thématiques sélectionnées', 'star', 'amber', '{"type": "themes_selected", "threshold": 5}'),
('social_butterfly', 'Papillon social', 'Membre de 5+ groupes', 'butterfly', 'violet', '{"type": "groups_joined", "threshold": 5}');
