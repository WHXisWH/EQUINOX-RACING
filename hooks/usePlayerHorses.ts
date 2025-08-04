import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import {
  aptos,
  PlayerHorseNFT,
  fetchPlayerHorsesWithDetails,
  transactions,
} from '@/lib/equinox';

export function usePlayerHorses() {
  const { account, signAndSubmitTransaction } = useWallet();
  const [horses, setHorses] = useState<PlayerHorseNFT[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshHorses = useCallback(async () => {
    if (!account) {
      setHorses([]);
      return;
    }
    
    setLoading(true);
    try {
      const playerHorses = await fetchPlayerHorsesWithDetails(account.address.toString());
      setHorses(playerHorses);
      setError(null);
    } catch (e: any) {
      setError(`Failed to fetch horses: ${e.message}`);
      setHorses([]);
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    refreshHorses();
  }, [refreshHorses]);

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
      await refreshHorses();
      if (successMessage) {
        console.log(successMessage);
      }
      return response.hash;
    } catch (e: any) {
      setError(`Transaction failed: ${e.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const initializePlayer = () => 
    handleTransaction(transactions.initializePlayer(), "Player initialized!");

  const mintHorse = (name: string, speed: number, endurance: number, terrainType: number, color: string) =>
    handleTransaction(
      transactions.mintHorse(name, speed, endurance, terrainType, color),
      `Successfully minted ${name}!`
    );

  const getTerrainTypeName = (terrainType: number): string => {
    switch (terrainType) {
      case 0: return 'Grass';
      case 1: return 'Dirt';
      case 2: return 'All-weather';
      default: return 'Unknown';
    }
  };

  return {
    horses,
    loading,
    error,
    refreshHorses,
    initializePlayer,
    mintHorse,
    getTerrainTypeName,
  };
}