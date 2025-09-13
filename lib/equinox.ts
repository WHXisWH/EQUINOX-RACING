import { Aptos, AptosConfig, Network, type ClientConfig } from '@aptos-labs/ts-sdk'

const APTOS_API_KEY = process.env.NEXT_PUBLIC_APTOS_API_KEY;

const clientConfig: ClientConfig = {
  API_KEY: APTOS_API_KEY,
};

const config = new AptosConfig({
  network: Network.TESTNET,
  fullnode: `https://api.testnet.aptoslabs.com/v1`,
  clientConfig,
})

export const aptos = new Aptos(config)

export const MODULE_ADDRESS = process.env.NEXT_PUBLIC_MODULE_ADDRESS || "0x1b5957414b227d9fedd6015c2b53e648166cc552b6b9747a68c496c5b45086f7";
export const MODULE_NAME = 'equinox_v3'

export interface Horse {
  id: number
  name: string
  speed: number
  endurance: number
  terrain_type: number
  color: string
}

export interface RaceTrack {
  length: number
  weather: number
  terrain: number
}

export interface RaceEntry {
  horse_id: number
  player_address: string
  position: number
  energy: number
  is_finished: boolean
  finish_time: number
  final_rank: number
  is_nft_horse: boolean
  nft_horse_id?: number
}

export interface Bet {
  player_address: string
  entry_index: number
  amount: number
}

export interface RaceState {
  race_id: string
  creator: string
  race_type: number
  race_started: boolean
  race_finished: boolean
  current_round: number
  horses: Horse[]
  entries: RaceEntry[]
  track: RaceTrack
  total_bet_pool: number
  entry_fee_pool: number
  start_time?: number
  betting_end_time?: number
}

export interface PlayerHorseNFT {
  id: number
  name: string
  speed: number
  endurance: number
  terrain_type: number
  color: string
  owner: string
  created_time: number
}

export interface RaceHistory {
  race_id: number
  winner_address: string
  winner_horse_name: string
  total_prize: number
  participants: number
  finish_time: number
}

export interface QuickMatchStatus {
  waiting_players: string[]
  current_race_id?: number
  last_queue_time: number
}

export interface PlayerProfile {
  total_races: number
  total_wins: number
  total_earnings: number
  race_history: number[]
}

export interface GameStats {
  total_races: number
  total_horses: number
  active_races: number
  completed_races: number
  system_treasury: number
}

export const RACE_TYPE = {
  NORMAL: 0,
  QUICK: 1,
} as const

export const TERRAIN_NAMES = ['🌱 Grass', '🏜️ Dirt'] as const
export const WEATHER_NAMES = ['☀️ Sunny', '🌧️ Rainy'] as const
export const TERRAIN_TYPE_NAMES = ['Grass', 'Dirt', 'All-weather'] as const

export async function fetchRaceState(raceId: number): Promise<RaceState | null> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_race_state`,
        typeArguments: [],
        functionArguments: [raceId],
      },
    })
    
    const [
      id, creator, raceType, started, finished, round, horses, entries, 
      track, betPool, entryFeePool, startTime, bettingEndTime
    ] = result
    
    return {
      race_id: String(id),
      creator: String(creator),
      race_type: Number(raceType),
      race_started: Boolean(started),
      race_finished: Boolean(finished),
      current_round: Number(round),
      horses: (horses as any[]).map(h => ({
        id: Number(h.id),
        name: String(h.name),
        speed: Number(h.speed),
        endurance: Number(h.endurance),
        terrain_type: Number(h.terrain_type),
        color: String(h.color),
      })),
      entries: (entries as any[]).map(e => ({
        horse_id: Number(e.horse_id),
        player_address: String(e.player_address),
        position: Number(e.position),
        energy: Number(e.energy),
        is_finished: Boolean(e.is_finished),
        finish_time: Number(e.finish_time),
        final_rank: Number(e.final_rank),
        is_nft_horse: Boolean(e.is_nft_horse),
        nft_horse_id: (e.nft_horse_id as any)?.vec?.[0] ? Number((e.nft_horse_id as any).vec[0]) : undefined,
      })),
      track: {
        length: Number((track as any).length),
        weather: Number((track as any).weather),
        terrain: Number((track as any).terrain),
      },
      total_bet_pool: Number(betPool),
      entry_fee_pool: Number(entryFeePool),
      start_time: (startTime as any)?.vec?.[0] ? Number((startTime as any).vec[0]) : undefined,
      betting_end_time: (bettingEndTime as any)?.vec?.[0] ? Number((bettingEndTime as any).vec[0]) : undefined,
    }
  } catch (error: any) {
    console.error('Error fetching race state:', error)
    if (error.message?.includes('Rate limit')) {
      throw new Error('Rate limit exceeded. Please wait before trying again.')
    }
    return null
  }
}

export async function fetchRaceBets(raceId: number): Promise<Bet[]> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_race_bets`,
        typeArguments: [],
        functionArguments: [raceId],
      },
    })
    
    const bets = result[0] as any[]
    return bets.map(bet => ({
      player_address: String(bet.player_address),
      entry_index: Number(bet.entry_index),
      amount: Number(bet.amount),
    }))
  } catch (error: any) {
    console.error('Error fetching race bets:', error)
    if (error.message?.includes('Rate limit')) {
      throw new Error('Rate limit exceeded. Please wait before trying again.')
    }
    return []
  }
}

