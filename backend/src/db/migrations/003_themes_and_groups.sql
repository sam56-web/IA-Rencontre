-- AI Connect - Themes and Groups Migration

-- =============================================
-- THEMES
-- =============================================

-- Table des thématiques disponibles
CREATE TABLE themes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50),
    category VARCHAR(50) CHECK (category IN ('intellectual', 'creative', 'social', 'lifestyle'))
);

-- Thématiques sélectionnées par user
CREATE TABLE user_themes (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    theme_id UUID REFERENCES themes(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, theme_id)
);

-- Seed des thématiques
INSERT INTO themes (slug, name, icon, category) VALUES
('politique', 'Politique', 'landmark', 'intellectual'),
('art', 'Art & Créativité', 'palette', 'creative'),
('science', 'Science & Tech', 'microscope', 'intellectual'),
('amour', 'Amour & Relations', 'heart', 'social'),
('musique', 'Musique', 'music', 'creative'),
('cinema', 'Cinéma & Séries', 'film', 'creative'),
('litterature', 'Littérature', 'book-open', 'intellectual'),
('voyage', 'Voyage', 'plane', 'lifestyle'),
('sport', 'Sport & Fitness', 'dumbbell', 'lifestyle'),
('cuisine', 'Cuisine & Gastronomie', 'chef-hat', 'lifestyle'),
('philosophie', 'Philosophie', 'brain', 'intellectual'),
('ecologie', 'Écologie', 'leaf', 'social'),
('entrepreneuriat', 'Entrepreneuriat', 'rocket', 'intellectual'),
('spiritualite', 'Spiritualité', 'sparkles', 'lifestyle'),
('jeux', 'Jeux & Gaming', 'gamepad-2', 'creative'),
('photographie', 'Photographie', 'camera', 'creative'),
('mode', 'Mode & Style', 'shirt', 'lifestyle'),
('activisme', 'Activisme & Causes', 'megaphone', 'social');

-- Index pour les thématiques utilisateur
CREATE INDEX idx_user_themes_user ON user_themes(user_id);
CREATE INDEX idx_user_themes_theme ON user_themes(theme_id);

-- =============================================
-- GROUPS
-- =============================================

-- Groupes de discussion
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    photo_url VARCHAR(500),
    theme_id UUID REFERENCES themes(id) ON DELETE SET NULL,
    creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_public BOOLEAN DEFAULT FALSE,
    max_members INTEGER DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Membres des groupes
CREATE TABLE group_members (
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

-- Invitations aux groupes
CREATE TABLE group_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    inviter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    invitee_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, invitee_id)
);

-- Messages de groupe (séparé des messages 1-1)
CREATE TABLE group_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 5000),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_groups_creator ON groups(creator_id);
CREATE INDEX idx_groups_theme ON groups(theme_id);
CREATE INDEX idx_groups_public ON groups(is_public) WHERE is_public = true;
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_messages_group ON group_messages(group_id, created_at DESC);
CREATE INDEX idx_group_messages_sender ON group_messages(sender_id);
CREATE INDEX idx_group_invitations_invitee ON group_invitations(invitee_id) WHERE status = 'pending';
CREATE INDEX idx_group_invitations_group ON group_invitations(group_id);

-- =============================================
-- TRIGGERS
-- =============================================

-- Update updated_at for groups
CREATE TRIGGER tr_groups_updated_at BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
