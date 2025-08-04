import { useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import dynamic from 'next/dynamic';
import { RaceTrack } from '@/components/RaceTrack';
import { HorseSelection } from '@/components/HorseSelection';
import { NFTHorseSelection } from '@/components/NFTHorseSelection';
import { HorseStable } from '@/components/HorseStable';
import { BettingPanel } from '@/components/BettingPanel';
import { RaceControls } from '@/components/RaceControls';
import { EventLog } from '@/components/EventLog';
import { useRace } from '@/hooks/useRace';
import { PlayerHorseNFT } from '@/lib/equinox';

const WalletConnector = dynamic(
  () => import('@/components/WalletConnector').then((mod) => mod.WalletConnector),
  { ssr: false }
);

export default function Home() {
  const { account } = useWallet();
  const [raceAddress, setRaceAddress] = useState<string>('');
  const [inputAddress, setInputAddress] = useState<string>('');
  const [selectedHorseId, setSelectedHorseId] = useState<number | null>(null);
  const [selectedNFTHorse, setSelectedNFTHorse] = useState<PlayerHorseNFT | null>(null);
  const [activeTab, setActiveTab] = useState<'race' | 'stable'>('race');
  const [raceMode, setRaceMode] = useState<'classic' | 'nft'>('nft');
  
  const {
    raceState,
    bets,
    loading,
    error,
    lastMessage,
    createRace,
    joinRace,
    joinRaceWithNFT,
    placeBet,
    startRace,
    advanceRace,
    isPlayerInRace,
  } = useRace(raceAddress || null);

  const handleCreateRace = async () => {
    if (!account) return;
    const txHash = await createRace();
    if (txHash) {
      setRaceAddress(account.address.toString());
    }
  };

  const handleJoinRace = async () => {
    if (raceMode === 'classic' && selectedHorseId !== null) {
      await joinRace(selectedHorseId);
      setSelectedHorseId(null);
    } else if (raceMode === 'nft' && selectedNFTHorse) {
      await joinRaceWithNFT(selectedNFTHorse.id);
      setSelectedNFTHorse(null);
    }
  };

  const handleJoinExistingRace = () => {
    if (inputAddress) {
      setRaceAddress(inputAddress);
    }
  };

  const isCreator = raceState && account && raceState.entries.length > 0 && 
    raceState.entries[0].player_address === account.address.toString();

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <WalletConnector />
      
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-2">🐎 Equinox Racing</h1>
          <p className="text-lg text-gray-600">The Ultimate Blockchain Horse Racing Experience</p>
        </div>
        
        {!account ? (
          <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Welcome to Equinox! 🏇</h2>
            <p className="text-lg mb-6">Connect your wallet to start racing!</p>
            <div className="text-6xl mb-4">🐎</div>
          </div>
        ) : (
          <div>
            {/* Tab Navigation */}
            <div className="flex justify-center mb-6">
              <div className="bg-white rounded-lg shadow-md p-1 flex">
                <button
                  onClick={() => setActiveTab('race')}
                  className={`px-6 py-3 rounded-md font-medium transition-all ${
                    activeTab === 'race'
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  🏁 Racing
                </button>
                <button
                  onClick={() => setActiveTab('stable')}
                  className={`px-6 py-3 rounded-md font-medium transition-all ${
                    activeTab === 'stable'
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  🐎 Horse Stable
                </button>
              </div>
            </div>

            {/* Horse Stable Tab */}
            {activeTab === 'stable' && (
              <HorseStable />
            )}

            {/* Racing Tab */}
            {activeTab === 'race' && (
              <div>
                {!raceAddress ? (
                  <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
                    <h2 className="text-2xl font-bold mb-6">Start Racing! 🏁</h2>
                    
                    <div className="space-y-4">
                      <button
                        onClick={handleCreateRace}
                        disabled={loading}
                        className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 font-bold text-lg shadow-md transition-all"
                      >
                        {loading ? 'Creating...' : 'Create New Race 🐎'}
                      </button>
                      
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-3 bg-white text-gray-500">OR</span>
                        </div>
                      </div>
                      
                      <div>
                        <input
                          type="text"
                          placeholder="Enter existing race address..."
                          value={inputAddress}
                          onChange={(e) => setInputAddress(e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          onClick={handleJoinExistingRace}
                          disabled={!inputAddress || loading}
                          className="w-full mt-3 py-4 px-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 font-bold text-lg shadow-md transition-all"
                        >
                          Join Existing Race 🏇
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-4 bg-white rounded-lg shadow p-3">
                      <p className="text-sm text-gray-600">Race Address:</p>
                      <p className="font-mono text-xs break-all">{raceAddress}</p>
                    </div>
                    
                    {/* Race Mode Toggle */}
                    {raceState && !raceState.race_started && !isPlayerInRace() && (
                      <div className="mb-6 bg-white rounded-lg shadow-md p-4">
                        <h3 className="text-lg font-bold mb-3">Choose Race Mode</h3>
                        <div className="flex space-x-3">
                          <button
                            onClick={() => setRaceMode('nft')}
                            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                              raceMode === 'nft'
                                ? 'bg-purple-500 text-white shadow-md'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            🎯 NFT Horse Mode
                          </button>
                          <button
                            onClick={() => setRaceMode('classic')}
                            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                              raceMode === 'classic'
                                ? 'bg-orange-500 text-white shadow-md'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            🏇 Classic Mode
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">
                          {raceMode === 'nft' 
                            ? 'Use your own NFT horses to compete!' 
                            : 'Choose from pre-made horses.'}
                        </p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 space-y-6">
                        <RaceTrack raceState={raceState} />
                        
                        {raceState && !raceState.race_started && !isPlayerInRace() && (
                          <div>
                            {raceMode === 'nft' ? (
                              <NFTHorseSelection
                                onSelectHorse={setSelectedNFTHorse}
                                onJoinRace={handleJoinRace}
                                selectedHorse={selectedNFTHorse}
                                disabled={loading}
                              />
                            ) : (
                              <HorseSelection
                                raceState={raceState}
                                onSelectHorse={setSelectedHorseId}
                                selectedHorseId={selectedHorseId}
                                disabled={loading}
                              />
                            )}
                          </div>
                        )}
                        
                        <EventLog lastMessage={lastMessage} error={error} />
                      </div>
                      
                      <div className="space-y-6">
                        <RaceControls
                          raceState={raceState}
                          isCreator={!!isCreator}
                          isInRace={isPlayerInRace()}
                          loading={loading}
                          onCreateRace={handleCreateRace}
                          onJoinRace={handleJoinRace}
                          onStartRace={startRace}
                          onAdvanceRace={advanceRace}
                        />
                        
                        {raceState && !raceState.race_started && (
                          <BettingPanel
                            raceState={raceState}
                            bets={bets}
                            onPlaceBet={placeBet}
                            disabled={loading || raceState.race_started}
                            currentUserAddress={account?.address.toString()}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
