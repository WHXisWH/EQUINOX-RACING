#!/usr/bin/env python3
"""
Equinox Racing Bot - Automated Race Management System

This bot monitors active races and automatically advances/starts them on Aptos testnet.
Aligned to module equinox_v3 and v3 view/return formats.
"""

import asyncio
import os
import time
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

from dotenv import load_dotenv
import json
from aptos_sdk.async_client import RestClient
from aptos_sdk.account import Account
from aptos_sdk.transactions import EntryFunction, TransactionPayload, TransactionArgument
from aptos_sdk import bcs

# Load .env if present
load_dotenv()

# Configuration (defaults align with frontend/testnet)
DEFAULT_NODE_URL = "https://api.testnet.aptoslabs.com/v1"
DEFAULT_CONTRACT_ADDRESS = (
    os.getenv("NEXT_PUBLIC_MODULE_ADDRESS")
    or "0x1b5957414b227d9fedd6015c2b53e648166cc552b6b9747a68c496c5b45086f7"
)
NODE_URL = os.getenv("NODE_URL", DEFAULT_NODE_URL)
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS", DEFAULT_CONTRACT_ADDRESS)
BOT_CHECK_INTERVAL = int(os.getenv("BOT_CHECK_INTERVAL", "5"))  # seconds
RACE_ADVANCE_COOLDOWN = int(os.getenv("RACE_ADVANCE_COOLDOWN", "8"))  # seconds
MODULE_NAME = "equinox_v3"

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('equinox_bot.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


@dataclass
class RaceState:
    """Minimal race state used by the bot"""
    race_id: int
    race_started: bool
    race_finished: bool
    race_type: int
    current_round: int
    entries_count: int
    start_time: Optional[int] = None  # microseconds since epoch (Option<u64>)
    creator: Optional[str] = None


class EquinoxRaceBot:
    """Automated race management bot for Equinox Racing (v3)"""

    def __init__(self, private_key: str, contract_address: str):
        """
        Initialize the race bot.

        Args:
            private_key: Bot wallet private key (owner wallet)
            contract_address: Equinox Racing contract/module address
        """
        self.private_key = private_key
        self.contract_address = contract_address
        self.client = RestClient(NODE_URL)
        self.account = Account.load_key(private_key)
        self.last_advance_time: Dict[int, float] = {}
        self._tx_lock = asyncio.Lock()

        logger.info(f"Bot initialized with account: {self.account.address()}")
        logger.info(f"Contract address: {contract_address}")
        logger.info(f"Node URL: {NODE_URL}")

    def _fn(self, name: str) -> str:
        return f"{self.contract_address}::{MODULE_NAME}::{name}"

    @staticmethod
    def _parse_option_u64(opt: Any) -> Optional[int]:
        """Parse Aptos Option<u64> JSON into Python int or None"""
        try:
            if isinstance(opt, dict) and 'vec' in opt:
                vec = opt.get('vec') or []
                if isinstance(vec, list) and len(vec) > 0:
                    return int(vec[0])
            return None
        except Exception:
            return None

    async def _view_json(self, function: str, type_args: List[str], args: List[Any]) -> Any:
        """Helper to call view and parse JSON response"""
        norm_args: List[Any] = []
        for a in args:
            if isinstance(a, bool):
                norm_args.append(a)
            elif isinstance(a, (int,)):
                norm_args.append(str(a))
            else:
                norm_args.append(a)
        content = await self.client.view(function, type_args, norm_args)
        try:
            return json.loads(content)
        except Exception as e:
            logger.error(f"Failed to parse view response for {function}: {e}")
            return None

    async def get_active_races(self) -> List[int]:
        """Fetch all active race IDs from the contract (v3)"""
        try:
            response = await self._view_json(self._fn("get_active_races"), [], [])
            race_ids = response[0] if response else []
            return [int(r) for r in race_ids]
        except Exception as e:
            logger.error(f"Error fetching active races: {e}")
            return []

    async def get_race_state(self, race_id: int) -> Optional[RaceState]:
        """Fetch race state for a specific race ID (v3 tuple decoding)"""
        try:
            response = await self._view_json(self._fn("get_race_state"), [], [race_id])

            if not response or len(response) < 13:
                logger.debug(f"Empty/invalid state for race {race_id}: {response}")
                return None

            (
                _id,
                creator,
                race_type,
                race_started,
                race_finished,
                current_round,
                _horses,
                entries,
                _track,
                _total_bet_pool,
                _entry_fee_pool,
                start_time_opt,
                _betting_end_time_opt,
            ) = response

            start_time = self._parse_option_u64(start_time_opt)
            entries_count = len(entries) if isinstance(entries, list) else 0

            return RaceState(
                race_id=race_id,
                race_started=bool(race_started),
                race_finished=bool(race_finished),
                race_type=int(race_type),
                current_round=int(current_round),
                entries_count=entries_count,
                start_time=start_time,
                creator=str(creator) if creator is not None else None,
            )
        except Exception as e:
            logger.error(f"Error fetching race state for race {race_id}: {e}")
            return None

    def should_advance_race(self, race_state: RaceState) -> bool:
        """Determine if a race should be advanced"""
        if not race_state.race_started or race_state.race_finished:
            return False

        # Cooldown to prevent spamming the function
        last_advance = self.last_advance_time.get(race_state.race_id, 0)
        if time.time() - last_advance < RACE_ADVANCE_COOLDOWN:
            return False

        return True

    def can_execute_quick_race(self, race_state: RaceState) -> bool:
        """Check if a quick race can be auto-executed (time in microseconds)"""
        if race_state.race_type != 1:  # QUICK
            return False

        if race_state.race_started or not race_state.start_time:
            return False

        current_time_us = int(time.time() * 1_000_000)
        return current_time_us >= race_state.start_time

    async def advance_race(self, race_id: int) -> bool:
        """Advance a race by one round"""
        try:
            payload = TransactionPayload(
                EntryFunction.natural(
                    f"{self.contract_address}::{MODULE_NAME}",
                    "advance_race",
                    [],
                    [TransactionArgument(int(race_id), bcs.Serializer.u64)],
                )
            )

            async with self._tx_lock:
                signed = await self.client.create_bcs_signed_transaction(self.account, payload)
                await self.client.submit_and_wait_for_bcs_transaction(signed)

            self.last_advance_time[race_id] = time.time()
            logger.info(f"Successfully advanced race {race_id}")
            return True

        except Exception as e:
            logger.error(f"Error advancing race {race_id}: {e}")
            return False

    async def execute_quick_race(self, race_id: int) -> bool:
        """Execute a quick race that's ready to start"""
        try:
            payload = TransactionPayload(
                EntryFunction.natural(
                    f"{self.contract_address}::{MODULE_NAME}",
                    "execute_quick_race",
                    [],
                    [TransactionArgument(int(race_id), bcs.Serializer.u64)],
                )
            )

            async with self._tx_lock:
                signed = await self.client.create_bcs_signed_transaction(self.account, payload)
                await self.client.submit_and_wait_for_bcs_transaction(signed)

            logger.info(f"Successfully executed quick race {race_id}")
            return True

        except Exception as e:
            logger.error(f"Error executing quick race {race_id}: {e}")
            return False

    async def process_race(self, race_id: int):
        """Process a single race - advance or execute as needed"""
        race_state = await self.get_race_state(race_id)
        if not race_state:
            return
        
        # Check if we should advance an ongoing race
        if self.should_advance_race(race_state):
            success = await self.advance_race(race_id)
            if success:
                logger.info(f"Advanced race {race_id} to round {race_state.current_round + 1}")
        
        # Check if we should execute a quick race
        elif self.can_execute_quick_race(race_state):
            success = await self.execute_quick_race(race_id)
            if success:
                logger.info(f"Executed quick race {race_id}")
    
    async def monitor_races(self):
        """Main monitoring loop"""
        logger.info("Starting race monitoring...")
        
        while True:
            try:
                active_races = await self.get_active_races()
                logger.debug(f"Monitoring {len(active_races)} active races")
                
                # Process each race
                tasks = [self.process_race(race_id) for race_id in active_races]
                await asyncio.gather(*tasks, return_exceptions=True)
                
                # Wait before next check
                await asyncio.sleep(BOT_CHECK_INTERVAL)
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(BOT_CHECK_INTERVAL)
    
    async def run(self):
        """Start the bot"""
        logger.info("Equinox Racing Bot starting...")
        try:
            await self.monitor_races()
        except KeyboardInterrupt:
            logger.info("Bot stopped by user")
        except Exception as e:
            logger.error(f"Bot crashed: {e}")
            raise

def main():
    """Main entry point"""
    # Load configuration from environment variables
    private_key = os.getenv('BOT_PRIVATE_KEY')
    contract_address = os.getenv('CONTRACT_ADDRESS', CONTRACT_ADDRESS)
    
    if not private_key:
        logger.error("BOT_PRIVATE_KEY environment variable is required")
        return
    
    # Create and run bot
    bot = EquinoxRaceBot(private_key, contract_address)
    asyncio.run(bot.run())

if __name__ == "__main__":
    main()