export async function fetchActiveRaces(): Promise<number[]> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_active_races`,
        typeArguments: [],
        functionArguments: [],
      },
    })
    
    const raceIds = result[0] as any[]
    return raceIds.map(id => Number(id))
  } catch (error: any) {
    console.error('Error fetching active races:', error)
    if (error.message?.includes('Rate limit')) {
      throw new Error('Rate limit exceeded. Please wait before trying again.')
    }
    return []
  }
}

export async function fetchQuickMatchStatus(): Promise<QuickMatchStatus> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_quick_match_status`,
        typeArguments: [],
        functionArguments: [],
      },
    })
    
    const [waitingPlayers, currentRaceId, lastQueueTime] = result
    
    return {
      waiting_players: (waitingPlayers as any[]).map(addr => String(addr)),
      current_race_id: (currentRaceId as any)?.vec?.[0] ? Number((currentRaceId as any).vec[0]) : undefined,
      last_queue_time: Number(lastQueueTime),
    }
  } catch (error: any) {
    console.error('Error fetching quick match status:', error)
    if (error.message?.includes('Rate limit')) {
      throw new Error('Rate limit exceeded. Please wait before trying again.')
    }
    return {
      waiting_players: [],
      last_queue_time: 0,
    }
  }
}

export async function fetchRaceHistory(limit: number = 10): Promise<RaceHistory[]> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_race_history`,
        typeArguments: [],
        functionArguments: [limit],
      },
    })
    
    const history = result[0] as any[]
    return history.map(h => ({
      race_id: Number(h.race_id),
      winner_address: String(h.winner_address),
      winner_horse_name: String(h.winner_horse_name),
      total_prize: Number(h.total_prize),
      participants: Number(h.participants),
      finish_time: Number(h.finish_time),
    }))
  } catch (error: any) {
    console.error('Error fetching race history:', error)
    if (error.message?.includes('Rate limit')) {
      throw new Error('Rate limit exceeded. Please wait before trying again.')
    }
    return []
  }
}

export async function fetchPlayerHorses(playerAddr: string): Promise<number[]> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_player_horses`,
        typeArguments: [],
        functionArguments: [playerAddr],
      },
    })
    
    const horseIds = result[0] as any[]
    return horseIds.map(id => Number(id))
  } catch (error) {
    console.error('Error fetching player horses:', error)
    return []
  }
}

export async function fetchHorseDetails(ownerAddr: string, horseId: number): Promise<PlayerHorseNFT | null> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_horse_details`,
        typeArguments: [],
        functionArguments: [ownerAddr, horseId],
      },
    })
    
    const [id, name, speed, endurance, terrain_type, color, owner, created_time] = result
    
    return {
      id: Number(id),
      name: String(name),
      speed: Number(speed),
      endurance: Number(endurance),
      terrain_type: Number(terrain_type),
      color: String(color),
      owner: String(owner),
      created_time: Number(created_time),
    }
  } catch (error) {
    console.error('Error fetching horse details:', error)
    return null
  }
}

export async function fetchPlayerHorsesWithDetails(playerAddr: string): Promise<PlayerHorseNFT[]> {
  try {
    const horseIds = await fetchPlayerHorses(playerAddr)
    const horses: PlayerHorseNFT[] = []
    
    for (const horseId of horseIds) {
      const horse = await fetchHorseDetails(playerAddr, horseId)
      if (horse) {
        horses.push(horse)
      }
    }
    
    return horses
  } catch (error) {
    console.error('Error fetching player horses with details:', error)
    return []
  }
}

export async function fetchPlayerProfile(playerAddr: string): Promise<PlayerProfile> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_player_profile`,
        typeArguments: [],
        functionArguments: [playerAddr],
      },
    })
    
    const [totalRaces, totalWins, totalEarnings, raceHistory] = result
    
    return {
      total_races: Number(totalRaces),
      total_wins: Number(totalWins),
      total_earnings: Number(totalEarnings),
      race_history: (raceHistory as any[]).map(id => Number(id)),
    }
  } catch (error) {
    console.error('Error fetching player profile:', error)
    return {
      total_races: 0,
      total_wins: 0,
      total_earnings: 0,
      race_history: [],
    }
  }
}

