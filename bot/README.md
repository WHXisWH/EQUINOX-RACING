# Equinox Racing Bot

Automated race management for Equinox Racing on Aptos testnet. The bot monitors active races and will:

- 🤖 Advance ongoing races in rounds
- ⚡ Auto-start quick races once their start time is reached
- 🛡️ Avoid spamming via cooldown
- 📊 Log to console and `equinox_bot.log`

This bot is aligned to the v3 contract (`equinox_v3`).

## Setup

1) Install dependencies
```bash
pip install -r requirements.txt
```

2) Configure environment
```bash
cp .env.example .env
# Edit .env with your settings
```

3) Run the bot
```bash
python equinox_race_bot.py
```

## Configuration

- `BOT_PRIVATE_KEY`: Private key for a funded testnet account (payer/executor)
- `CONTRACT_ADDRESS`: The deployed module address (same as frontend)
- `NODE_URL`: Aptos fullnode URL (defaults to testnet)
- `BOT_CHECK_INTERVAL`: Poll interval in seconds (default 5)
- `RACE_ADVANCE_COOLDOWN`: Min seconds between advances per race (default 8)

Example testnet address (must match your deployment / frontend):
```
CONTRACT_ADDRESS=0x1b5957414b227d9fedd6015c2b53e648166cc552b6b9747a68c496c5b45086f7
```

## Deployment

For production, consider:
- Docker
- systemd service
- PM2 (node process manager) invoking `python` in a script
- Cloud runner (e.g. a tiny VM)

## Monitoring

Tail the log file and watch for errors:
```bash
tail -f equinox_bot.log
```
