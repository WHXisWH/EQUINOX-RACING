import { useState } from 'react';
import { PlayerHorseNFT } from '@/lib/equinox';
import { usePlayerHorses } from '@/hooks/usePlayerHorses';

interface HorseStableProps {
  onSelectHorse?: (horse: PlayerHorseNFT) => void;
  selectedHorseId?: number | null;
  showMintForm?: boolean;
}

export function HorseStable({ onSelectHorse, selectedHorseId, showMintForm = true }: HorseStableProps) {
  const { horses, loading, error, mintHorse, getTerrainTypeName } = usePlayerHorses();
  
  const [showMintModal, setShowMintModal] = useState(false);
  const [mintForm, setMintForm] = useState({
    name: '',
    speed: 50,
    endurance: 50,
    terrainType: 0,
    color: 'red',
  });

  const handleMintHorse = async () => {
    if (!mintForm.name.trim()) {
      alert('Please enter a horse name');
      return;
    }
    
    const success = await mintHorse(
      mintForm.name,
      mintForm.speed,
      mintForm.endurance,
      mintForm.terrainType,
      mintForm.color
    );
    
    if (success) {
      setShowMintModal(false);
      setMintForm({
        name: '',
        speed: 50,
        endurance: 50,
        terrainType: 0,
        color: 'red',
      });
    }
  };

  const colors = ['red', 'blue', 'green', 'purple', 'orange', 'cyan'];

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-lg">Loading your horses...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">🐎 Your Horse Stable</h2>
        {showMintForm && (
          <button
            onClick={() => setShowMintModal(true)}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            Mint New Horse
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {horses.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🏇</div>
          <p className="text-gray-600 mb-4">You don&apos;t have any horses yet!</p>
          {showMintForm && (
            <button
              onClick={() => setShowMintModal(true)}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Mint Your First Horse
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {horses.map((horse) => (
            <div
              key={horse.id}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                selectedHorseId === horse.id
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-300 hover:border-gray-400 hover:shadow-sm'
              }`}
              onClick={() => onSelectHorse?.(horse)}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-lg">{horse.name}</h3>
                <div className={`w-6 h-6 rounded-full bg-${horse.color}-500`}></div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Speed:</span>
                  <span className="font-medium">{horse.speed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Endurance:</span>
                  <span className="font-medium">{horse.endurance}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Terrain:</span>
                  <span className="font-medium">{getTerrainTypeName(horse.terrain_type)}</span>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-500">
                  Horse #{horse.id}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mint Horse Modal */}
      {showMintModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Mint New Horse</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Horse Name</label>
                <input
                  type="text"
                  value={mintForm.name}
                  onChange={(e) => setMintForm({ ...mintForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter horse name..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Speed: {mintForm.speed}</label>
                <input
                  type="range"
                  min="30"
                  max="80"
                  value={mintForm.speed}
                  onChange={(e) => setMintForm({ ...mintForm, speed: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Endurance: {mintForm.endurance}</label>
                <input
                  type="range"
                  min="30"
                  max="80"
                  value={mintForm.endurance}
                  onChange={(e) => setMintForm({ ...mintForm, endurance: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Terrain Preference</label>
                <select
                  value={mintForm.terrainType}
                  onChange={(e) => setMintForm({ ...mintForm, terrainType: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={0}>Grass</option>
                  <option value={1}>Dirt</option>
                  <option value={2}>All-weather</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Color</label>
                <select
                  value={mintForm.color}
                  onChange={(e) => setMintForm({ ...mintForm, color: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {colors.map(color => (
                    <option key={color} value={color}>
                      {color.charAt(0).toUpperCase() + color.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowMintModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMintHorse}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
              >
                {loading ? 'Minting...' : 'Mint Horse'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}