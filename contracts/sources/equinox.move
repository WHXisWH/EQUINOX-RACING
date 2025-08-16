module equinox_addr::equinox_v2 {
    use std::signer;
    use std::vector;
    use std::string::{Self, String};
    use std::option::{Self, Option};
    use std::bcs;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::timestamp;
    use aptos_framework::account;
    use aptos_framework::event::{Self, EventHandle};

    struct Horse has store, drop, copy {
        id: u64,
        name: String,
        speed: u64,
        endurance: u64,
        terrain_type: u8,
        color: String,
    }

    struct HorseNFT has key, copy, drop {
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

    struct RaceTrack has store, drop, copy {
        length: u64,
        weather: u8,
        terrain: u8,
    }

    struct RaceEntry has store, drop, copy {
        horse_id: u64,
        player_address: address,
        position: u64,
        energy: u64,
        is_finished: bool,
        finish_time: u64,
        final_rank: u64,
        is_nft_horse: bool,
        nft_horse_id: Option<u64>,
    }

    struct Bet has store, drop, copy {
        player_address: address,
        entry_index: u64,
        amount: u64,
    }

    struct Race has store, copy {
        race_id: u64,
        creator: address,
        race_type: u8,
        track: RaceTrack,
        horses: vector<Horse>,
        entries: vector<RaceEntry>,
        bets: vector<Bet>,
        total_bet_pool: u64,
        entry_fee_pool: u64,
        race_started: bool,
        race_finished: bool,
        current_round: u64,
        max_players: u64,
        created_time: u64,
        start_time: Option<u64>,
        betting_end_time: Option<u64>,
    }

    struct QuickMatchQueue has store {
        waiting_players: vector<address>,
        current_race_id: Option<u64>,
        last_queue_time: u64,
    }

    struct RaceHistory has store, copy, drop {
        race_id: u64,
        winner_address: address,
        winner_horse_name: String,
        total_prize: u64,
        participants: u64,
        finish_time: u64,
    }

    struct GlobalGameManager has key {
        next_race_id: u64,
        total_horses_minted: u64,
        active_races: vector<u64>,
        race_storage: vector<Race>,
        quick_match_queue: QuickMatchQueue,
        race_history: vector<RaceHistory>,
        system_treasury: u64,
        event_handle: EventHandle<GameEvent>,
        signer_cap: account::SignerCapability,
    }

    struct PlayerProfile has key {
        total_races: u64,
        total_wins: u64,
        total_earnings: u64,
        race_history: vector<u64>,
    }

    struct GameEvent has drop, store {
        event_type: String,
        race_id: u64,
        player_address: Option<address>,
        message: String,
        timestamp: u64,
    }

    const E_GAME_NOT_INITIALIZED: u64 = 1;
    const E_RACE_NOT_FOUND: u64 = 2;
    const E_RACE_ALREADY_STARTED: u64 = 3;
    const E_RACE_FULL: u64 = 4;
    const E_INVALID_HORSE: u64 = 5;
    const E_ALREADY_IN_RACE: u64 = 6;
    const E_INSUFFICIENT_FUNDS: u64 = 7;
    const E_RACE_NOT_STARTED: u64 = 8;
    const E_RACE_FINISHED: u64 = 9;
    const E_NOT_CREATOR: u64 = 10;
    const E_INVALID_BET: u64 = 11;
    const E_NOT_HORSE_OWNER: u64 = 12;
    const E_HORSE_NOT_FOUND: u64 = 13;
    const E_INVALID_HORSE_STATS: u64 = 14;
    const E_BETTING_CLOSED: u64 = 15;
    const E_QUICK_MATCH_NOT_READY: u64 = 16;

    const TRACK_LENGTH: u64 = 1000;
    const MAX_PLAYERS_NORMAL: u64 = 6;
    const MAX_PLAYERS_QUICK: u64 = 4;
    const ENTRY_FEE: u64 = 10000000;
    const MIN_BET: u64 = 5000000;
    const MINT_COST: u64 = 20000000;
    const QUICK_MATCH_TRIGGER: u64 = 2;
    const BETTING_WINDOW_SECONDS: u64 = 30;
    const GAS_REWARD: u64 = 1000000;

    const RACE_TYPE_NORMAL: u8 = 0;
    const RACE_TYPE_QUICK: u8 = 1;

    fun init_module(admin: &signer) {
        let (_resource_signer, signer_cap) = account::create_resource_account(admin, b"equinox_racing");
        
        move_to(admin, GlobalGameManager {
            next_race_id: 1,
            total_horses_minted: 0,
            active_races: vector::empty<u64>(),
            race_storage: vector::empty<Race>(),
            quick_match_queue: QuickMatchQueue {
                waiting_players: vector::empty<address>(),
                current_race_id: option::none(),
                last_queue_time: 0,
            },
            race_history: vector::empty<RaceHistory>(),
            system_treasury: 0,
            event_handle: account::new_event_handle<GameEvent>(admin),
            signer_cap,
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

        if (!exists<PlayerProfile>(player_addr)) {
            move_to(player, PlayerProfile {
                total_races: 0,
                total_wins: 0,
                total_earnings: 0,
                race_history: vector::empty<u64>(),
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
    ) acquires PlayerHorses, GlobalGameManager {
        let owner_addr = signer::address_of(owner);
        
        assert!(speed >= 30 && speed <= 80, E_INVALID_HORSE_STATS);
        assert!(endurance >= 30 && endurance <= 80, E_INVALID_HORSE_STATS);
        assert!(terrain_type <= 2, E_INVALID_HORSE_STATS);
        
        coin::transfer<AptosCoin>(owner, @equinox_addr, MINT_COST);
        
        initialize_player(owner);
        
        let game_manager = borrow_global_mut<GlobalGameManager>(@equinox_addr);
        let horse_id = game_manager.total_horses_minted;
        game_manager.total_horses_minted = game_manager.total_horses_minted + 1;
        game_manager.system_treasury = game_manager.system_treasury + MINT_COST;
        
        let player_horses = borrow_global_mut<PlayerHorses>(owner_addr);
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
        
        move_to(owner, horse_nft);
        
        emit_game_event(game_manager, string::utf8(b"horse_minted"), option::none<u64>(), 
                       option::some(owner_addr), string::utf8(b"New horse minted"));
    }

    public entry fun create_normal_race(creator: &signer) acquires GlobalGameManager {
        let creator_addr = signer::address_of(creator);
        
        coin::transfer<AptosCoin>(creator, @equinox_addr, ENTRY_FEE);
        
        let game_manager = borrow_global_mut<GlobalGameManager>(@equinox_addr);
        let race_id = game_manager.next_race_id;
        game_manager.next_race_id = game_manager.next_race_id + 1;
        
        let horses = create_default_horses();
        let track = generate_random_track(race_id);
        
        let race = Race {
            race_id,
            creator: creator_addr,
            race_type: RACE_TYPE_NORMAL,
            track,
            horses,
            entries: vector::empty<RaceEntry>(),
            bets: vector::empty<Bet>(),
            total_bet_pool: 0,
            entry_fee_pool: ENTRY_FEE,
            race_started: false,
            race_finished: false,
            current_round: 0,
            max_players: MAX_PLAYERS_NORMAL,
            created_time: timestamp::now_microseconds(),
            start_time: option::none(),
            betting_end_time: option::none(),
        };
        
        vector::push_back(&mut game_manager.race_storage, race);
        vector::push_back(&mut game_manager.active_races, race_id);
        
        emit_game_event(game_manager, string::utf8(b"race_created"), option::some(race_id), 
                       option::some(creator_addr), string::utf8(b"Normal race created"));
    }

    public entry fun join_quick_match(player: &signer) acquires GlobalGameManager {
        let player_addr = signer::address_of(player);
        
        coin::transfer<AptosCoin>(player, @equinox_addr, ENTRY_FEE);
        
        let game_manager = borrow_global_mut<GlobalGameManager>(@equinox_addr);
        let queue = &mut game_manager.quick_match_queue;
        
        if (!vector::contains(&queue.waiting_players, &player_addr)) {
            vector::push_back(&mut queue.waiting_players, player_addr);
        };
        
        if (vector::length(&queue.waiting_players) >= QUICK_MATCH_TRIGGER) {
            create_quick_match_race(game_manager);
        };
        
        emit_game_event(game_manager, string::utf8(b"quick_match_joined"), option::none<u64>(), 
                       option::some(player_addr), string::utf8(b"Player joined quick match"));
    }

    fun create_quick_match_race(game_manager: &mut GlobalGameManager) {
        let race_id = game_manager.next_race_id;
        game_manager.next_race_id = game_manager.next_race_id + 1;
        
        let horses = create_default_horses();
        let track = generate_random_track(race_id);
        let current_time = timestamp::now_microseconds();
        
        let race = Race {
            race_id,
            creator: @equinox_addr,
            race_type: RACE_TYPE_QUICK,
            track,
            horses,
            entries: vector::empty<RaceEntry>(),
            bets: vector::empty<Bet>(),
            total_bet_pool: 0,
            entry_fee_pool: ENTRY_FEE * vector::length(&game_manager.quick_match_queue.waiting_players),
            race_started: false,
            race_finished: false,
            current_round: 0,
            max_players: MAX_PLAYERS_QUICK,
            created_time: current_time,
            start_time: option::some(current_time + (BETTING_WINDOW_SECONDS * 1000000)),
            betting_end_time: option::some(current_time + (BETTING_WINDOW_SECONDS * 1000000)),
        };
        
        vector::push_back(&mut game_manager.race_storage, race);
        vector::push_back(&mut game_manager.active_races, race_id);
        
        game_manager.quick_match_queue.current_race_id = option::some(race_id);
        game_manager.quick_match_queue.waiting_players = vector::empty<address>();
    }

    public entry fun join_race_with_horse(
        player: &signer, 
        race_id: u64, 
        horse_id: u64
    ) acquires GlobalGameManager {
        let player_addr = signer::address_of(player);
        
        let game_manager = borrow_global_mut<GlobalGameManager>(@equinox_addr);
        let race = find_race_mut(game_manager, race_id);
        
        assert!(!race.race_started, E_RACE_ALREADY_STARTED);
        assert!(vector::length(&race.entries) < race.max_players, E_RACE_FULL);
        assert!(horse_id < vector::length(&race.horses), E_INVALID_HORSE);
        
        assert!(!is_player_in_race(race, player_addr), E_ALREADY_IN_RACE);
        assert!(!is_horse_taken(race, horse_id), E_INVALID_HORSE);
        
        if (race.race_type == RACE_TYPE_NORMAL) {
            coin::transfer<AptosCoin>(player, @equinox_addr, ENTRY_FEE);
            race.entry_fee_pool = race.entry_fee_pool + ENTRY_FEE;
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
            is_nft_horse: false,
            nft_horse_id: option::none(),
        });
        
        emit_game_event(game_manager, string::utf8(b"player_joined"), option::some(race_id), 
                       option::some(player_addr), string::utf8(b"Player joined race"));
    }

    public entry fun join_race_with_nft(
        player: &signer, 
        race_id: u64, 
        nft_horse_id: u64
    ) acquires GlobalGameManager, PlayerHorses, HorseNFT {
        let player_addr = signer::address_of(player);
        
        let player_horses = borrow_global<PlayerHorses>(player_addr);
        assert!(vector::contains(&player_horses.horses, &nft_horse_id), E_NOT_HORSE_OWNER);
        
        let game_manager = borrow_global_mut<GlobalGameManager>(@equinox_addr);
        let race = find_race_mut(game_manager, race_id);
        
        assert!(!race.race_started, E_RACE_ALREADY_STARTED);
        assert!(vector::length(&race.entries) < race.max_players, E_RACE_FULL);
        assert!(!is_player_in_race(race, player_addr), E_ALREADY_IN_RACE);
        
        if (race.race_type == RACE_TYPE_NORMAL) {
            coin::transfer<AptosCoin>(player, @equinox_addr, ENTRY_FEE);
            race.entry_fee_pool = race.entry_fee_pool + ENTRY_FEE;
        };
        
        let horse_nft = get_horse_nft(player_addr, nft_horse_id);
        
        let race_horse = Horse {
            id: vector::length(&race.horses),
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
            is_nft_horse: true,
            nft_horse_id: option::some(nft_horse_id),
        });
        
        emit_game_event(game_manager, string::utf8(b"nft_joined"), option::some(race_id), 
                       option::some(player_addr), string::utf8(b"Player joined with NFT horse"));
    }

    public entry fun place_bet(
        player: &signer, 
        race_id: u64, 
        entry_index: u64, 
        amount: u64
    ) acquires GlobalGameManager {
        let player_addr = signer::address_of(player);
        
        assert!(amount >= MIN_BET, E_INSUFFICIENT_FUNDS);
        coin::transfer<AptosCoin>(player, @equinox_addr, amount);
        
        let game_manager = borrow_global_mut<GlobalGameManager>(@equinox_addr);
        let race = find_race_mut(game_manager, race_id);
        
        assert!(!race.race_started, E_RACE_ALREADY_STARTED);
        assert!(entry_index < vector::length(&race.entries), E_INVALID_BET);
        assert!(!is_player_in_race(race, player_addr), E_INVALID_BET);
        
        if (option::is_some(&race.betting_end_time)) {
            assert!(timestamp::now_microseconds() < *option::borrow(&race.betting_end_time), E_BETTING_CLOSED);
        };
        
        vector::push_back(&mut race.bets, Bet {
            player_address: player_addr,
            entry_index,
            amount,
        });
        
        race.total_bet_pool = race.total_bet_pool + amount;
        
        emit_game_event(game_manager, string::utf8(b"bet_placed"), option::some(race_id), 
                       option::some(player_addr), string::utf8(b"Bet placed"));
    }

    public entry fun start_race(creator: &signer, race_id: u64) acquires GlobalGameManager {
        let creator_addr = signer::address_of(creator);
        
        let game_manager = borrow_global_mut<GlobalGameManager>(@equinox_addr);
        let race = find_race_mut(game_manager, race_id);
        
        assert!(race.creator == creator_addr, E_NOT_CREATOR);
        assert!(!race.race_started, E_RACE_ALREADY_STARTED);
        assert!(vector::length(&race.entries) >= 2, E_RACE_NOT_FOUND);
        
        race.race_started = true;
        race.start_time = option::some(timestamp::now_microseconds());
        
        emit_game_event(game_manager, string::utf8(b"race_started"), option::some(race_id), 
                       option::some(creator_addr), string::utf8(b"Race started"));
    }

    public entry fun execute_quick_race(executor: &signer, race_id: u64) acquires GlobalGameManager {
        let executor_addr = signer::address_of(executor);
        
        let game_manager = borrow_global_mut<GlobalGameManager>(@equinox_addr);
        let race = find_race_mut(game_manager, race_id);
        
        assert!(race.race_type == RACE_TYPE_QUICK, E_QUICK_MATCH_NOT_READY);
        assert!(!race.race_started, E_RACE_ALREADY_STARTED);
        
        if (option::is_some(&race.start_time)) {
            assert!(timestamp::now_microseconds() >= *option::borrow(&race.start_time), E_QUICK_MATCH_NOT_READY);
        };
        
        race.race_started = true;
        
        let resource_signer = account::create_signer_with_capability(&game_manager.signer_cap);
        coin::transfer<AptosCoin>(&resource_signer, executor_addr, GAS_REWARD);
        game_manager.system_treasury = game_manager.system_treasury - GAS_REWARD;
        
        emit_game_event(game_manager, string::utf8(b"quick_race_started"), option::some(race_id), 
                       option::some(executor_addr), string::utf8(b"Quick race auto-started"));
    }

    public entry fun advance_race(_player: &signer, race_id: u64) acquires GlobalGameManager {
        {
            let game_manager = borrow_global_mut<GlobalGameManager>(@equinox_addr);
            let race = find_race_mut(game_manager, race_id);
            
            assert!(race.race_started, E_RACE_NOT_STARTED);
            assert!(!race.race_finished, E_RACE_FINISHED);
            
            race.current_round = race.current_round + 1;
            
            let finished_count = simulate_race_round(race);
            let total_entries = vector::length(&race.entries);
            
            if (finished_count == total_entries) {
                race.race_finished = true;
            }
            else if(is_top_three_determined(race))
            {
                race.race_finished = true;
            }
        };
        
        // Check if race finished and handle prize distribution separately
        let game_manager = borrow_global_mut<GlobalGameManager>(@equinox_addr);
        let race_finished = {
            let race = find_race_mut(game_manager, race_id);
            race.race_finished
        };
        
        if (race_finished) {
            let race = find_race_mut(game_manager, race_id);
            let total_pool = race.entry_fee_pool + (race.total_bet_pool * 40 / 100);
            let betting_pool = race.total_bet_pool * 60 / 100;
            let current_race_id = race.race_id;
            
            // Copy entries for prize distribution
            let entries_copy = race.entries;
            
            let resource_signer = account::create_signer_with_capability(&game_manager.signer_cap);
            
            // Distribute racing prizes
            let first_prize = total_pool * 50 / 100;
            let second_prize = total_pool * 30 / 100;
            let third_prize = total_pool * 20 / 100;
            
            let i = 0;
            let len = vector::length(&entries_copy);
            while (i < len) {
                let entry = vector::borrow(&entries_copy, i);
                if (entry.final_rank == 1 && first_prize > 0) {
                    coin::transfer<AptosCoin>(&resource_signer, entry.player_address, first_prize);
                } else if (entry.final_rank == 2 && second_prize > 0) {
                    coin::transfer<AptosCoin>(&resource_signer, entry.player_address, second_prize);
                } else if (entry.final_rank == 3 && third_prize > 0) {
                    coin::transfer<AptosCoin>(&resource_signer, entry.player_address, third_prize);
                };
                i = i + 1;
            };
            
            game_manager.system_treasury = game_manager.system_treasury + total_pool + betting_pool;
            remove_from_active_races(game_manager, current_race_id);
        };
        
        emit_game_event(game_manager, string::utf8(b"race_advanced"), option::some(race_id), 
                       option::none<address>(), string::utf8(b"Race round completed"));
    }

    fun simulate_race_round(race: &mut Race): u64 {
        let finished_count = 0;
        let i = 0;
        let len = vector::length(&race.entries);
        
        while (i < len) {
            let entry = vector::borrow_mut(&mut race.entries, i);
            
            if (!entry.is_finished) {
                let horse = vector::borrow(&race.horses, entry.horse_id);
                let random_seed = entry.player_address;
                let distance = calculate_movement(horse, &race.track, entry.energy, random_seed, race.current_round);
                
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
        
        finished_count
    }
    fun is_top_three_determined(race: &mut Race): bool{
        let i = 0;
        let len = vector::length(&race.entries);
        while (i < len) {
            let entry = vector::borrow(&race.entries, i);
            if (entry.final_rank == 3) {// Top 3 determined. The race is finished.
                return true;
            };
            i = i + 1;
        };
        false
    }
    fun finish_race(race: &mut Race, game_manager: &mut GlobalGameManager) {
        race.race_finished = true;
        
        distribute_prizes(race, game_manager);
        
        add_to_history(race, game_manager);
        
        remove_from_active_races(game_manager, race.race_id);
    }

    fun distribute_prizes(race: &mut Race, game_manager: &mut GlobalGameManager) {
        let total_pool = race.entry_fee_pool + (race.total_bet_pool * 40 / 100);
        let betting_pool = race.total_bet_pool * 60 / 100;
        
        distribute_racing_prizes(race, total_pool, &game_manager.signer_cap);
        distribute_betting_prizes(race, betting_pool, &game_manager.signer_cap);
        
        game_manager.system_treasury = game_manager.system_treasury + total_pool + betting_pool;
    }

    fun distribute_racing_prizes(race: &Race, total_pool: u64, signer_cap: &account::SignerCapability) {
        let first_prize = total_pool * 50 / 100;
        let second_prize = total_pool * 30 / 100;
        let third_prize = total_pool * 20 / 100;
        
        let i = 0;
        let len = vector::length(&race.entries);
        while (i < len) {
            let entry = vector::borrow(&race.entries, i);
            if (entry.final_rank == 1 && first_prize > 0) {
                let resource_signer = account::create_signer_with_capability(signer_cap);
                coin::transfer<AptosCoin>(&resource_signer, entry.player_address, first_prize);
            } else if (entry.final_rank == 2 && second_prize > 0) {
                let resource_signer = account::create_signer_with_capability(signer_cap);
                coin::transfer<AptosCoin>(&resource_signer, entry.player_address, second_prize);
            } else if (entry.final_rank == 3 && third_prize > 0) {
                let resource_signer = account::create_signer_with_capability(signer_cap);
                coin::transfer<AptosCoin>(&resource_signer, entry.player_address, third_prize);
            };
            i = i + 1;
        };
    }

    fun distribute_betting_prizes(race: &Race, betting_pool: u64, signer_cap: &account::SignerCapability) {
        let winner_entry_index = option::none<u64>();
        
        let i = 0;
        let len = vector::length(&race.entries);
        while (i < len) {
            let entry = vector::borrow(&race.entries, i);
            if (entry.final_rank == 1) {
                winner_entry_index = option::some(i);
                break
            };
            i = i + 1;
        };
        
        if (option::is_some(&winner_entry_index)) {
            let winning_index = *option::borrow(&winner_entry_index);
            let total_winning_bets = 0;
            
            let i = 0;
            let bet_len = vector::length(&race.bets);
            while (i < bet_len) {
                let bet = vector::borrow(&race.bets, i);
                if (bet.entry_index == winning_index) {
                    total_winning_bets = total_winning_bets + bet.amount;
                };
                i = i + 1;
            };
            
            if (total_winning_bets > 0) {
                let i = 0;
                while (i < bet_len) {
                    let bet = vector::borrow(&race.bets, i);
                    if (bet.entry_index == winning_index) {
                        let payout = betting_pool * bet.amount / total_winning_bets;
                        let resource_signer = account::create_signer_with_capability(signer_cap);
                        coin::transfer<AptosCoin>(&resource_signer, bet.player_address, payout);
                    };
                    i = i + 1;
                };
            };
        };
    }

    fun add_to_history(race: &Race, game_manager: &mut GlobalGameManager) {
        let winner_address = @0x0;
        let winner_horse_name = string::utf8(b"Unknown");
        
        let i = 0;
        let len = vector::length(&race.entries);
        while (i < len) {
            let entry = vector::borrow(&race.entries, i);
            if (entry.final_rank == 1) {
                winner_address = entry.player_address;
                let horse = vector::borrow(&race.horses, entry.horse_id);
                winner_horse_name = horse.name;
                break
            };
            i = i + 1;
        };
        
        vector::push_back(&mut game_manager.race_history, RaceHistory {
            race_id: race.race_id,
            winner_address,
            winner_horse_name,
            total_prize: race.entry_fee_pool + race.total_bet_pool,
            participants: vector::length(&race.entries),
            finish_time: timestamp::now_microseconds(),
        });
    }

    fun calculate_movement(horse: &Horse, track: &RaceTrack, energy: u64, seed_addr: address, round: u64): u64 {
        let base_speed = horse.speed;
        let random_factor = generate_random(seed_addr, round) % 31;
        let terrain_bonus = calculate_terrain_bonus(horse.terrain_type, track.terrain, track.weather);
        let energy_penalty = if (energy < 30) { 15 } else { 0 };
        
        base_speed + random_factor + terrain_bonus - energy_penalty
    }

    fun calculate_terrain_bonus(horse_terrain: u8, track_terrain: u8, weather: u8): u64 {
        if (horse_terrain == 2) {
            return 10
        };
        
        if (weather == 1) {
            if (horse_terrain == 1) { 15 } else { 0 }
        } else {
            if (horse_terrain == track_terrain) { 20 } else { 0 }
        }
    }

    fun create_default_horses(): vector<Horse> {
        let horses = vector::empty<Horse>();
        
        vector::push_back(&mut horses, Horse {
            id: 0, name: string::utf8(b"Thunder Hoof"), speed: 60, endurance: 60,
            terrain_type: 0, color: string::utf8(b"red"),
        });
        vector::push_back(&mut horses, Horse {
            id: 1, name: string::utf8(b"Wind Dancer"), speed: 55, endurance: 70,
            terrain_type: 1, color: string::utf8(b"blue"),
        });
        vector::push_back(&mut horses, Horse {
            id: 2, name: string::utf8(b"Storm Chaser"), speed: 50, endurance: 80,
            terrain_type: 2, color: string::utf8(b"green"),
        });
        vector::push_back(&mut horses, Horse {
            id: 3, name: string::utf8(b"Moon Shadow"), speed: 58, endurance: 65,
            terrain_type: 0, color: string::utf8(b"purple"),
        });
        vector::push_back(&mut horses, Horse {
            id: 4, name: string::utf8(b"Fire Bolt"), speed: 62, endurance: 55,
            terrain_type: 1, color: string::utf8(b"orange"),
        });
        vector::push_back(&mut horses, Horse {
            id: 5, name: string::utf8(b"Ice Crystal"), speed: 52, endurance: 75,
            terrain_type: 2, color: string::utf8(b"cyan"),
        });
        
        horses
    }

    fun generate_random_track(race_id: u64): RaceTrack {
        let seed = race_id + timestamp::now_microseconds();
        RaceTrack {
            length: TRACK_LENGTH,
            weather: ((seed / 1000) % 2) as u8,
            terrain: ((seed / 2000) % 2) as u8,
        }
    }

    fun generate_random(addr: address, round: u64): u64 {
        let addr_bytes = bcs::to_bytes(&addr);
        let seed = timestamp::now_microseconds() + round;
        let i = 0;
        let len = vector::length(&addr_bytes);
        while (i < len) {
            seed = seed + (*vector::borrow(&addr_bytes, i) as u64);
            i = i + 1;
        };
        seed % 100
    }

    fun find_race_mut(game_manager: &mut GlobalGameManager, race_id: u64): &mut Race {
        let i = 0;
        let len = vector::length(&game_manager.race_storage);
        while (i < len) {
            let race = vector::borrow_mut(&mut game_manager.race_storage, i);
            if (race.race_id == race_id) {
                return race
            };
            i = i + 1;
        };
        abort E_RACE_NOT_FOUND
    }

    fun find_race(game_manager: &GlobalGameManager, race_id: u64): &Race {
        let i = 0;
        let len = vector::length(&game_manager.race_storage);
        while (i < len) {
            let race = vector::borrow(&game_manager.race_storage, i);
            if (race.race_id == race_id) {
                return race
            };
            i = i + 1;
        };
        abort E_RACE_NOT_FOUND
    }

    fun is_player_in_race(race: &Race, player_addr: address): bool {
        let i = 0;
        let len = vector::length(&race.entries);
        while (i < len) {
            let entry = vector::borrow(&race.entries, i);
            if (entry.player_address == player_addr) {
                return true
            };
            i = i + 1;
        };
        false
    }

    fun is_horse_taken(race: &Race, horse_id: u64): bool {
        let i = 0;
        let len = vector::length(&race.entries);
        while (i < len) {
            let entry = vector::borrow(&race.entries, i);
            if (entry.horse_id == horse_id && !entry.is_nft_horse) {
                return true
            };
            i = i + 1;
        };
        false
    }

    fun remove_from_active_races(game_manager: &mut GlobalGameManager, race_id: u64) {
        let i = 0;
        let len = vector::length(&game_manager.active_races);
        while (i < len) {
            if (*vector::borrow(&game_manager.active_races, i) == race_id) {
                vector::swap_remove(&mut game_manager.active_races, i);
                break
            };
            i = i + 1;
        };
    }

    fun get_horse_nft(owner_addr: address, _horse_id: u64): HorseNFT acquires HorseNFT {
        if (exists<HorseNFT>(owner_addr)) {
            *borrow_global<HorseNFT>(owner_addr)
        } else {
            abort E_HORSE_NOT_FOUND
        }
    }

    fun emit_game_event(
        game_manager: &mut GlobalGameManager, 
        event_type: String, 
        race_id: Option<u64>, 
        player_address: Option<address>, 
        message: String
    ) {
        event::emit_event<GameEvent>(&mut game_manager.event_handle, GameEvent {
            event_type,
            race_id: if (option::is_some(&race_id)) { *option::borrow(&race_id) } else { 0 },
            player_address,
            message,
            timestamp: timestamp::now_microseconds(),
        });
    }

    #[view]
    public fun get_race_state(race_id: u64): (
        u64, address, u8, bool, bool, u64, vector<Horse>, vector<RaceEntry>, 
        RaceTrack, u64, u64, Option<u64>, Option<u64>
    ) acquires GlobalGameManager {
        let game_manager = borrow_global<GlobalGameManager>(@equinox_addr);
        let race = find_race(game_manager, race_id);
        (
            race.race_id,
            race.creator,
            race.race_type,
            race.race_started,
            race.race_finished,
            race.current_round,
            race.horses,
            race.entries,
            race.track,
            race.total_bet_pool,
            race.entry_fee_pool,
            race.start_time,
            race.betting_end_time
        )
    }

    #[view]
    public fun get_race_bets(race_id: u64): vector<Bet> acquires GlobalGameManager {
        let game_manager = borrow_global<GlobalGameManager>(@equinox_addr);
        let race = find_race(game_manager, race_id);
        race.bets
    }

    #[view]
    public fun get_active_races(): vector<u64> acquires GlobalGameManager {
        let game_manager = borrow_global<GlobalGameManager>(@equinox_addr);
        game_manager.active_races
    }

    #[view]
    public fun get_quick_match_status(): (vector<address>, Option<u64>, u64) acquires GlobalGameManager {
        let game_manager = borrow_global<GlobalGameManager>(@equinox_addr);
        let queue = &game_manager.quick_match_queue;
        (queue.waiting_players, queue.current_race_id, queue.last_queue_time)
    }

    #[view]
    public fun get_race_history(limit: u64): vector<RaceHistory> acquires GlobalGameManager {
        let game_manager = borrow_global<GlobalGameManager>(@equinox_addr);
        let history = &game_manager.race_history;
        let len = vector::length(history);
        
        if (len <= limit) {
            return *history
        };
        
        let result = vector::empty<RaceHistory>();
        let start = len - limit;
        let i = start;
        while (i < len) {
            vector::push_back(&mut result, *vector::borrow(history, i));
            i = i + 1;
        };
        result
    }

    #[view]
    public fun get_player_horses(player_addr: address): vector<u64> acquires PlayerHorses {
        if (!exists<PlayerHorses>(player_addr)) {
            return vector::empty<u64>()
        };
        let player_horses = borrow_global<PlayerHorses>(player_addr);
        player_horses.horses
    }

    #[view]
    public fun get_horse_details(owner_addr: address, horse_id: u64): (
        u64, String, u64, u64, u8, String, address, u64
    ) acquires HorseNFT {
        let horse = get_horse_nft(owner_addr, horse_id);
        (horse.id, horse.name, horse.speed, horse.endurance, 
         horse.terrain_type, horse.color, horse.owner, horse.created_time)
    }

    #[view]
    public fun get_player_profile(player_addr: address): (u64, u64, u64, vector<u64>) acquires PlayerProfile {
        if (!exists<PlayerProfile>(player_addr)) {
            return (0, 0, 0, vector::empty<u64>())
        };
        let profile = borrow_global<PlayerProfile>(player_addr);
        (profile.total_races, profile.total_wins, profile.total_earnings, profile.race_history)
    }

    #[view]
    public fun get_game_stats(): (u64, u64, u64, u64, u64) acquires GlobalGameManager {
        let game_manager = borrow_global<GlobalGameManager>(@equinox_addr);
        (
            game_manager.next_race_id - 1,
            game_manager.total_horses_minted,
            vector::length(&game_manager.active_races),
            vector::length(&game_manager.race_history),
            game_manager.system_treasury
        )
    }

    #[view]
    public fun get_system_config(): (u64, u64, u64, u64, u64, u64, u64) {
        (ENTRY_FEE, MIN_BET, MINT_COST, TRACK_LENGTH, 
         MAX_PLAYERS_NORMAL, MAX_PLAYERS_QUICK, BETTING_WINDOW_SECONDS)
    }
}