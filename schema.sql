-- Server configuration (per-server settings)
CREATE TABLE server_config (
    guild_id TEXT PRIMARY KEY,
    server_name TEXT,
    unassigned_role_id TEXT,
    main_agency_id INTEGER,  -- References the "leader" agency
    start_here_category_id TEXT,
    owner_discord_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leader access codes (per-server)
CREATE TABLE leader_codes (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    code TEXT NOT NULL,
    leader_role_id TEXT NOT NULL,
    agency_role_id TEXT,
    description TEXT,
    UNIQUE(guild_id, code)
);

-- Agencies (per-server)
CREATE TABLE agencies (
    agency_id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role_id TEXT NOT NULL,
    leader_role_id TEXT,
    category_id TEXT,
    emoji TEXT,
    is_main_agency BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, name)
);

-- Hierarchy for permission inheritance (per-server)
CREATE TABLE hierarchy (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    downline_agency_id INTEGER REFERENCES agencies(agency_id),
    upline_agency_id INTEGER REFERENCES agencies(agency_id),
    UNIQUE(guild_id, downline_agency_id, upline_agency_id)
);

-- Onboarding log
CREATE TABLE onboarding (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent mapping for badge sync
CREATE TABLE agent_mapping (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,           -- Discord user ID
    agent_name TEXT NOT NULL,         -- Name as it appears on forms
    current_badges TEXT,              -- Comma-separated badge emojis
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, user_id)
);
