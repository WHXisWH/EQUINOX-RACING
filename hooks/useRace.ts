import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import {
  aptos,
  MODULE_ADDRESS,
  MODULE_NAME,
  RaceState,
  Bet,
  fetchRaceState,
  fetchBets,
  transactions,
} from '@/lib/equinox';

export function useRace(raceAddress: string | null) {
  const { account, signAndSubmitTransaction } = useWallet();
  const [raceState, setRaceState] = useState<RaceState | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<string>('');

  const refreshState = useCallback(async () => {
    if (!raceAddress) return;
    setLoading(true);
    try {
      const state = await fetchRaceState(raceAddress);
      const betData = await fetchBets(raceAddress);
      setRaceState(state);
      setBets(betData);
    } catch (e: any) {
      setError(`Failed to fetch state: ${e.message}`);
      setRaceState(null);
    } finally {
      setLoading(false);
    }
  }, [raceAddress]);

  useEffect(() => {
    if (raceAddress) {
      refreshState();
      const interval = setInterval(refreshState, 5000);
      return () => clearInterval(interval);
    }
  }, [raceAddress, refreshState]);

  const handleTransaction = async (payload: any) => {
    if (!account) {
      setError("Please connect your wallet.");
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await signAndSubmitTransaction(payload);
      await aptos.waitForTransaction({ transactionHash: response.hash });
      await refreshState();
      return response.hash;
    } catch (e: any) {
      setError(`Transaction failed: ${e.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const createRace = () => handleTransaction(transactions.createRace());
  const joinRace = (horseId: number) => {
    if (!raceAddress) return null;
    return handleTransaction(transactions.joinRace(raceAddress, horseId));
  };
  const placeBet = (horseId: number, amount: number) => {
    if (!raceAddress) return null;
    return handleTransaction(transactions.placeBet(raceAddress, horseId, amount));
  };
  const startRace = () => {
    if (!raceAddress) return null;
    return handleTransaction(transactions.startRace(raceAddress));
  };
  const advanceRace = () => {
    if (!raceAddress) return null;
    return handleTransaction(transactions.advanceRace(raceAddress));
  };

  const isPlayerInRace = useCallback(() => {
    if (!account || !raceState) return false;
    return raceState.entries.some(entry => entry.player_address === account.address.toString());
  }, [account, raceState]);

  return {
    raceState,
    bets,
    loading,
    error,
    lastMessage,
    createRace,
    joinRace,
    placeBet,
    startRace,
    advanceRace,
    isPlayerInRace,
  };
}
