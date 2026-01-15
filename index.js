const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    Events, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ChannelType,
    PermissionsBitField
} = require('discord.js');
const express = require('express');
require('dotenv').config();

const { 
    pool, 
    createMainStructure, 
    initializeAgencies, 
    addAgencyStructure,
    mapHierarchy, 
    getServerConfig, 
    getLeaderCode, 
    getAgentMapping,
    updateAgentBadges,
    organizeAgencies
} = require('./config');

const { parseInsuranceCommand, processWizardStep } = require('./ai_manager');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

const SPENCER_ID = process.env.SPENCER_DISCORD_ID;

const wizardSessions = new Map(); // userId -> wizardData

// --- EXPRESS SERVER FOR BADGE SYNC ---
const app = express();
app.use(express.json());

app.post('/api/badges', async (req, res) => {
    const { guildId, agentName, badges } = req.body;
    
    try {
        const mapping = await getAgentMapping(guildId, agentName);
        if (!mapping) return res.status(404).send('Agent not found');
        
        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(mapping.user_id);
        
        const badgeString = Array.isArray(badges) ? badges.join('') : badges;
        const newNickname = `${agentName} ${badgeString}`.trim();
        
        if (member.manageable) {
            await member.setNickname(newNickname.substring(0, 32));
        }
        
        await updateAgentBadges(guildId, mapping.user_id, badgeString);
        res.send({ success: true });
    } catch (err) {
        console.error("Badge Sync Error:", err);
        res.status(500).send({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Badge sync API listening on port ${PORT}`));

// --- DISCORD EVENTS ---

client.once(Events.ClientReady, () => {
    console.log(`Agency Builder Bot active as ${client.user.tag}`);
});

/**
 * Auto-assign Unassigned role on join
 */
client.on(Events.GuildMemberAdd, async member => {
    const config = await getServerConfig(member.guild.id);
    if (config && config.unassigned_role_id) {
        await member.roles.add(config.unassigned_role_id).catch(console.error);
    }
});

client.on(Events.InteractionCreate, async interaction => {
    // 1. Handle Chat Commands
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        // Security check for administrative commands
        const adminCommands = ['war-room', 'setup-server', 'initialize-agencies', 'wipe-structure', 'add-leader-code', 'list-leader-codes', 'remove-leader-code', 'organize-channels'];
        if (adminCommands.includes(commandName) && interaction.user.id !== SPENCER_ID) {
            return interaction.reply({ content: "Access Denied: Spencer only.", ephemeral: true });
        }

        if (commandName === 'clear-channel') {
            const amount = interaction.options.getInteger('amount') || 100;
            await interaction.channel.bulkDelete(Math.min(amount, 100), true);
            return interaction.reply({ content: `Cleared ${amount} messages.`, ephemeral: true });
        }

        if (commandName === 'war-room') {
            const prompt = interaction.options.getString('prompt');
            
            if (prompt) {
                // Natural Language Direct Build
                await interaction.deferReply({ ephemeral: true });
                const result = await parseInsuranceCommand(prompt);
                if (!result || !result.actions) return interaction.editReply("Could not parse instructions.");
                
                let report = "🚀 **Executing Build...**\n";
                for (const action of result.actions) {
                    try {
                        if (action.type === 'WIPE') {
                            // Safe Wipe
                            const channels = await interaction.guild.channels.fetch();
                            for (const c of channels.values()) {
                                if (c && c.id !== interaction.channelId && !c.parentId === interaction.channelId) {
                                    await c.delete().catch(() => {});
                                }
                            }
                            report += "✅ Wiped old structure\n";
                        } else if (action.type === 'CREATE_MAIN_STRUCTURE') {
                            await createMainStructure(interaction.guild);
                            report += "✅ Created Main Structure\n";
                        } else if (action.type === 'INITIALIZE') {
                            await initializeAgencies(interaction.guild, action.agencies);
                            report += `✅ Initialized ${action.agencies.length} agencies\n`;
                        } else if (action.type === 'MAP') {
                            // Needs more logic to find agency IDs from names
                            report += `⚠️ Manual hierarchy mapping might be needed for: ${action.downline}\n`;
                        }
                    } catch (e) {
                        report += `❌ Error: ${e.message}\n`;
                    }
                }
                return interaction.editReply(report);
            } else {
                // START INTERACTIVE WIZARD
                return startWizard(interaction);
            }
        }

        if (commandName === 'deploy-onboarding-portal') {
            const agencies = await pool.query('SELECT name, role_id FROM agencies WHERE guild_id = $1', [interaction.guild.id]);
            const rows = [];
            let currentRow = new ActionRowBuilder();

            agencies.rows.forEach((agency, index) => {
                if (index > 0 && index % 5 === 0) {
                    rows.push(currentRow);
                    currentRow = new ActionRowBuilder();
                }
                currentRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`onboard_${agency.role_id}`)
                        .setLabel(agency.name)
                        .setStyle(ButtonStyle.Primary)
                );
            });

            if (currentRow.components.length > 0) {
                // Add Leader button
                if (currentRow.components.length < 5) {
                    currentRow.addComponents(new ButtonBuilder().setCustomId('leader_login').setLabel('Leader Access 🔑').setStyle(ButtonStyle.Success));
                } else {
                    rows.push(currentRow);
                    currentRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('leader_login').setLabel('Leader Access 🔑').setStyle(ButtonStyle.Success));
                }
                rows.push(currentRow);
            }

            const embed = new EmbedBuilder()
                .setTitle('Agency Onboarding Portal')
                .setDescription('Welcome! Select your agency below to get started.')
                .setColor('#2F3136');

            await interaction.channel.send({ embeds: [embed], components: rows });
            return interaction.reply({ content: "Portal deployed.", ephemeral: true });
        }

        if (commandName === 'setup-server') {
            const unassignedRole = interaction.options.getRole('unassigned-role');
            const owner = interaction.options.getUser('owner');
            
            await pool.query(
                `INSERT INTO server_config (guild_id, server_name, unassigned_role_id, owner_discord_id) 
                 VALUES ($1, $2, $3, $4) ON CONFLICT (guild_id) DO UPDATE 
                 SET unassigned_role_id = EXCLUDED.unassigned_role_id, owner_discord_id = EXCLUDED.owner_discord_id`,
                [interaction.guild.id, interaction.guild.name, unassignedRole?.id, owner?.id]
            );
            
            return interaction.reply({ content: "Server config updated.", ephemeral: true });
        }

        if (commandName === 'add-leader-code') {
            const code = interaction.options.getString('code');
            const leaderRole = interaction.options.getRole('leader-role');
            const agencyRole = interaction.options.getRole('agency-role');
            const description = interaction.options.getString('description');
            
            await pool.query(
                'INSERT INTO leader_codes (guild_id, code, leader_role_id, agency_role_id, description) VALUES ($1, $2, $3, $4, $5)',
                [interaction.guild.id, code, leaderRole.id, agencyRole?.id, description]
            );
            return interaction.reply({ content: `✅ Leader code "${code}" added.`, ephemeral: true });
        }

        if (commandName === 'list-leader-codes') {
            const res = await pool.query('SELECT * FROM leader_codes WHERE guild_id = $1', [interaction.guild.id]);
            if (res.rows.length === 0) return interaction.reply({ content: "No leader codes configured.", ephemeral: true });
            
            let list = "### Leader Access Codes\n";
            res.rows.forEach(r => {
                list += `• **${r.code}**: <@&${r.leader_role_id}> ${r.agency_role_id ? '(+ <@&' + r.agency_role_id + '>)' : ''} - ${r.description || 'No description'}\n`;
            });
            return interaction.reply({ content: list, ephemeral: true });
        }

        if (commandName === 'remove-leader-code') {
            const code = interaction.options.getString('code');
            await pool.query('DELETE FROM leader_codes WHERE guild_id = $1 AND code = $2', [interaction.guild.id, code]);
            return interaction.reply({ content: `✅ Leader code "${code}" removed.`, ephemeral: true });
        }

        if (commandName === 'initialize-agencies') {
            const list = interaction.options.getString('agencies').split(',').map(n => ({ name: n.trim(), emoji: null }));
            await interaction.deferReply({ ephemeral: true });
            await initializeAgencies(interaction.guild, list);
            return interaction.editReply(`✅ Initialized ${list.length} agencies.`);
        }

        if (commandName === 'register-agent') {
            const modal = new ModalBuilder()
                .setCustomId('register_agent_manual')
                .setTitle('Agent Registration');

            const nameInput = new TextInputBuilder()
                .setCustomId('agent_name_input')
                .setLabel("Enter your full legal name")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
            return interaction.showModal(modal);
        }

        if (commandName === 'organize-channels') {
            const agencies = await pool.query('SELECT name, emoji FROM agencies WHERE guild_id = $1', [interaction.guild.id]);
            await interaction.deferReply({ ephemeral: true });
            const results = await organizeAgencies(interaction.guild, agencies.rows);
            return interaction.editReply(results.join('\n') || "No changes needed.");
        }

        if (commandName === 'export-member-ids') {
            await interaction.deferReply({ ephemeral: true });
            const members = await interaction.guild.members.fetch();
            let list = "### Discord Member IDs\n";
            members.forEach(m => {
                list += `**${m.user.tag}**: ${m.id}\n`;
            });

            if (list.length > 2000) {
                const chunks = list.match(/[\s\S]{1,1900}\n/g);
                for (const chunk of chunks) {
                    await interaction.followUp({ content: chunk, ephemeral: true });
                }
                return interaction.editReply("Export complete (Sent in chunks).");
            }
            return interaction.editReply(list);
        }

        if (commandName === 'list-webhooks') {
            const embed = new EmbedBuilder()
                .setTitle('Webhook Channel Structure')
                .setDescription('Channels designed for App Script integration')
                .addFields(
                    { name: '#live-wins', value: 'Real-time deal notifications' },
                    { name: '#daily-leaderboard', value: 'Daily production updates' },
                    { name: '#weekly-leaderboard', value: 'Weekly production updates' },
                    { name: '#monthly-leaderboard', value: 'Monthly production updates' },
                    { name: '#agent-spotlight', value: 'Top 15 producers' },
                    { name: '#hall-of-fame', value: 'Weekly/monthly champions' },
                    { name: '#[agency]-wins', value: 'Agency-specific wins' },
                    { name: '#[agency]-digest', value: 'Private: Agency leader daily digest' }
                )
                .setColor('#3498DB');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }

    // 2. Handle Buttons
    if (interaction.isButton()) {
        if (interaction.customId.startsWith('onboard_')) {
            const roleId = interaction.customId.split('_')[1];
            
            // Show Agent Name Modal
            const modal = new ModalBuilder()
                .setCustomId(`register_modal_${roleId}`)
                .setTitle('Agent Registration');

            const nameInput = new TextInputBuilder()
                .setCustomId('agent_name_input')
                .setLabel("Enter your full legal name (for badges)")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("John Smith")
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
            return interaction.showModal(modal);
        }

        if (interaction.customId === 'leader_login') {
            const modal = new ModalBuilder()
                .setCustomId('leader_code_modal')
                .setTitle('Leader Access');

            const codeInput = new TextInputBuilder()
                .setCustomId('leader_code_input')
                .setLabel("Enter Access Code")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(codeInput));
            return interaction.showModal(modal);
        }

        if (interaction.customId === 'wizard_build') {
            const data = wizardSessions.get(interaction.user.id);
            if (!data) return interaction.reply({ content: "Session expired.", ephemeral: true });

            await interaction.deferReply({ ephemeral: true });

            try {
                // 1. Create Main Structure
                await createMainStructure(interaction.guild);

                // 2. Initialize Main Agency
                await initializeAgencies(interaction.guild, [{ name: data.mainAgency, emoji: '🦁', is_main: true }]);

                // 3. Initialize Sub Agencies
                if (data.subAgencies.length > 0) {
                    await initializeAgencies(interaction.guild, data.subAgencies.map(n => ({ name: n, emoji: '💎' })));
                }

                // 4. Map Hierarchy
                for (const map of data.hierarchy) {
                    const downline = await pool.query('SELECT agency_id FROM agencies WHERE name = $1 AND guild_id = $2', [map.downline, interaction.guild.id]);
                    const upline = await pool.query('SELECT agency_id FROM agencies WHERE name = $1 AND guild_id = $2', [map.upline, interaction.guild.id]);
                    
                    if (downline.rows.length > 0 && upline.rows.length > 0) {
                        await mapHierarchy(interaction.guild, downline.rows[0].agency_id, upline.rows[0].agency_id);
                    }
                }

                wizardSessions.delete(interaction.user.id);
                return interaction.editReply("✅ **Setup Complete!** Structure built and hierarchy mapped.");
            } catch (err) {
                console.error("Wizard Build Error:", err);
                return interaction.editReply(`❌ Build failed: ${err.message}`);
            }
        }

        if (interaction.customId === 'wizard_cancel') {
            wizardSessions.delete(interaction.user.id);
            return interaction.reply({ content: "Build cancelled.", ephemeral: true });
        }
    }

    // 3. Handle Modals
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('register_modal_') || interaction.customId === 'register_agent_manual') {
            const roleId = interaction.customId.startsWith('register_modal_') ? interaction.customId.split('_')[2] : null;
            const agentName = interaction.fields.getTextInputValue('agent_name_input');
            
            await interaction.deferReply({ ephemeral: true });
            
            // Assign Role if coming from onboarding
            if (roleId) {
                await interaction.member.roles.add(roleId).catch(console.error);
                
                // Remove Unassigned
                const config = await getServerConfig(interaction.guild.id);
                if (config && config.unassigned_role_id) {
                    await interaction.member.roles.remove(config.unassigned_role_id).catch(() => {});
                }
                
                // Log Onboarding
                await pool.query('INSERT INTO onboarding (guild_id, user_id, role_id) VALUES ($1, $2, $3)', [interaction.guild.id, interaction.user.id, roleId]);
            }
            
            // Save Mapping
            await pool.query(
                `INSERT INTO agent_mapping (guild_id, user_id, agent_name) 
                 VALUES ($1, $2, $3) ON CONFLICT (guild_id, user_id) DO UPDATE SET agent_name = EXCLUDED.agent_name`,
                [interaction.guild.id, interaction.user.id, agentName]
            );

            return interaction.editReply(`✅ Registered as **${agentName}**! Your nickname badges will sync automatically.`);
        }

        if (interaction.customId === 'leader_code_modal') {
            const code = interaction.fields.getTextInputValue('leader_code_input');
            const leaderData = await getLeaderCode(interaction.guild.id, code);
            
            if (leaderData) {
                await interaction.deferReply({ ephemeral: true });
                await interaction.member.roles.add(leaderData.leader_role_id);
                if (leaderData.agency_role_id) await interaction.member.roles.add(leaderData.agency_role_id);
                
                return interaction.editReply("✅ Leader Access Granted.");
            } else {
                return interaction.reply({ content: "❌ Invalid Code.", ephemeral: true });
            }
        }
    }
});

/**
 * Conversational Wizard for /war-room
 */
async function startWizard(interaction) {
    let step = 1;
    let wizardData = {
        mainAgency: null,
        subAgencies: [],
        hierarchy: []
    };

    const filter = m => m.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector({ filter, time: 300000 });

    await interaction.reply({ 
        content: "🏗️ **Agency Builder Wizard**\nLet's set up your server! I'll ask you a few questions.\n\n**Step 1: What is the MAIN agency name?** (The top-level agency everyone can see)",
        ephemeral: true 
    });

    collector.on('collect', async m => {
        try {
            await m.delete().catch(() => {});

            if (step === 1) {
                const name = await processWizardStep(1, m.content);
                wizardData.mainAgency = name;
                step = 2;
                await interaction.followUp({ content: `✅ Main Agency: **${name}**\n\n**Step 2: List all SUB-AGENCIES** (Comma separated or natural language)`, ephemeral: true });
            } 
            else if (step === 2) {
                const subs = await processWizardStep(2, m.content);
                wizardData.subAgencies = Array.isArray(subs) ? subs : [subs];
                step = 3;
                await interaction.followUp({ content: `✅ Sub-Agencies: ${wizardData.subAgencies.join(', ')}\n\n**Step 3: Any agencies under THOSE agencies?** (e.g., Team A -> The Vault). Type "none" if finished.`, ephemeral: true });
            }
            else if (step === 3) {
                if (m.content.toLowerCase() !== 'none') {
                    const hierarchy = await processWizardStep(3, m.content);
                    wizardData.hierarchy = hierarchy;
                }
                
                wizardSessions.set(interaction.user.id, wizardData);
                collector.stop();
                
                // Final Summary
                const embed = new EmbedBuilder()
                    .setTitle('Build Confirmation')
                    .setDescription(`**Main Agency:** ${wizardData.mainAgency}\n**Sub-Agencies:** ${wizardData.subAgencies.join(', ')}\n**Hierarchy:** ${wizardData.hierarchy.length} mappings`)
                    .setColor('#FFD700');

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('wizard_build').setLabel('Build Structure').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('wizard_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
                );

                await interaction.followUp({ embeds: [embed], components: [row], ephemeral: true });
            }
        } catch (e) {
            console.error(e);
            await interaction.followUp({ content: "Error processing step. Please try again.", ephemeral: true });
        }
    });
}

client.login(process.env.TOKEN);
