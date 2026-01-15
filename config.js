const { PermissionsBitField, ChannelType } = require('discord.js');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

/**
 * Creates the base structure for the server
 */
async function createMainStructure(guild) {
    console.log(`Creating Main Structure for ${guild.name}...`);
    
    const sections = [
        {
            category: 'ADMIN ⚔️',
            channels: [
                { name: 'admin-chat ⚔️', type: ChannelType.GuildText },
                { name: 'admin-logs', type: ChannelType.GuildText },
                { name: 'internal', type: ChannelType.GuildText },
                { name: 'Admins', type: ChannelType.GuildVoice },
                { name: 'Agency Admins', type: ChannelType.GuildVoice }
            ],
            permissions: [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }
            ]
        },
        {
            category: 'START HERE ✅',
            channels: [
                { name: 'start-here ✅', type: ChannelType.GuildText },
                { name: 'announcements 📣', type: ChannelType.GuildText }
            ],
            permissions: [
                { id: guild.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.AddReactions] },
                { id: guild.id, deny: [PermissionsBitField.Flags.SendMessages] }
            ]
        },
        {
            category: 'LEADERBOARDS 🏆',
            channels: [
                { name: 'daily-leaderboard', type: ChannelType.GuildText },
                { name: 'weekly-leaderboard', type: ChannelType.GuildText },
                { name: 'monthly-leaderboard', type: ChannelType.GuildText },
                { name: 'agent-spotlight', type: ChannelType.GuildText },
                { name: 'hall-of-fame', type: ChannelType.GuildText }
            ],
            permissions: [
                { id: guild.id, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages] }
            ]
        },
        {
            category: 'LIVE 🔴',
            channels: [
                { name: 'live-wins', type: ChannelType.GuildText }
            ],
            permissions: [
                { id: guild.id, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages] }
            ]
        },
        {
            category: 'CARRIER RESOURCE HUB 📄',
            channels: [
                { name: 'carrier-resources 🟥', type: ChannelType.GuildText },
                { name: 'carrier-contact ☎️', type: ChannelType.GuildText }
            ],
            permissions: [
                { id: guild.id, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages] }
            ]
        },
        {
            category: 'SALES OPS 💎',
            channels: [
                { name: 'comp 💵', type: ChannelType.GuildText },
                { name: 'lead-vendors 💻', type: ChannelType.GuildText }
            ],
            permissions: [
                { id: guild.id, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages] }
            ]
        },
        {
            category: 'SUPPORT & QUESTIONS ❓',
            channels: [
                { name: 'help-chat ❓', type: ChannelType.GuildText },
                { name: 'underwriting-questions 📝', type: ChannelType.GuildText }
            ],
            permissions: [
                { id: guild.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        }
    ];

    for (const section of sections) {
        const category = await guild.channels.create({
            name: section.category,
            type: ChannelType.GuildCategory,
            permissionOverwrites: section.permissions
        });

        for (const ch of section.channels) {
            await guild.channels.create({
                name: ch.name,
                type: ch.type,
                parent: category.id
            });
            await new Promise(r => setTimeout(r, 500));
        }
    }

    // Save start-here category to server_config
    const startHere = guild.channels.cache.find(c => c.name === 'START HERE ✅' && c.type === ChannelType.GuildCategory);
    if (startHere) {
        await pool.query(
            `INSERT INTO server_config (guild_id, start_here_category_id, server_name) 
             VALUES ($1, $2, $3) ON CONFLICT (guild_id) DO UPDATE SET start_here_category_id = EXCLUDED.start_here_category_id`,
            [guild.id, startHere.id, guild.name]
        );
    }

    return true;
}

/**
 * Initializes agencies and their channels
 */
