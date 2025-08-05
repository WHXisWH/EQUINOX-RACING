#!/usr/bin/env python3
"""
Equinox Racing Bot - Automated Race Management System

This bot monitors active races and automatically advances them to prevent
multiple users from conflicting transactions and improve user experience.
"""

import asyncio
import os
import time
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from aptos_sdk.client import RestClient
from aptos_sdk.account import Account
from aptos_sdk.transactions import EntryFunction, TransactionPayload
from aptos_sdk.type_tag import StructTag, TypeTag

# Configuration
NODE_URL = "https://api.testnet.aptoslabs.com/v1"  # Using testnet like frontend
CONTRACT_ADDRESS = "0x38cf30ab98f13466c60df462ac3e57b6391d6a3c3f22c34bea4e4f3386eafd96"  # From frontend
BOT_CHECK_INTERVAL = 5  # seconds
RACE_ADVANCE_COOLDOWN = 8  # seconds between advances

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
    """Race state data structure matching the frontend"""
    race_id: int
    race_started: bool
    race_finished: bool
    race_type: int
    current_round: int
    max_rounds: int
    entries: List[Dict]
    start_time: Optional[int] = None
    creator: Optional[str] = None

class EquinoxRaceBot:
    """Automated race management bot for Equinox Racing"""
    
    def __init__(self, private_key: str, contract_address: str):
        """
        Initialize the race bot
        
        Args:
            private_key: Bot wallet private key (owner wallet)
            contract_address: Equinox Racing contract address
        """
        self.private_key = private_key
        self.contract_address = contract_address
        self.client = RestClient(NODE_URL)
        self.account = Account.load_key(private_key)
        self.last_advance_time: Dict[int, float] = {}
        
        logger.info(f"Bot initialized with account: {self.account.address()}")
        logger.info(f"Contract address: {contract_address}")
    
    async def get_active_races(self) -> List[int]:
        """Fetch all active race IDs from the contract"""
        try:
            # This would call the contract's get_active_races function
            # Implementation depends on your contract's view functions
            response = await asyncio.to_thread(
                self.client.view,
                f"{self.contract_address}::equinox_v2::get_active_races",
                []
            )
            return response[0] if response else []
        except Exception as e:
            logger.error(f"Error fetching active races: {e}")
            return []
    
    async def get_race_state(self, race_id: int) -> Optional[RaceState]:
        """Fetch race state for a specific race ID"""
        try:
            response = await asyncio.to_thread(
                self.client.view,
                f"{self.contract_address}::equinox_v2::get_race_state",
                [race_id]
            )
            
            if not response:
                return None
            
            race_data = response[0]
            return RaceState(
                race_id=race_id,
                race_started=race_data['race_started'],
                race_finished=race_data['race_finished'],
                race_type=race_data['race_type'],
                current_round=race_data['current_round'],
                max_rounds=race_data['max_rounds'],
                entries=race_data['entries'],
                start_time=race_data.get('start_time'),
                creator=race_data.get('creator')
            )
        except Exception as e:
            logger.error(f"Error fetching race state for race {race_id}: {e}")
            return None
    
    def should_advance_race(self, race_state: RaceState) -> bool:
        """Determine if a race should be advanced"""
        if not race_state.race_started or race_state.race_finished:
            return False
        
        # Check cooldown to prevent spam
        last_advance = self.last_advance_time.get(race_state.race_id, 0)
        if time.time() - last_advance < RACE_ADVANCE_COOLDOWN:
            return False
        
        # Add more logic here if needed (e.g., check if all players are ready)
        return True
    
    def can_execute_quick_race(self, race_state: RaceState) -> bool:
        """Check if a quick race can be auto-executed"""
        if race_state.race_type != 1:  # RACE_TYPE.QUICK
            return False
        
        if race_state.race_started or not race_state.start_time:
            return False
        
        # Check if enough time has passed since start_time
        current_time_ms = int(time.time() * 1000)
        return current_time_ms >= race_state.start_time
    
    async def advance_race(self, race_id: int) -> bool:
        """Advance a race by one round"""
        try:
            # Create transaction payload
            payload = TransactionPayload(
                EntryFunction.natural(
                    f"{self.contract_address}::equinox_v2",
                    "advance_race", 
                    [],
                    [race_id]
                )
            )
            
            # Submit transaction
            txn = await asyncio.to_thread(
                self.client.submit_transaction,
                self.account,
                payload
            )
            
            # Wait for transaction confirmation
            await asyncio.to_thread(
                self.client.wait_for_transaction,
                txn
            )
            
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
                    f"{self.contract_address}::equinox_v2",
                    "execute_quick_race",
                    [],
                    [race_id]
                )
            )
            
            txn = await asyncio.to_thread(
                self.client.submit_transaction,
                self.account,
                payload
            )
            
            await asyncio.to_thread(
                self.client.wait_for_transaction,
                txn
            )
            
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