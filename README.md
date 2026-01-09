# Discord Bot

Discord bot with slash commands, game tracking, and custom features.

## Features

- Slash commands support
- Game activity tracking
- Role dividers with custom styling
- Message deletion management
- MongoDB integration
- Canvas-based text rendering with custom fonts

## Tech Stack

- **Runtime**: Node.js 20
- **Framework**: Discord.js 14
- **Database**: MongoDB (with migrations)
- **Canvas**: node-canvas for image generation
- **Deployment**: Docker with multi-stage build

---

## Development Setup

### Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)
- Git

### Local Installation

```bash
# Clone the repository
git clone https://github.com/YuriChirmici/discord-bot.git
cd discord-bot

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your MongoDB URI and Discord token

# Run migrations
npx migrate-mongo up

# Start development server
npm run dev
```

### Available Scripts

```bash
npm run dev      # Start with nodemon (hot reload)
npm start        # (obsolete) Run migrations and start bot for prod
npm run eslint   # Run linter
```

---

## Docker Deployment

### Prerequisites

- Docker and Docker Compose installed

### Quick Start

#### 1. Prepare the environment

```bash
# Create directory for the application
mkdir discord-bot
cd discord-bot
```

#### 2. Get the configuration files

Copy the following files from the repository:
- `Dockerfile`
- `docker-compose.yml`

#### 3. Configure environment variables

Create `.env` file with your settings:

```bash
# See .env.example for reference
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/discord-bot?retryWrites=true&w=majority
# Add Discord token and other required variables
```

#### 4. Build and start the bot

```bash
docker compose up -d --build
```

### Update Process

When you push new changes to the GitHub repository:

```bash
# Update code inside container
docker exec discord-bot sh -c "git pull && npm install --omit=dev"

# Restart the bot
docker compose restart
```

## Configuration

### Environment Variables

Required variables in `.env`:

```bash
MONGO_URI=<your-mongodb-connection-string>
# Add other required variables based on your setup
```

### Custom Fonts

Place custom font files (`.ttf`) in the `fonts/` directory. The bot uses "gg sans" (Discord default font) for text rendering.