async function initializeAgencies(guild, agenciesList) {
    console.log(`Initializing ${agenciesList.length} agencies for ${guild.name}...`);
    
    for (const agency of agenciesList) {
        const { name, emoji, is_main } = agency;
        
        // 1. Create Roles
        const leaderRole = await guild.roles.create({
            name: `${name} Leader`,
            color: '#FFD700',
            reason: `Setup for ${name}`
        });

        const agentRole = await guild.roles.create({
            name: name,
            color: '#3498DB',
            reason: `Setup for ${name}`
        });

        // 2. Create Category
        const categoryPermissions = [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: agentRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            { 
                id: leaderRole.id, 
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.ManageChannels,
                    PermissionsBitField.Flags.ManageMessages,
                    PermissionsBitField.Flags.MuteMembers,
                    PermissionsBitField.Flags.MoveMembers,
                    PermissionsBitField.Flags.DeafenMembers
                ]
            }
        ];

        const categoryName = emoji ? `${name} ${emoji}` : name;
        const category = await guild.channels.create({
            name: categoryName,
            type: ChannelType.GuildCategory,
            permissionOverwrites: categoryPermissions
        });

        // 3. Create Channels
        const slug = name.toLowerCase().replace(/\s+/g, '-');
        
        // Text Channels
        const textChannels = [
            { name: `${slug}-general`, type: ChannelType.GuildText },
            { name: `${slug}-wins`, type: ChannelType.GuildText },
            { name: `${slug}-digest`, type: ChannelType.GuildText, private: true },
            { name: `${slug}-resources`, type: ChannelType.GuildText }
        ];

        for (const ch of textChannels) {
            const overwrites = [...categoryPermissions];
            if (ch.private) {
                // Digest is only for leaders and admins
                overwrites.push({ id: agentRole.id, deny: [PermissionsBitField.Flags.ViewChannel] });
            }

            await guild.channels.create({
                name: ch.name,
                type: ch.type,
                parent: category.id,
                permissionOverwrites: overwrites
            });
        }

        // Voice Channels
        const voiceChannels = [
            { name: `${name} Meeting Room`, type: ChannelType.GuildVoice },
            { name: `${name} Dial Room 1`, type: ChannelType.GuildVoice },
            { name: `${name} Dial Room 2`, type: ChannelType.GuildVoice },
            { name: `${name} Dial Room 3`, type: ChannelType.GuildVoice },
            { name: `${name} Dial Room 4`, type: ChannelType.GuildVoice },
            { name: `${name} Dial Room 5`, type: ChannelType.GuildVoice }
        ];

        for (const ch of voiceChannels) {
            await guild.channels.create({
                name: ch.name,
                type: ch.type,
                parent: category.id,
                permissionOverwrites: [
                    { id: guild.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak] }
                ]
            });
        }

        // 4. Save to DB
        const res = await pool.query(
            `INSERT INTO agencies (guild_id, name, role_id, leader_role_id, category_id, emoji, is_main_agency) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING agency_id`,
            [guild.id, name, agentRole.id, leaderRole.id, category.id, emoji, is_main || false]
        );

        if (is_main) {
            await pool.query('UPDATE server_config SET main_agency_id = $1 WHERE guild_id = $2', [res.rows[0].agency_id, guild.id]);
        }
    }
}

/**
 * Non-destructive version of adding agency structure
 */
async function addAgencyStructure(guild, agencies, options = {}) {
    console.log(`Adding ${agencies.length} agencies to ${guild.name} (Non-Destructive)...`);
    
    for (const agency of agencies) {
        const { name } = agency;
        
        // Check if role already exists
        const existingRole = guild.roles.cache.find(r => r.name === name);
        if (existingRole && options.skipExisting) {
            console.log(`Skipping existing agency: ${name}`);
            continue;
        }

        // Check if category already exists
        const existingCat = guild.channels.cache.find(c => c.name.includes(name) && c.type === ChannelType.GuildCategory);
        if (existingCat && options.skipExisting) {
            console.log(`Skipping existing category for: ${name}`);
            continue;
        }

        await initializeAgencies(guild, [agency]);
    }
}

/**
 * Renames channels/categories to standard format without deleting
 * @param {Guild} guild 
 * @param {Array} agencies - [{name: "Name", emoji: "🦁"}]
 */
