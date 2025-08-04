import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk'

const config = new AptosConfig({
  network: Network.TESTNET,
  fullnode: 'https://api.testnet.aptoslabs.com/v1',
})

export const aptos = new Aptos(config)

export const MODULE_ADDRESS = process.env.NEXT_PUBLIC_MODULE_ADDRESS || "0x38cf30ab98f13466c60df462ac3e57b6391d6a3c3f22c34bea4e4f3386eafd96";
export const MODULE_NAME = 'equinox'

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
}

export interface Bet {
  player_address: string
  horse_id: number
  amount: number
}

export interface RaceState {
  race_id: string
  race_started: boolean
  race_finished: boolean
  current_round: number
  horses: Horse[]
  entries: RaceEntry[]
  track: RaceTrack
  total_bet_pool: number
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

export async function fetchRaceState(addr: string): Promise<RaceState | null> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_race_state`,
        typeArguments: [],
        functionArguments: [addr],
      },
    })
    
    const [id, started, finished, round, horses, entries, track, pool] = result
    
    return {
      race_id: String(id),
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
      })),
      track: {
        length: Number((track as any).length),
        weather: Number((track as any).weather),
        terrain: Number((track as any).terrain),
      },
      total_bet_pool: Number(pool),
    }
  } catch (error) {
    console.error('Error fetching race state:', error)
    return null
  }
}

export async function fetchBets(addr: string): Promise<Bet[]> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_bets`,
        typeArguments: [],
        functionArguments: [addr],
      },
    })
    
    const bets = result[0] as any[]
    return bets.map(bet => ({
      player_address: String(bet.player_address),
      horse_id: Number(bet.horse_id),
      amount: Number(bet.amount),
    }))
  } catch (error) {
    console.error('Error fetching bets:', error)
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

function buildTransaction(fn: string, args: any[]) {
  return {
    data: {
      type: 'entry_function_payload',
      function: `${MODULE_ADDRESS}::${MODULE_NAME}::${fn}`,
      typeArguments: [],
      functionArguments: args,
    },
  }
}

export const transactions = {
  createRace: () => buildTransaction('create_race', []),
  joinRace: (raceAddr: string, horseId: number) => 
    buildTransaction('join_race', [raceAddr, horseId]),
  joinRaceWithNFT: (raceAddr: string, nftHorseId: number) => 
    buildTransaction('join_race_with_nft', [raceAddr, nftHorseId]),
  placeBet: (raceAddr: string, horseId: number, amount: number) => 
    buildTransaction('place_bet', [raceAddr, horseId, amount]),
  startRace: (raceAddr: string) => buildTransaction('start_race', [raceAddr]),
  advanceRace: (raceAddr: string) => buildTransaction('advance_race', [raceAddr]),
  mintHorse: (name: string, speed: number, endurance: number, terrainType: number, color: string) => 
    buildTransaction('mint_horse', [name, speed, endurance, terrainType, color]),
  initializePlayer: () => buildTransaction('initialize_player', []),
}