import { useState } from 'react';
import { RaceState, Bet, formatAPT } from '@/lib/equinox';

interface BettingPanelProps {
  raceState: RaceState | null;
  bets: Bet[];
  onPlaceBet: (entryIndex: number, amount: number) => void;
  disabled: boolean;
  currentUserAddress?: string;
}

export function BettingPanel({ raceState, bets, onPlaceBet, disabled, currentUserAddress }: BettingPanelProps) {
  const [selectedEntryIndex, setSelectedEntryIndex] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState<string>('0.05');

  if (!raceState || raceState.entries.length === 0) return null;

  const handlePlaceBet = () => {
    if (selectedEntryIndex !== null && betAmount) {
      const amount = parseFloat(betAmount);
      if (amount >= 0.05) {
        onPlaceBet(selectedEntryIndex, amount);
        setBetAmount('0.05');
        setSelectedEntryIndex(null);
      }
    }
  };

  const getEntryBets = (entryIndex: number) => {
    return bets.filter(bet => bet.entry_index === entryIndex);
  };

  const getTotalBetsOnEntry = (entryIndex: number) => {
    return getEntryBets(entryIndex).reduce((sum, bet) => sum + bet.amount, 0);
  };

  const getMyBetOnEntry = (entryIndex: number) => {
    if (!currentUserAddress) return 0;
    const myBets = bets.filter(bet => 
      bet.entry_index === entryIndex && bet.player_address === currentUserAddress
    );
    return myBets.reduce((sum, bet) => sum + bet.amount, 0);
  };

  const isPlayerInRace = () => {
    if (!currentUserAddress) return false;
    return raceState.entries.some(entry => entry.player_address === currentUserAddress);
  };

  const getBettingTimeLeft = () => {
    if (!raceState.betting_end_time) return null;
    const timeLeft = Math.max(0, raceState.betting_end_time / 1000 - Date.now());
    return Math.ceil(timeLeft / 1000);
  };

  const timeLeft = getBettingTimeLeft();
  const isQuickRaceBetting = raceState.race_type === 1 && timeLeft !== null;

  if (isPlayerInRace()) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold mb-4">💰 Betting Panel</h2>
        <div className="text-center py-8">
          <div className="text-4xl mb-2">🚫</div>
          <p className="text-gray-600">Race participants cannot place bets</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">💰 Place Your Bets</h2>
        {isQuickRaceBetting && (
          <div className="text-sm font-medium text-orange-600">
            ⏱️ {timeLeft}s left
          </div>
        )}
      </div>
      
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">
          Total Bet Pool: {formatAPT(raceState.total_bet_pool)}
        </p>
        <div className="grid grid-cols-3 gap-2 text-xs text-center">
          <div className="bg-yellow-100 p-2 rounded">🥇 Winner takes 60%</div>
          <div className="bg-gray-100 p-2 rounded">💰 Entry Pool: 40%</div>
          <div className="bg-blue-100 p-2 rounded">Min: 0.05 APT</div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {raceState.entries.map((entry, index) => {
          const horse = raceState.horses.find(h => h.id === entry.horse_id);
          if (!horse) return null;
          
          const totalBets = getTotalBetsOnEntry(index);
          const myBet = getMyBetOnEntry(index);
          const isSelected = selectedEntryIndex === index;
          
          return (
            <button
              key={index}
              onClick={() => setSelectedEntryIndex(index)}
              disabled={disabled}
              className={`
                w-full p-3 rounded-lg border-2 transition-all text-left
                ${isSelected ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{horse.name}</span>
                    {entry.is_nft_horse && (
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                        NFT
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600">
                    Owner: {entry.player_address.slice(0, 6)}...{entry.player_address.slice(-4)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Speed: {horse.speed} | Endurance: {horse.endurance}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {formatAPT(totalBets)}
                  </div>
                  {myBet > 0 && (
                    <div className="text-xs text-green-600 font-medium">
                      My: {formatAPT(myBet)}
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedEntryIndex !== null && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">
              Bet Amount (APT)
            </label>
            <input
              type="number"
              min="0.05"
              step="0.01"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              placeholder="Min: 0.05 APT"
            />
          </div>
          
          <div className="text-xs text-gray-600 space-y-1">
            <div>Selected: {raceState.horses[raceState.entries[selectedEntryIndex].horse_id]?.name}</div>
            <div>Current bet amount: {formatAPT(parseFloat(betAmount || '0') * 100000000)}</div>
          </div>
          
          <button
            onClick={handlePlaceBet}
            disabled={disabled || parseFloat(betAmount) < 0.05}
            className="w-full py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            Place Bet 💰
          </button>
        </div>
      )}

      {/* Betting Statistics */}
      {bets.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium mb-2">📊 Betting Activity</h3>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Total Bets:</span>
              <span>{bets.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Average Bet:</span>
              <span>
                {bets.length > 0 
                  ? formatAPT(raceState.total_bet_pool / bets.length)
                  : '0 APT'
                }
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}