import { useState } from 'react';
import { PlayerHorseNFT } from '@/lib/equinox';
import { usePlayerHorses } from '@/hooks/usePlayerHorses';

interface NFTHorseSelectionProps {
  onSelectHorse: (horse: PlayerHorseNFT) => void;
  onJoinRace: () => void;
  selectedHorse: PlayerHorseNFT | null;
  disabled?: boolean;
}

export function NFTHorseSelection({ 
  onSelectHorse, 
  onJoinRace, 
  selectedHorse, 
  disabled = false 
}: NFTHorseSelectionProps) {
  const { horses, loading, error, getTerrainTypeName } = usePlayerHorses();

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4">Select Your Horse</h3>
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-600">Loading your horses...</div>
        </div>
      </div>
    );
  }

  if (horses.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4">Select Your Horse</h3>
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🏇</div>
          <p className="text-gray-600 mb-4">You need to mint a horse first!</p>
          <p className="text-sm text-gray-500">Go to the Horse Stable to mint your first horse NFT.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold mb-4">🐎 Select Your Horse for Racing</h3>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {horses.map((horse) => (
          <div
            key={horse.id}
            className={`border rounded-lg p-4 cursor-pointer transition-all ${
              selectedHorse?.id === horse.id
                ? 'border-blue-500 bg-blue-50 shadow-md'
                : 'border-gray-300 hover:border-gray-400 hover:shadow-sm'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => !disabled && onSelectHorse(horse)}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-lg">{horse.name}</h4>
              <div className={`w-6 h-6 rounded-full bg-${horse.color}-500`}></div>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Speed:</span>
                <div className="flex items-center">
                  <span className="font-medium mr-2">{horse.speed}</span>
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-red-500 h-2 rounded-full"
                      style={{ width: `${(horse.speed / 80) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Endurance:</span>
                <div className="flex items-center">
                  <span className="font-medium mr-2">{horse.endurance}</span>
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${(horse.endurance / 80) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Terrain:</span>
                <span className="font-medium">{getTerrainTypeName(horse.terrain_type)}</span>
              </div>
            </div>
            
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-500">
                NFT Horse #{horse.id}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedHorse && (
        <div className="border-t pt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h4 className="font-bold text-blue-800 mb-2">Selected Horse: {selectedHorse.name}</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="font-medium text-blue-700">Speed</div>
                <div className="text-lg font-bold text-blue-800">{selectedHorse.speed}</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-blue-700">Endurance</div>
                <div className="text-lg font-bold text-blue-800">{selectedHorse.endurance}</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-blue-700">Terrain</div>
                <div className="text-sm font-bold text-blue-800">
                  {getTerrainTypeName(selectedHorse.terrain_type)}
                </div>
              </div>
            </div>
          </div>
          
          <button
            onClick={onJoinRace}
            disabled={disabled}
            className="w-full py-3 px-6 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 font-bold text-lg shadow-md transition-all"
          >
            {disabled ? 'Joining...' : `Join Race with ${selectedHorse.name}`}
          </button>
        </div>
      )}
    </div>
  );
}