# Agency Builder Bot

A multi-server Discord bot designed for professional insurance agency server setup, permission management, and production-based badge syncing.

## Features

- **Automated Server Setup**: Create a professional category and channel structure with one command.
- **Permission Inheritance**: Sub-agencies can automatically view upline agency channels.
- **Badge Syncing**: Discord nicknames update in real-time with badges (🐋, 🔥, 💎) based on production data.
- **Onboarding Portal**: Interactive button-based role selection with agent name registration.
- **AI Wizard**: Use natural language to describe your agency hierarchy and let the bot build it.

## Setup Instructions

### 1. Prerequisites
- Node.js v16.11.0 or higher
- PostgreSQL Database
- Discord Bot Token & Client ID
- Google Gemini API Key

### 2. Installation
1. Clone the repository
2. Run `npm install`
3. Copy `.env.example` to `.env` and fill in your credentials
4. Run `npm run register` to register the slash commands

### 3. Database Setup
Execute the `schema.sql` file in your PostgreSQL database to create the necessary tables.

### 4. Running the Bot
```bash
npm start
```

## Slash Commands

| Command | Description |
|---------|-------------|
| `/war-room` | **Interactive wizard** - guided setup with prompts for agencies, hierarchy, etc. |
| `/setup-server` | Configure server basics (unassigned role, main agency, owner) |
| `/add-leader-code` | Add a leader access code for a specific role |
| `/list-leader-codes` | View all configured leader codes |
| `/remove-leader-code` | Remove a leader code |
| `/initialize-agencies` | Create agency roles/categories/channels (full build) |
| `/add-agency-structure` | NON-DESTRUCTIVE: Add to existing server without wiping |
| `/map-hierarchy` | Map a sub-agency to its upline (for permissions) |
| `/deploy-onboarding-portal` | Deploy button-based role selection |
| `/register-agent` | Register agent name for badge sync |
| `/organize-channels` | Rename existing channels to standard format |
| `/clear-channel` | Delete messages in current channel |
| `/export-member-ids` | Export list of all member IDs |
| `/list-webhooks` | Show all webhook channels and their purposes |

## Badge Sync API

The bot exposes an endpoint at `POST /api/badges` for integration with external production trackers (like Google Apps Script).

**Request Body:**
```json
{
  "guildId": "...",
  "agentName": "John Smith",
  "badges": ["🐋", "💎"]
}
```

## License
MIT