async function organizeAgencies(guild, agencies) {
    const results = [];
    console.log("Starting Organization/Renaming Process...");

    for (const agency of agencies) {
        const { name, emoji } = agency;
        const safeEmoji = emoji || '';
        // Use first word only for concise channel names
        const slug = name.split(' ')[0].toLowerCase();

        // 1. Find and Rename Category
        const category = guild.channels.cache.find(c =>
            c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes(name.toLowerCase())
        );

        if (category) {
            const newCatName = emoji ? `${name} ${emoji}` : name;
            if (category.name !== newCatName) {
                await category.setName(newCatName);
                results.push(`Renamed Category: ${newCatName}`);
            }

            // 2. Rename Children
            const children = category.children.cache;

            for (const channel of children.values()) {
                let newName = null;

                // Text Channels
                if (channel.type === ChannelType.GuildText) {
                    if (channel.name.includes('general')) newName = `${slug}-general`;
                    else if (channel.name.includes('wins')) newName = `${slug}-wins`;
                    else if (channel.name.includes('digest')) newName = `${slug}-digest`;
                    else if (channel.name.includes('resources')) newName = `${slug}-resources`;
                }

                // Voice Channels
                else if (channel.type === ChannelType.GuildVoice) {
                    if (channel.name.toLowerCase().includes('meeting')) {
                        newName = `${name} Meeting Room`;
                    } else if (channel.name.toLowerCase().includes('dial')) {
                        // Extract number
                        const match = channel.name.match(/(\d+)/);
                        const num = match ? match[1] : '1';
                        newName = `${name} Dial Room ${num}`;
                    }
                }

                if (newName && channel.name !== newName) {
                    await channel.setName(newName);
                    results.push(`Renamed: ${channel.name} -> ${newName}`);
                }
            }
        } else {
            results.push(`⚠️ Category not found for: ${name}`);
        }
    }
    return results;
}

/**
 * Maps a downline agency to an upline agency for permission inheritance
 */
async function mapHierarchy(guild, downlineAgencyId, uplineAgencyId) {
    const guildId = guild.id;
    
    await pool.query(
        'INSERT INTO hierarchy (guild_id, downline_agency_id, upline_agency_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [guildId, downlineAgencyId, uplineAgencyId]
    );

    // Update permissions: Upline gets visibility into Downline's category
    const downlineRes = await pool.query('SELECT category_id FROM agencies WHERE agency_id = $1', [downlineAgencyId]);
    const uplineRes = await pool.query('SELECT role_id FROM agencies WHERE agency_id = $1', [uplineAgencyId]);

    if (downlineRes.rows.length > 0 && uplineRes.rows.length > 0) {
        const categoryId = downlineRes.rows[0].category_id;
        const uplineRoleId = uplineRes.rows[0].role_id;
        
        const category = await guild.channels.fetch(categoryId).catch(() => null);
        if (category) {
            await category.permissionOverwrites.edit(uplineRoleId, {
                ViewChannel: true
            });
        }
    }
}

// DB Helper Functions
async function getUplineAgencies(guildId, agencyId) {
    const res = await pool.query(
        `WITH RECURSIVE upline_tree AS (
            SELECT upline_agency_id FROM hierarchy WHERE guild_id = $1 AND downline_agency_id = $2
            UNION
            SELECT h.upline_agency_id FROM hierarchy h
            JOIN upline_tree ut ON h.downline_agency_id = ut.upline_agency_id
            WHERE h.guild_id = $1
        )
        SELECT a.* FROM agencies a JOIN upline_tree ut ON a.agency_id = ut.upline_agency_id`,
        [guildId, agencyId]
    );
    return res.rows;
}

async function getServerConfig(guildId) {
    const res = await pool.query('SELECT * FROM server_config WHERE guild_id = $1', [guildId]);
    return res.rows[0];
}

async function getLeaderCode(guildId, code) {
    const res = await pool.query('SELECT * FROM leader_codes WHERE guild_id = $1 AND code = $2', [guildId, code]);
    return res.rows[0];
}

async function getAgentMapping(guildId, agentName) {
    const res = await pool.query('SELECT * FROM agent_mapping WHERE guild_id = $1 AND agent_name = $2', [guildId, agentName]);
    return res.rows[0];
}

async function updateAgentBadges(guildId, userId, badges) {
    await pool.query(
        'UPDATE agent_mapping SET current_badges = $1, updated_at = CURRENT_TIMESTAMP WHERE guild_id = $2 AND user_id = $3',
        [badges, guildId, userId]
    );
}

module.exports = {
    pool,
    createMainStructure,
    initializeAgencies,
    addAgencyStructure,
    mapHierarchy,
    getUplineAgencies,
    getServerConfig,
    getLeaderCode,
    getAgentMapping,
    updateAgentBadges,
    organizeAgencies
};