export async function fetchGameStats(): Promise<GameStats> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_game_stats`,
        typeArguments: [],
        functionArguments: [],
      },
    })
    
    const [totalRaces, totalHorses, activeRaces, completedRaces, systemTreasury] = result
    
    return {
      total_races: Number(totalRaces),
      total_horses: Number(totalHorses),
      active_races: Number(activeRaces),
      completed_races: Number(completedRaces),
      system_treasury: Number(systemTreasury),
    }
  } catch (error) {
    console.error('Error fetching game stats:', error)
    return {
      total_races: 0,
      total_horses: 0,
      active_races: 0,
      completed_races: 0,
      system_treasury: 0,
    }
  }
}

export async function fetchSystemConfig() {
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_system_config`,
        typeArguments: [],
        functionArguments: [],
      },
    })
    
    const [entryFee, minBet, mintCost, trackLength, maxPlayersNormal, maxPlayersQuick, bettingWindow] = result
    
    return {
      entryFee: Number(entryFee),
      minBet: Number(minBet),
      mintCost: Number(mintCost),
      trackLength: Number(trackLength),
      maxPlayersNormal: Number(maxPlayersNormal),
      maxPlayersQuick: Number(maxPlayersQuick),
      bettingWindowSeconds: Number(bettingWindow),
    }
  } catch (error) {
    console.error('Error fetching system config:', error)
    return {
      entryFee: 100000000,
      minBet: 50000000,
      mintCost: 200000000,
      trackLength: 1000,
      maxPlayersNormal: 6,
      maxPlayersQuick: 4,
      bettingWindowSeconds: 30,
    }
  }
}

function buildTransaction(fn: string, args: any[]) {
  return {
    data: {
      function: `${MODULE_ADDRESS}::${MODULE_NAME}::${fn}`,
      functionArguments: args,
    },
  }
}

export const transactions = {
  initializePlayer: () => buildTransaction('initialize_player', []),
  
  mintHorse: (name: string, speed: number, endurance: number, terrainType: number, color: string) => 
    buildTransaction('mint_horse', [name, speed, endurance, terrainType, color]),
  
  createNormalRace: () => buildTransaction('create_normal_race', []),
  
  joinQuickMatch: () => buildTransaction('join_quick_match', []),
  
  joinRaceWithHorse: (raceId: number, horseId: number) => 
    buildTransaction('join_race_with_horse', [raceId, horseId]),
  
  joinRaceWithNFT: (raceId: number, nftHorseId: number) => 
    buildTransaction('join_race_with_nft', [raceId, nftHorseId]),
  
  placeBet: (raceId: number, entryIndex: number, amount: number) => 
    buildTransaction('place_bet', [raceId, entryIndex, amount]),
  
  startRace: (raceId: number) => buildTransaction('start_race', [raceId]),
  
  executeQuickRace: (raceId: number) => buildTransaction('execute_quick_race', [raceId]),
  
  advanceRace: (raceId: number) => buildTransaction('advance_race', [raceId]),
}

export function formatAPT(amount: number): string {
  return (amount / 100000000).toFixed(4) + ' APT'
}

export function parseAPT(amount: string): number {
  return Math.round(parseFloat(amount) * 100000000)
}

export function getTerrainTypeName(terrainType: number): string {
  return TERRAIN_TYPE_NAMES[terrainType] || 'Unknown'
}

export function getRaceTypeName(raceType: number): string {
  return raceType === RACE_TYPE.QUICK ? 'Quick Match' : 'Normal Race'
}