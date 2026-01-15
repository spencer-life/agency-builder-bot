const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
    new SlashCommandBuilder()
        .setName('war-room')
        .setDescription('Interactive wizard - guided setup with prompts for agencies, hierarchy, etc.')
        .addStringOption(option => 
            option.setName('prompt')
                .setDescription('Optional: Natural language instructions to skip the wizard')),
                
    new SlashCommandBuilder()
        .setName('setup-server')
        .setDescription('Configure server basics (unassigned role, main agency, owner)')
        .addRoleOption(option => option.setName('unassigned-role').setDescription('Role for new members'))
        .addUserOption(option => option.setName('owner').setDescription('Server owner')),

    new SlashCommandBuilder()
        .setName('add-leader-code')
        .setDescription('Add a leader access code')
        .addStringOption(option => option.setName('code').setDescription('The secret code').setRequired(true))
        .addRoleOption(option => option.setName('leader-role').setDescription('Role to assign').setRequired(true))
        .addRoleOption(option => option.setName('agency-role').setDescription('Standard agency role to also assign'))
        .addStringOption(option => option.setName('description').setDescription('Description of this code')),

    new SlashCommandBuilder()
        .setName('list-leader-codes')
        .setDescription('View all configured leader codes'),

    new SlashCommandBuilder()
        .setName('remove-leader-code')
        .setDescription('Remove a leader code')
        .addStringOption(option => option.setName('code').setDescription('The code to remove').setRequired(true)),

    new SlashCommandBuilder()
        .setName('initialize-agencies')
        .setDescription('Create agency roles/categories/channels (full build)')
        .addStringOption(option => option.setName('agencies').setDescription('Comma separated list of agency names').setRequired(true)),

    new SlashCommandBuilder()
        .setName('add-agency-structure')
        .setDescription('NON-DESTRUCTIVE: Add to existing server without wiping')
        .addStringOption(option => option.setName('agency-name').setDescription('Name of the agency').setRequired(true)),

    new SlashCommandBuilder()
        .setName('map-hierarchy')
        .setDescription('Map a sub-agency to its upline (for permissions)')
        .addIntegerOption(option => option.setName('downline-id').setDescription('Agency ID of the sub-agency').setRequired(true))
        .addIntegerOption(option => option.setName('upline-id').setDescription('Agency ID of the parent agency').setRequired(true)),

    new SlashCommandBuilder()
        .setName('deploy-onboarding-portal')
        .setDescription('Deploy button-based role selection'),

    new SlashCommandBuilder()
        .setName('register-agent')
        .setDescription('Register your agent name for badge sync'),

    new SlashCommandBuilder()
        .setName('organize-channels')
        .setDescription('Rename existing channels to standard format'),

    new SlashCommandBuilder()
        .setName('clear-channel')
        .setDescription('Delete messages in current channel')
        .addIntegerOption(option => option.setName('amount').setDescription('Number of messages to delete (max 100)')),

    new SlashCommandBuilder()
        .setName('export-member-ids')
        .setDescription('Export list of all member IDs'),

    new SlashCommandBuilder()
        .setName('list-webhooks')
        .setDescription('Show all webhook channels and their purposes'),

    new SlashCommandBuilder()
        .setName('build-template')
        .setDescription('Shows the exact format needed for building agency structure, then builds via AI'),

    new SlashCommandBuilder()
        .setName('deploy-welcome-guide')
        .setDescription('Deploy the welcome/walkthrough embed in the current channel')
        .addStringOption(option => 
            option.setName('form-url')
                .setDescription('Production submission form URL')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('sop-url')
                .setDescription('SOP/Documentation URL (optional)'))
        .addStringOption(option => 
            option.setName('agency-name')
                .setDescription('Main agency name for the title (default: server name)')),

    new SlashCommandBuilder()
        .setName('bulk-assign-unassigned')
        .setDescription('Assign the Unassigned role to all existing server members'),

].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
