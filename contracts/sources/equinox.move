module equinox_addr::equinox {
    use std::signer;
    use std::vector;
    use std::string::{Self, String};
    use std::bcs;
    use aptos_framework::account;
    use aptos_framework::event::{Self, EventHandle};
    use aptos_framework::timestamp;

    struct Horse has store, drop, copy {
        id: u64,
        name: String,
        speed: u64,
        endurance: u64,
        terrain_type: u8, // 0: Grass, 1: Dirt, 2: All-weather
        color: String,
    }

    struct HorseNFT has key {
        id: u64,
        name: String,
        speed: u64,
        endurance: u64,
        terrain_type: u8,
        color: String,
        owner: address,
        created_time: u64,
    }

    struct PlayerHorses has key {
        horses: vector<u64>,
        next_horse_id: u64,
    }

    struct GlobalHorseRegistry has key {
        total_horses: u64,
        collection_name: String,
    }

    struct RaceTrack has store, drop, copy {
        length: u64,
        weather: u8, // 0: Sunny, 1: Rainy
        terrain: u8, // 0: Grass, 1: Dirt
    }

    struct RaceEntry has store, drop, copy {
        horse_id: u64,
        player_address: address,
        position: u64,
        energy: u64,
        is_finished: bool,
        finish_time: u64,
        final_rank: u64,
    }

    struct Bet has store, drop, copy {
        player_address: address,
        horse_id: u64,
        amount: u64,
    }

    struct Race has key {
        race_id: u64,
        creator: address,
        track: RaceTrack,
        horses: vector<Horse>,
        entries: vector<RaceEntry>,
        bets: vector<Bet>,
        total_bet_pool: u64,
        race_started: bool,
        race_finished: bool,
        current_round: u64,
        max_players: u64,
        event_handle: EventHandle<RaceUpdateEvent>,
    }

    struct RaceUpdateEvent has drop, store {
        race_id: u64,
        round: u64,
        entries: vector<RaceEntry>,
        message: String,
    }

    const E_RACE_NOT_FOUND: u64 = 1;
    const E_RACE_ALREADY_STARTED: u64 = 2;
    const E_RACE_FULL: u64 = 3;
    const E_INVALID_HORSE: u64 = 4;
    const E_ALREADY_IN_RACE: u64 = 5;
    const E_INSUFFICIENT_FUNDS: u64 = 6;
    const E_RACE_NOT_STARTED: u64 = 7;
    const E_RACE_FINISHED: u64 = 8;
    const E_NOT_CREATOR: u64 = 9;
    const E_INVALID_BET: u64 = 10;
    const E_NOT_HORSE_OWNER: u64 = 11;
    const E_HORSE_NOT_FOUND: u64 = 12;
    const E_INVALID_HORSE_STATS: u64 = 13;

    const STARTING_BALANCE: u64 = 1000;
    const TRACK_LENGTH: u64 = 1000;
    const MAX_PLAYERS: u64 = 6;
    const ENTRY_FEE: u64 = 50;
    const MIN_BET: u64 = 10;
    const MINT_COST: u64 = 100;
    const COLLECTION_NAME: vector<u8> = b"Equinox Racing Horses";

    fun init_module(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        
        move_to(admin, GlobalHorseRegistry {
            total_horses: 0,
            collection_name: string::utf8(COLLECTION_NAME),
        });
    }

    public entry fun initialize_player(player: &signer) {
        let player_addr = signer::address_of(player);
        
        if (!exists<PlayerHorses>(player_addr)) {
            move_to(player, PlayerHorses {
                horses: vector::empty<u64>(),
                next_horse_id: 0,
            });
        };
    }

    public entry fun mint_horse(
        owner: &signer,
        name: String,
        speed: u64,
        endurance: u64,
        terrain_type: u8,
        color: String
    ) acquires PlayerHorses, GlobalHorseRegistry {
        let owner_addr = signer::address_of(owner);
        
        assert!(speed >= 30 && speed <= 80, E_INVALID_HORSE_STATS);
        assert!(endurance >= 30 && endurance <= 80, E_INVALID_HORSE_STATS);
        assert!(terrain_type <= 2, E_INVALID_HORSE_STATS);
        
        initialize_player(owner);
        
        let player_horses = borrow_global_mut<PlayerHorses>(owner_addr);
        let registry = borrow_global_mut<GlobalHorseRegistry>(@equinox_addr);
        
        let horse_id = registry.total_horses;
        registry.total_horses = registry.total_horses + 1;
        
        vector::push_back(&mut player_horses.horses, horse_id);
        
        let horse_nft = HorseNFT {
            id: horse_id,
            name,
            speed,
            endurance,
            terrain_type,
            color,
            owner: owner_addr,
            created_time: timestamp::now_microseconds(),
        };
        
        let horse_addr = account::create_resource_address(&owner_addr, bcs::to_bytes(&horse_id));
        let (resource_signer, _cap) = account::create_resource_account(owner, bcs::to_bytes(&horse_id));
        
        move_to(&resource_signer, horse_nft);
    }

    public entry fun create_race(creator: &signer) acquires Race {
        let creator_addr = signer::address_of(creator);
        let race_id = timestamp::now_microseconds();
        
        let horses = create_test_horses();
        let track = RaceTrack {
            length: TRACK_LENGTH,
            weather: ((race_id / 1000) % 2) as u8,
            terrain: ((race_id / 2000) % 2) as u8,
        };

        let race = Race {
            race_id,
            creator: creator_addr,
            track,
            horses,
            entries: vector::empty<RaceEntry>(),
            bets: vector::empty<Bet>(),
            total_bet_pool: 0,
            race_started: false,
            race_finished: false,
            current_round: 0,
            max_players: MAX_PLAYERS,
            event_handle: account::new_event_handle<RaceUpdateEvent>(creator),
        };
        
        move_to(creator, race);
        
        let race_ref = borrow_global_mut<Race>(creator_addr);
        emit_race_update(race_ref, string::utf8(b"Race created! Players can join with their NFT horses!"));
    }

    public entry fun join_race_with_nft(
        player: &signer, 
        race_addr: address, 
        nft_horse_id: u64
    ) acquires Race, PlayerHorses, HorseNFT {
        let player_addr = signer::address_of(player);
        let race = borrow_global_mut<Race>(race_addr);
        
        assert!(!race.race_started, E_RACE_ALREADY_STARTED);
        assert!(vector::length(&race.entries) < race.max_players, E_RACE_FULL);
        
        assert!(exists<PlayerHorses>(player_addr), E_HORSE_NOT_FOUND);
        let player_horses = borrow_global<PlayerHorses>(player_addr);
        
        let owns_horse = false;
        let i = 0;
        let len = vector::length(&player_horses.horses);
        while (i < len) {
            if (*vector::borrow(&player_horses.horses, i) == nft_horse_id) {
                owns_horse = true;
                break
            };
            i = i + 1;
        };
        assert!(owns_horse, E_NOT_HORSE_OWNER);
        
        let horse_addr = account::create_resource_address(&player_addr, bcs::to_bytes(&nft_horse_id));
        assert!(exists<HorseNFT>(horse_addr), E_HORSE_NOT_FOUND);
        let horse_nft = borrow_global<HorseNFT>(horse_addr);
        
        let i = 0;
        let len = vector::length(&race.entries);
        while (i < len) {
            let entry = vector::borrow(&race.entries, i);
            assert!(entry.player_address != player_addr, E_ALREADY_IN_RACE);
            i = i + 1;
        };
        
        let race_horse = Horse {
            id: nft_horse_id,
            name: horse_nft.name,
            speed: horse_nft.speed,
            endurance: horse_nft.endurance,
            terrain_type: horse_nft.terrain_type,
            color: horse_nft.color,
        };
        
        vector::push_back(&mut race.horses, race_horse);
        let horse_index = vector::length(&race.horses) - 1;
        
        vector::push_back(&mut race.entries, RaceEntry {
            horse_id: horse_index,
            player_address: player_addr,
            position: 0,
            energy: horse_nft.endurance,
            is_finished: false,
            finish_time: 0,
            final_rank: 0,
        });
        
        let msg = string::utf8(b"Player joined with NFT horse: ");
        string::append(&mut msg, horse_nft.name);
        emit_race_update(race, msg);
    }

    public entry fun join_race(player: &signer, race_addr: address, horse_id: u64) acquires Race {
        let player_addr = signer::address_of(player);
        let race = borrow_global_mut<Race>(race_addr);
        
        assert!(!race.race_started, E_RACE_ALREADY_STARTED);
        assert!(vector::length(&race.entries) < race.max_players, E_RACE_FULL);
        assert!(horse_id < vector::length(&race.horses), E_INVALID_HORSE);
        
        let i = 0;
        let len = vector::length(&race.entries);
        while (i < len) {
            let entry = vector::borrow(&race.entries, i);
            assert!(entry.player_address != player_addr, E_ALREADY_IN_RACE);
            assert!(entry.horse_id != horse_id, E_INVALID_HORSE);
            i = i + 1;
        };
        
        let horse = vector::borrow(&race.horses, horse_id);
        vector::push_back(&mut race.entries, RaceEntry {
            horse_id,
            player_address: player_addr,
            position: 0,
            energy: horse.endurance,
            is_finished: false,
            finish_time: 0,
            final_rank: 0,
        });
        
        let msg = string::utf8(b"Player joined with ");
        string::append(&mut msg, horse.name);
        emit_race_update(race, msg);
    }

    public entry fun place_bet(player: &signer, race_addr: address, horse_id: u64, amount: u64) acquires Race {
        let player_addr = signer::address_of(player);
        let race = borrow_global_mut<Race>(race_addr);
        
        assert!(!race.race_started, E_RACE_ALREADY_STARTED);
        assert!(amount >= MIN_BET, E_INSUFFICIENT_FUNDS);
        
        let horse_in_race = false;
        let i = 0;
        let len = vector::length(&race.entries);
        while (i < len) {
            let entry = vector::borrow(&race.entries, i);
            if (entry.horse_id == horse_id) {
                horse_in_race = true;
                break
            };
            i = i + 1;
        };
        assert!(horse_in_race, E_INVALID_BET);
        
        vector::push_back(&mut race.bets, Bet {
            player_address: player_addr,
            horse_id,
            amount,
        });
        
        race.total_bet_pool = race.total_bet_pool + amount;
        
        let msg = string::utf8(b"Bet placed: ");
        string::append(&mut msg, u64_to_string(amount));
        string::append(&mut msg, string::utf8(b" on horse #"));
        string::append(&mut msg, u64_to_string(horse_id + 1));
        emit_race_update(race, msg);
    }

    public entry fun start_race(creator: &signer, race_addr: address) acquires Race {
        let creator_addr = signer::address_of(creator);
        let race = borrow_global_mut<Race>(race_addr);
        
        assert!(race.creator == creator_addr, E_NOT_CREATOR);
        assert!(!race.race_started, E_RACE_ALREADY_STARTED);
        assert!(vector::length(&race.entries) >= 2, E_RACE_NOT_FOUND);
        
        race.race_started = true;
        emit_race_update(race, string::utf8(b"Race started!"));
    }

    public entry fun advance_race(player: &signer, race_addr: address) acquires Race {
        let race = borrow_global_mut<Race>(race_addr);
        
        assert!(race.race_started, E_RACE_NOT_STARTED);
        assert!(!race.race_finished, E_RACE_FINISHED);
        
        race.current_round = race.current_round + 1;
        
        let finished_count = 0;
        let i = 0;
        let len = vector::length(&race.entries);
        
        while (i < len) {
            let entry = vector::borrow_mut(&mut race.entries, i);
            
            if (!entry.is_finished) {
                let horse = vector::borrow(&race.horses, entry.horse_id);
                let base_speed = horse.speed;
                let random_factor = generate_random(entry.player_address, race.current_round) % 51;
                let terrain_bonus = calculate_terrain_bonus(horse.terrain_type, race.track.terrain, race.track.weather);
                let energy_penalty = if (entry.energy < 30) { 20 } else { 0 };
                
                let distance = base_speed + random_factor + terrain_bonus - energy_penalty;
                entry.position = entry.position + distance;
                
                if (entry.energy > 5) {
                    entry.energy = entry.energy - 5;
                };
                
                if (entry.position >= race.track.length) {
                    entry.is_finished = true;
                    entry.finish_time = race.current_round;
                    entry.final_rank = finished_count + 1;
                }
            };
            
            if (entry.is_finished) {
                finished_count = finished_count + 1;
            };
            
            i = i + 1;
        };
        
        if (finished_count == len) {
            race.race_finished = true;
            distribute_prizes(race);
            emit_race_update(race, string::utf8(b"Race finished!"));
        } else {
            let msg = string::utf8(b"Round ");
            string::append(&mut msg, u64_to_string(race.current_round));
            emit_race_update(race, msg);
        }
    }

    fun create_test_horses(): vector<Horse> {
        let horses = vector::empty<Horse>();
        
        vector::push_back(&mut horses, Horse {
            id: 0,
            name: string::utf8(b"Thunder Hoof"),
            speed: 60,
            endurance: 60,
            terrain_type: 0,
            color: string::utf8(b"red"),
        });
        
        vector::push_back(&mut horses, Horse {
            id: 1,
            name: string::utf8(b"Wind Dancer"),
            speed: 55,
            endurance: 70,
            terrain_type: 1,
            color: string::utf8(b"blue"),
        });
        
        vector::push_back(&mut horses, Horse {
            id: 2,
            name: string::utf8(b"Storm Chaser"),
            speed: 50,
            endurance: 80,
            terrain_type: 2,
            color: string::utf8(b"green"),
        });
        
        vector::push_back(&mut horses, Horse {
            id: 3,
            name: string::utf8(b"Moon Shadow"),
            speed: 58,
            endurance: 65,
            terrain_type: 0,
            color: string::utf8(b"purple"),
        });
        
        vector::push_back(&mut horses, Horse {
            id: 4,
            name: string::utf8(b"Fire Bolt"),
            speed: 62,
            endurance: 55,
            terrain_type: 1,
            color: string::utf8(b"orange"),
        });
        
        vector::push_back(&mut horses, Horse {
            id: 5,
            name: string::utf8(b"Ice Crystal"),
            speed: 52,
            endurance: 75,
            terrain_type: 2,
            color: string::utf8(b"cyan"),
        });
        
        horses
    }

    fun calculate_terrain_bonus(horse_terrain: u8, track_terrain: u8, weather: u8): u64 {
        if (horse_terrain == 2) {
            return 10
        };
        
        if (weather == 1) {
            if (horse_terrain == 1) {
                return 15
            } else {
                return 0
            }
        } else {
            if (horse_terrain == track_terrain) {
                return 20
            } else {
                return 0
            }
        }
    }

    fun distribute_prizes(race: &mut Race) {
        let prize_pool = race.total_bet_pool;
        if (prize_pool == 0) {
            return
        };
        
        let first_prize = prize_pool * 50 / 100;
        let second_prize = prize_pool * 30 / 100;
        let third_prize = prize_pool * 20 / 100;
        
        let i = 0;
        let len = vector::length(&race.bets);
        while (i < len) {
            let bet = vector::borrow(&race.bets, i);
            let j = 0;
            let entries_len = vector::length(&race.entries);
            while (j < entries_len) {
                let entry = vector::borrow(&race.entries, j);
                if (entry.horse_id == bet.horse_id) {
                    if (entry.final_rank == 1) {
                        // In real implementation, transfer coins to bet.player_address
                        // For now, we just track it in the event
                    } else if (entry.final_rank == 2) {
                        // Transfer second prize
                    } else if (entry.final_rank == 3) {
                        // Transfer third prize
                    };
                    break
                };
                j = j + 1;
            };
            i = i + 1;
        };
    }

    fun generate_random(addr: address, round: u64): u64 {
        let addr_bytes = bcs::to_bytes(&addr);
        let seed = timestamp::now_microseconds() + round + vector::length(&addr_bytes);
        seed % 100
    }

    fun emit_race_update(race: &mut Race, message: String) {
        event::emit_event<RaceUpdateEvent>(&mut race.event_handle, RaceUpdateEvent {
            race_id: race.race_id,
            round: race.current_round,
            entries: *&race.entries,
            message,
        });
    }

    fun u64_to_string(num: u64): String {
        if (num == 0) {
            return string::utf8(b"0")
        };
        
        let bytes = vector::empty<u8>();
        let n = num;
        while (n > 0) {
            vector::push_back(&mut bytes, ((n % 10) as u8) + 48);
            n = n / 10;
        };
        
        vector::reverse(&mut bytes);
        string::utf8(bytes)
    }

    #[view]
    public fun get_race_state(race_addr: address): (
        u64, bool, bool, u64, vector<Horse>, vector<RaceEntry>, RaceTrack, u64
    ) acquires Race {
        let race = borrow_global<Race>(race_addr);
        (
            race.race_id,
            race.race_started,
            race.race_finished,
            race.current_round,
            *&race.horses,
            *&race.entries,
            *&race.track,
            race.total_bet_pool
        )
    }

    #[view]
    public fun get_bets(race_addr: address): vector<Bet> acquires Race {
        let race = borrow_global<Race>(race_addr);
        *&race.bets
    }

    #[view]
    public fun get_player_horses(player_addr: address): vector<u64> acquires PlayerHorses {
        if (!exists<PlayerHorses>(player_addr)) {
            return vector::empty<u64>()
        };
        let player_horses = borrow_global<PlayerHorses>(player_addr);
        *&player_horses.horses
    }

    #[view]
    public fun get_horse_details(owner_addr: address, horse_id: u64): (
        u64, String, u64, u64, u8, String, address, u64
    ) acquires HorseNFT {
        let horse_addr = account::create_resource_address(&owner_addr, bcs::to_bytes(&horse_id));
        let horse = borrow_global<HorseNFT>(horse_addr);
        (
            horse.id,
            horse.name,
            horse.speed,
            horse.endurance,
            horse.terrain_type,
            horse.color,
            horse.owner,
            horse.created_time
        )
    }

    #[view]
    public fun get_total_horses(): u64 acquires GlobalHorseRegistry {
        let registry = borrow_global<GlobalHorseRegistry>(@equinox_addr);
        registry.total_horses
    }
}