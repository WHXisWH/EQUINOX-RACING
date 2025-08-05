# Equinox Racing Bot

Automated race management system for Equinox Racing that monitors active races and advances them automatically.

## Features

- 🤖 Automatic race progression monitoring
- ⚡ Quick race auto-execution
- 🛡️ Transaction conflict prevention
- 📊 Comprehensive logging
- 🔄 Error recovery and retry logic

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your settings
```

3. Run the bot:
```bash
python equinox_race_bot.py
```

## Configuration

- `BOT_PRIVATE_KEY`: Your contract owner wallet private key
- `CONTRACT_ADDRESS`: The deployed Equinox Racing contract address  
- `NODE_URL`: Aptos node URL (defaults to mainnet)
- `BOT_CHECK_INTERVAL`: How often to check races (seconds)
- `RACE_ADVANCE_COOLDOWN`: Minimum time between race advances (seconds)

## Deployment

For production deployment, consider using:
- Docker container
- Systemd service
- Process manager (PM2)
- Cloud services (AWS Lambda, Google Cloud Functions)

## Monitoring

The bot logs all activities to both console and `equinox_bot.log` file.
Monitor the logs to ensure proper operation.