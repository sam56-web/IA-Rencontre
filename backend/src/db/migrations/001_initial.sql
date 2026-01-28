-- AI Connect - Initial Migration

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================
-- USERS
-- =============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    username VARCHAR(30) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,

    -- Demographics
    birth_year INTEGER CHECK (birth_year > 1900 AND birth_year < EXTRACT(YEAR FROM NOW()) - 17),

    -- Location
    location_city VARCHAR(100),
    location_country VARCHAR(100) NOT NULL,
    timezone VARCHAR(50),

    -- Intentions and preferences
    intentions TEXT[] NOT NULL CHECK (array_length(intentions, 1) >= 1),
    reach_preference VARCHAR(20) DEFAULT 'no_preference'
        CHECK (reach_preference IN ('local_only', 'national', 'international', 'no_preference')),
    open_to_remote BOOLEAN DEFAULT TRUE,
    languages TEXT[] DEFAULT ARRAY['fr'],

    -- Status
    is_premium BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_paused BOOLEAN DEFAULT FALSE,
    pause_until TIMESTAMP WITH TIME ZONE,

    -- Freemium quotas
    weekly_initiatives_used INTEGER DEFAULT 0,
    weekly_initiatives_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '7 days',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- PROFILES (the textual heart)
-- =============================================

CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- The 4 text blocks
    current_life TEXT NOT NULL CHECK (char_length(current_life) >= 20 AND char_length(current_life) <= 1500),
    looking_for TEXT NOT NULL CHECK (char_length(looking_for) >= 20 AND char_length(looking_for) <= 800),
    whats_important TEXT NOT NULL CHECK (char_length(whats_important) >= 20 AND char_length(whats_important) <= 800),
    not_looking_for TEXT CHECK (char_length(not_looking_for) <= 500),

    -- Extracted metadata
    extracted_themes TEXT[] DEFAULT '{}',
    word_count INTEGER GENERATED ALWAYS AS (
        array_length(regexp_split_to_array(current_life || ' ' || looking_for || ' ' || whats_important, '\s+'), 1)
    ) STORED,
    completeness_score INTEGER DEFAULT 0 CHECK (completeness_score >= 0 AND completeness_score <= 100),

    -- Moderation
    moderation_status VARCHAR(20) DEFAULT 'pending'
        CHECK (moderation_status IN ('pending', 'approved', 'flagged', 'rejected')),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- PHOTOS
-- =============================================

CREATE TABLE photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    caption VARCHAR(200),
    category VARCHAR(20) DEFAULT 'self' CHECK (category IN ('self', 'place', 'activity', 'expressive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- CONVERSATIONS
-- =============================================

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    initiated_by UUID NOT NULL REFERENCES users(id),
    initial_quoted_text TEXT,
    matched_intentions TEXT[] DEFAULT '{}',

    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked')),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_conversation UNIQUE (user1_id, user2_id),
    CONSTRAINT ordered_users CHECK (user1_id < user2_id)
);

-- =============================================
-- MESSAGES
-- =============================================

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    content TEXT NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 5000),
    quoted_profile_text TEXT,

    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,

    moderation_status VARCHAR(20) DEFAULT 'pending'
        CHECK (moderation_status IN ('pending', 'approved', 'flagged', 'rejected')),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- BLOCKS & REPORTS
-- =============================================

CREATE TABLE blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_block UNIQUE (blocker_id, blocked_id)
);

CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('profile', 'message', 'photo', 'behavior')),
    content_id UUID,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- MODERATION
-- =============================================

CREATE TABLE user_risk_scores (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    spam_score INTEGER DEFAULT 0,
    toxicity_score INTEGER DEFAULT 0,
    harassment_score INTEGER DEFAULT 0,

    message_asymmetry_score INTEGER DEFAULT 0,
    persistence_score INTEGER DEFAULT 0,
    velocity_score INTEGER DEFAULT 0,

    warning_count INTEGER DEFAULT 0,
    last_warning_at TIMESTAMP WITH TIME ZONE,

    reports_received_count INTEGER DEFAULT 0,
    blocks_received_count INTEGER DEFAULT 0,

    is_shadow_banned BOOLEAN DEFAULT FALSE,
    is_suspended BOOLEAN DEFAULT FALSE,
    suspension_end TIMESTAMP WITH TIME ZONE,

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE moderation_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(30) NOT NULL CHECK (action IN ('warn', 'throttle', 'shadow_ban', 'suspend', 'unsuspend', 'ban')),
    reason TEXT NOT NULL,
    triggered_by VARCHAR(20) CHECK (triggered_by IN ('system', 'report', 'manual')),
    duration_days INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- ZONE STATS (for local vitality)
-- =============================================

CREATE TABLE zone_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country VARCHAR(100) NOT NULL,
    city VARCHAR(100),
    active_count INTEGER DEFAULT 0,
    active_24h INTEGER DEFAULT 0,
    active_7d INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(country, city)
);

-- =============================================
-- REFRESH TOKENS
-- =============================================

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE
);

-- =============================================
-- INDEXES
-- =============================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_location ON users(location_country, location_city);
CREATE INDEX idx_users_intentions ON users USING GIN(intentions);
CREATE INDEX idx_users_active ON users(last_active_at DESC) WHERE is_active = true AND is_paused = false;
CREATE INDEX idx_users_discoverable ON users(location_country, last_active_at DESC)
    WHERE is_active = true AND is_paused = false;

-- Profiles
CREATE INDEX idx_profiles_user ON profiles(user_id);
CREATE INDEX idx_profiles_moderation ON profiles(moderation_status);
CREATE INDEX idx_profiles_themes ON profiles USING GIN(extracted_themes);
CREATE INDEX idx_profiles_completeness ON profiles(completeness_score DESC) WHERE moderation_status = 'approved';

-- Photos
CREATE INDEX idx_photos_user ON photos(user_id, order_index);

-- Conversations
CREATE INDEX idx_conversations_users ON conversations(user1_id, user2_id);
CREATE INDEX idx_conversations_user1 ON conversations(user1_id, last_message_at DESC);
CREATE INDEX idx_conversations_user2 ON conversations(user2_id, last_message_at DESC);

-- Messages
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id, created_at DESC);
CREATE INDEX idx_messages_unread ON messages(conversation_id, is_read) WHERE is_read = false;

-- Blocks
CREATE INDEX idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX idx_blocks_blocked ON blocks(blocked_id);

-- Moderation
CREATE INDEX idx_risk_scores_flagged ON user_risk_scores(user_id)
    WHERE is_shadow_banned = true OR is_suspended = true;

-- Refresh tokens
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- =============================================
-- TRIGGERS
-- =============================================

-- Update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Update last_message_at on new message
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET last_message_at = NEW.created_at
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_message_update_conversation AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();

-- Initialize user_risk_scores
CREATE OR REPLACE FUNCTION create_user_risk_score()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_risk_scores (user_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_user_create_risk_score AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION create_user_risk_score();
