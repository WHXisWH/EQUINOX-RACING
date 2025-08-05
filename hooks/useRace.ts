import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import {
  aptos,
  RaceState,
  Bet,
  fetchRaceState,
  fetchRaceBets,
  transactions,
} from '@/lib/equinox';

export function useRace(raceId: number | null) {
  const { account, signAndSubmitTransaction } = useWallet();
  const [raceState, setRaceState] = useState<RaceState | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<string>('');
  const [rateLimited, setRateLimited] = useState<boolean>(false);

  const refreshState = useCallback(async () => {
    if (!raceId) return;
    
    try {
      const [state, betData] = await Promise.all([
        fetchRaceState(raceId),
        fetchRaceBets(raceId)
      ]);
      setRaceState(state);
      setBets(betData);
      setError(null);
      setRateLimited(false);
    } catch (e: any) {
      console.error('Error fetching race state:', e);
      if (e?.message?.includes('Rate limit')) {
        setError('API rate limit reached. Reducing refresh frequency...');
        setRateLimited(true);
        setTimeout(() => setRateLimited(false), 60000);
      } else {
        setError(`Failed to fetch race state: ${e.message}`);
      }
    }
  }, [raceId]);

  useEffect(() => {
    if (raceId) {
      refreshState();
      const intervalTime = rateLimited ? 20000 : 8000;
      const interval = setInterval(refreshState, intervalTime);
      return () => clearInterval(interval);
    } else {
      setRaceState(null);
      setBets([]);
    }
  }, [raceId, refreshState, rateLimited]);

  const handleTransaction = async (payload: any, successMessage?: string) => {
    if (!account) {
      setError("Please connect your wallet.");
      return null;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await signAndSubmitTransaction(payload);
      await aptos.waitForTransaction({ transactionHash: response.hash });
      
      if (successMessage) {
        setLastMessage(successMessage);
      }
      
      await refreshState();
      return response.hash;
    } catch (e: any) {
      const errorMessage = e.message || 'Transaction failed';
      setError(errorMessage);
      console.error('Transaction error:', e);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const createNormalRace = () => 
    handleTransaction(transactions.createNormalRace(), "Normal race created!");

  const joinQuickMatch = () => 
    handleTransaction(transactions.joinQuickMatch(), "Joined quick match!");

  const joinRaceWithHorse = (horseId: number) => {
    if (!raceId) return null;
    return handleTransaction(
      transactions.joinRaceWithHorse(raceId, horseId),
      "Joined race with selected horse!"
    );
  };
  
  const joinRaceWithNFT = (nftHorseId: number) => {
    if (!raceId) return null;
    return handleTransaction(
      transactions.joinRaceWithNFT(raceId, nftHorseId),
      "Joined race with NFT horse!"
    );
  };

  const placeBet = (entryIndex: number, amount: number) => {
    if (!raceId) return null;
    const amountInOctas = Math.round(amount * 100000000);
    return handleTransaction(
      transactions.placeBet(raceId, entryIndex, amountInOctas),
      `Bet placed: ${amount.toFixed(4)} APT`
    );
  };

  const startRace = () => {
    if (!raceId) return null;
    return handleTransaction(transactions.startRace(raceId), "Race started!");
  };

  const executeQuickRace = () => {
    if (!raceId) return null;
    return handleTransaction(
      transactions.executeQuickRace(raceId),
      "Quick race auto-started!"
    );
  };

  const advanceRace = () => {
    if (!raceId) return null;
    return handleTransaction(
      transactions.advanceRace(raceId),
      "Race round advanced!"
    );
  };

  const isPlayerInRace = useCallback(() => {
    if (!account || !raceState) return false;
    return raceState.entries.some(entry => 
      entry.player_address === account.address.toString()
    );
  }, [account, raceState]);

  const isCreator = useCallback(() => {
    if (!account || !raceState) return false;
    return raceState.creator === account.address.toString();
  }, [account, raceState]);

  const canExecuteQuickRace = useCallback(() => {
    if (!raceState) return false;
    return raceState.race_type === 1 && 
           !raceState.race_started &&
           raceState.start_time && 
           Date.now() >= raceState.start_time / 1000;
  }, [raceState]);

  const getPlayerEntry = useCallback(() => {
    if (!account || !raceState) return null;
    return raceState.entries.find(entry => 
      entry.player_address === account.address.toString()
    ) || null;
  }, [account, raceState]);

  const getWinners = useCallback(() => {
    if (!raceState || !raceState.race_finished) return [];
    return raceState.entries
      .filter(entry => entry.final_rank > 0)
      .sort((a, b) => a.final_rank - b.final_rank)
      .map(entry => {
        const horse = raceState.horses.find(h => h.id === entry.horse_id);
        return {
          rank: entry.final_rank,
          playerAddress: entry.player_address,
          horseName: horse?.name || 'Unknown',
          isNft: entry.is_nft_horse,
        };
      });
  }, [raceState]);

  return {
    raceState,
    bets,
    loading,
    error,
    lastMessage,
    createNormalRace,
    joinQuickMatch,
    joinRaceWithHorse,
    joinRaceWithNFT,
    placeBet,
    startRace,
    executeQuickRace,
    advanceRace,
    isPlayerInRace,
    isCreator,
    canExecuteQuickRace,
    getPlayerEntry,
    getWinners,
    refreshState,
  };
}