import { useState } from 'react';
import { RaceState, Bet } from '@/lib/equinox';

interface BettingPanelProps {
  raceState: RaceState | null;
  bets: Bet[];
  onPlaceBet: (horseId: number, amount: number) => void;
  disabled: boolean;
  currentUserAddress?: string;
}

export function BettingPanel({ raceState, bets, onPlaceBet, disabled, currentUserAddress }: BettingPanelProps) {
  const [selectedHorse, setSelectedHorse] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState<string>('10');

  if (!raceState || raceState.entries.length === 0) return null;

  const handlePlaceBet = () => {
    if (selectedHorse !== null && betAmount) {
      const amount = parseInt(betAmount);
      if (amount >= 10) {
        onPlaceBet(selectedHorse, amount);
        setBetAmount('10');
        setSelectedHorse(null);
      }
    }
  };

  const getHorseBets = (horseId: number) => {
    return bets.filter(bet => bet.horse_id === horseId);
  };

  const getTotalBetsOnHorse = (horseId: number) => {
    return getHorseBets(horseId).reduce((sum, bet) => sum + bet.amount, 0);
  };

  const getMyBetOnHorse = (horseId: number) => {
    if (!currentUserAddress) return 0;
    const myBets = bets.filter(bet => 
      bet.horse_id === horseId && bet.player_address === currentUserAddress
    );
    return myBets.reduce((sum, bet) => sum + bet.amount, 0);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold mb-4">💰 Place Your Bets</h2>
      
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">Total Prize Pool: ${raceState.total_bet_pool}</p>
        <div className="grid grid-cols-3 gap-2 text-xs text-center">
          <div className="bg-yellow-100 p-2 rounded">🥇 50%</div>
          <div className="bg-gray-100 p-2 rounded">🥈 30%</div>
          <div className="bg-orange-100 p-2 rounded">🥉 20%</div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {raceState.entries.map((entry) => {
          const horse = raceState.horses.find(h => h.id === entry.horse_id);
          if (!horse) return null;
          
          const totalBets = getTotalBetsOnHorse(horse.id);
          const myBet = getMyBetOnHorse(horse.id);
          const isSelected = selectedHorse === horse.id;
          
          return (
            <button
              key={horse.id}
              onClick={() => setSelectedHorse(horse.id)}
              disabled={disabled}
              className={`
                w-full p-3 rounded-lg border-2 transition-all text-left
                ${isSelected ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">{horse.name}</span>
                  <span className="ml-2 text-xs text-gray-500">
                    (Total: ${totalBets})
                  </span>
                </div>
                {myBet > 0 && (
                  <span className="text-sm text-green-600 font-medium">
                    My bet: ${myBet}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedHorse !== null && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Bet Amount</label>
            <input
              type="number"
              min="10"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              placeholder="Min: 10"
            />
          </div>
          
          <button
            onClick={handlePlaceBet}
            disabled={disabled || parseInt(betAmount) < 10}
            className="w-full py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            Place Bet 💰
          </button>
        </div>
      )}
    </div>
  );
}