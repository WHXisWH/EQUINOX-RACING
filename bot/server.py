import asyncio
import os
import logging
from typing import Optional

from fastapi import FastAPI

from equinox_race_bot import EquinoxRaceBot, CONTRACT_ADDRESS

logger = logging.getLogger(__name__)

app = FastAPI(title="Equinox Racing Bot", version="1.0")


class BotRunner:
    def __init__(self):
        self.task: Optional[asyncio.Task] = None
        self.bot: Optional[EquinoxRaceBot] = None
        self.last_tick: float = 0.0

    async def start(self):
        private_key = os.getenv("BOT_PRIVATE_KEY")
        contract_address = os.getenv("CONTRACT_ADDRESS", CONTRACT_ADDRESS)

        if not private_key:
            logger.error("BOT_PRIVATE_KEY not set; bot will not start.")
            return

        self.bot = EquinoxRaceBot(private_key, contract_address)

        async def runner():
            while True:
                try:
                    # Call the monitor loop in smaller chunks to keep a heartbeat
                    await self.bot.monitor_races()
                except asyncio.CancelledError:
                    raise
                except Exception as e:
                    logger.error(f"Bot loop error: {e}")
                    await asyncio.sleep(3)

        self.task = asyncio.create_task(runner())
        logger.info("Bot background task started.")

    async def stop(self):
        if self.task and not self.task.done():
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                logger.info("Bot background task cancelled.")


runner = BotRunner()


@app.on_event("startup")
async def on_startup():
    await runner.start()


@app.on_event("shutdown")
async def on_shutdown():
    await runner.stop()


@app.get("/health")
async def health():
    return {
        "ok": True,
        "bot_running": bool(runner.task and not runner.task.done()),
        "contract_address": os.getenv("CONTRACT_ADDRESS", CONTRACT_ADDRESS),
    }

