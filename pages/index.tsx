import { useState, useEffect } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import dynamic from 'next/dynamic';
import { 
  RaceState, 
  PlayerHorseNFT, 
  RaceHistory,
  QuickMatchStatus,
  fetchActiveRaces,
  fetchRaceState,
  fetchQuickMatchStatus,
  fetchRaceHistory,
  transactions,
  aptos,
  formatAPT,
  RACE_TYPE
} from '@/lib/equinox';

const WalletConnector = dynamic(
  () => import('@/components/WalletConnector').then((mod) => mod.WalletConnector),
  { ssr: false }
);

import { RaceTrack } from '@/components/RaceTrack';
import { HorseSelection } from '@/components/HorseSelection';
import { NFTHorseSelection } from '@/components/NFTHorseSelection';
import { HorseStable } from '@/components/HorseStable';
import { BettingPanel } from '@/components/BettingPanel';
import { EventLog } from '@/components/EventLog';

type TabType = 'lobby' | 'race' | 'stable' | 'history';

export default function Home() {
  const { account, signAndSubmitTransaction } = useWallet();
  
  const [activeTab, setActiveTab] = useState<TabType>('lobby');
  const [currentRaceId, setCurrentRaceId] = useState<number | null>(null);
  const [raceState, setRaceState] = useState<RaceState | null>(null);
  const [quickMatchStatus, setQuickMatchStatus] = useState<QuickMatchStatus | null>(null);
  const [raceHistory, setRaceHistory] = useState<RaceHistory[]>([]);
  const [activeRaces, setActiveRaces] = useState<number[]>([]);
  
  const [selectedHorseId, setSelectedHorseId] = useState<number | null>(null);
  const [selectedNFTHorse, setSelectedNFTHorse] = useState<PlayerHorseNFT | null>(null);
  const [raceMode, setRaceMode] = useState<'classic' | 'nft'>('nft');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<string>('');
  const [rateLimited, setRateLimited] = useState<boolean>(false);

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
      // Manually trigger a refresh after a transaction
      if (currentRaceId) {
        await fetchRaceState(currentRaceId).then(setRaceState);
      } else {
        await fetchActiveRaces().then(setActiveRaces);
        await fetchQuickMatchStatus().then(setQuickMatchStatus);
      }
      return response.hash;
    } catch (e: any) {
      setError(`Transaction failed: ${e.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Centralized data fetching and auto-advance logic
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const refreshLobbyData = async () => {
      try {
        const [races, quickMatch, history] = await Promise.all([
          fetchActiveRaces(),
          fetchQuickMatchStatus(),
          fetchRaceHistory(10),
        ]);
        setActiveRaces(races);
        setQuickMatchStatus(quickMatch);
        setRaceHistory(history);
        setRateLimited(false);
        setError(null);
      } catch (e: any) {
        if (e.message.includes('Rate limit')) {
          setRateLimited(true);
        }
        console.error('Error refreshing lobby data:', e);
      }
    };

    const refreshRaceData = async () => {
      if (!currentRaceId) return;
      try {
        const state = await fetchRaceState(currentRaceId);
        setRaceState(state);

        // Auto-advance logic removed - now handled by Python bot
        
        setRateLimited(false);
        setError(null);
      } catch (e: any) {
        if (e.message.includes('Rate limit')) {
          setRateLimited(true);
        }
        console.error('Error refreshing race data:', e);
      }
    };

    if (activeTab === 'race' && currentRaceId) {
      refreshRaceData(); // Initial fetch
      const intervalTime = rateLimited ? 20000 : 8000;
      interval = setInterval(refreshRaceData, intervalTime);
    } else {
      refreshLobbyData(); // Initial fetch
      const intervalTime = rateLimited ? 30000 : 15000;
      interval = setInterval(refreshLobbyData, intervalTime);
    }

    return () => clearInterval(interval);
  }, [activeTab, currentRaceId, rateLimited]);

  const handleCreateNormalRace = async () => {
    const txHash = await handleTransaction(
      transactions.createNormalRace(),
      "Normal race created! Entry fee: 0.1 APT"
    );
    if (txHash) {
      const races = await fetchActiveRaces();
      if (races.length > 0) {
        const latestRaceId = Math.max(...races);
        setCurrentRaceId(latestRaceId);
        setActiveTab('race');
      }
    }
  };

  const handleJoinQuickMatch = async () => {
    await handleTransaction(
      transactions.joinQuickMatch(),
      "Joined quick match! Entry fee: 0.1 APT"
    );
  };

  const handleJoinRace = async (raceId: number) => {
    if (raceMode === 'classic' && selectedHorseId !== null) {
      const horseName = raceState?.horses[selectedHorseId]?.name || 'selected horse';
      await handleTransaction(
        transactions.joinRaceWithHorse(raceId, selectedHorseId),
        `Joined race with ${horseName}!`
      );
      setSelectedHorseId(null);
    } else if (raceMode === 'nft' && selectedNFTHorse) {
      await handleTransaction(
        transactions.joinRaceWithNFT(raceId, selectedNFTHorse.id),
        `Joined race with ${selectedNFTHorse.name}!`
      );
      setSelectedNFTHorse(null);
    }
  };

  const handlePlaceBet = async (entryIndex: number, amount: number) => {
    if (!currentRaceId) return;
    const amountInOctas = Math.round(amount * 100000000);
    await handleTransaction(
      transactions.placeBet(currentRaceId, entryIndex, amountInOctas),
      `Bet placed: ${formatAPT(amountInOctas)}`
    );
  };

  const handleStartRace = async () => {
    if (!currentRaceId) return;
    await handleTransaction(
      transactions.startRace(currentRaceId),
      "Race started!"
    );
  };

  const handleExecuteQuickRace = async (raceId: number) => {
    await handleTransaction(
      transactions.executeQuickRace(raceId),
      "Quick race auto-started! You earned a gas reward."
    );
  };

  const handleAdvanceRace = async () => {
    if (!currentRaceId || loading) return;
    await handleTransaction(
      transactions.advanceRace(currentRaceId),
      `Round ${(raceState?.current_round || 0) + 1} advanced!`
    );
  };

  const isPlayerInRace = () => {
    if (!account || !raceState) return false;
    return raceState.entries.some(entry => entry.player_address === account.address.toString());
  };

  const isCreator = () => {
    return raceState && account && raceState.creator === account.address.toString();
  };

  const canExecuteQuickRace = () => {
    return raceState && 
           raceState.race_type === RACE_TYPE.QUICK && 
           !raceState.race_started &&
           raceState.start_time && 
           Date.now() >= raceState.start_time / 1000;
  };

  const renderLobby = () => (
    <div className="space-y-8">
      <div className="text-center py-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl text-white">
        <div className="h-20 flex items-center justify-center mb-4">
          <img 
            src="/images/logo/logo.webp" 
            alt="Equinox Racing Logo"
            className="h-16 w-auto object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <div className="hidden text-6xl">🏇</div>
        </div>
        <h1 className="text-5xl font-bold mb-4">Equinox Racing</h1>
        <p className="text-xl opacity-90">The Ultimate Blockchain Horse Racing Experience</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-green-600">⚡ Quick Match</h2>
          <p className="text-gray-600 mb-4">
            Jump into instant racing action! Auto-matched with other players.
          </p>
          <div className="space-y-3">
            <div className="text-sm text-gray-500">
              Players in queue: {quickMatchStatus?.waiting_players.length || 0}
            </div>
            {quickMatchStatus?.current_race_id && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 font-medium">
                  🔥 Quick race #{quickMatchStatus.current_race_id} is ready for betting!
                </p>
                <button
                  onClick={() => {
                    setCurrentRaceId(quickMatchStatus.current_race_id!);
                    setActiveTab('race');
                  }}
                  className="mt-2 text-sm bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                >
                  Join Race →
                </button>
              </div>
            )}
            <button
              onClick={handleJoinQuickMatch}
              disabled={loading}
              className="w-full py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 font-medium"
            >
              {loading ? 'Joining...' : 'Join Quick Match (0.1 APT)'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-blue-600">🏁 Create Race</h2>
          <p className="text-gray-600 mb-4">
            Create your own custom race room and invite friends to join.
          </p>
          <div className="space-y-3">
            <div className="text-sm text-gray-500">
              • Up to 6 players<br/>
              • Custom betting window<br/>
              • You control race start
            </div>
            <button
              onClick={handleCreateNormalRace}
              disabled={loading}
              className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 font-medium"
            >
              {loading ? 'Creating...' : 'Create Normal Race (0.1 APT)'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">🔥 Active Races</h2>
        {activeRaces.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No active races at the moment.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeRaces.map(raceId => (
              <RaceCard 
                key={raceId} 
                raceId={raceId} 
                onJoin={() => {
                  setCurrentRaceId(raceId);
                  setActiveTab('race');
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderRace = () => {
    if (!currentRaceId) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">No race selected.</p>
          <button
            onClick={() => setActiveTab('lobby')}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Back to Lobby
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">Race #{currentRaceId}</h2>
              <p className="text-gray-600">
                {raceState?.race_type === RACE_TYPE.QUICK ? 'Quick Match' : 'Normal Race'}
              </p>
            </div>
            <button
              onClick={() => {
                setCurrentRaceId(null);
                setRaceState(null);
                setActiveTab('lobby');
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              ← Back to Lobby
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <RaceTrack raceState={raceState} />
            
            {raceState && !raceState.race_started && !isPlayerInRace() && (
              <div>
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
                </div>

                {raceMode === 'nft' ? (
                  <NFTHorseSelection
                    onSelectHorse={setSelectedNFTHorse}
                    onJoinRace={() => handleJoinRace(currentRaceId)}
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
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">🏁 Race Controls</h3>
              
              <div className="space-y-3">
                {raceState && !raceState.race_started && !isPlayerInRace() && (
                  <button
                    onClick={() => handleJoinRace(currentRaceId)}
                    disabled={loading || (raceState.entries.length >= raceState.horses.length)}
                    className="w-full py-3 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 font-medium"
                  >
                    Join Race 🏇
                  </button>
                )}
                
                {raceState && !raceState.race_started && isCreator() && raceState.entries.length >= 2 && (
                  <button
                    onClick={handleStartRace}
                    disabled={loading}
                    className="w-full py-3 px-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 font-medium"
                  >
                    Start Race 🏁
                  </button>
                )}

                {raceState && canExecuteQuickRace() && (
                  <button
                    onClick={() => handleExecuteQuickRace(currentRaceId)}
                    disabled={loading}
                    className="w-full py-3 px-4 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 font-medium"
                  >
                    Execute Quick Race ⚡
                  </button>
                )}

                {raceState && raceState.race_started && !raceState.race_finished && (
                  <button
                    onClick={handleAdvanceRace}
                    disabled={loading}
                    className="w-full py-3 px-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 font-medium text-sm"
                    title="Manual advance for testing/backup purposes"
                  >
                    🔧 Manual Advance (Debug)
                  </button>
                )}
                
                {raceState && raceState.race_finished && (
                  <div className="text-center">
                    <p className="text-lg font-medium text-gray-600 mb-2">🏆 Race Completed!</p>
                    <p className="text-sm text-gray-500">Prizes have been distributed.</p>
                  </div>
                )}
              </div>
              
              {raceState && (
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Players:</span>
                    <span className="font-medium">{raceState.entries.length} / 6</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Entry Pool:</span>
                    <span className="font-medium">{formatAPT(raceState.entry_fee_pool)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Bet Pool:</span>
                    <span className="font-medium">{formatAPT(raceState.total_bet_pool)}</span>
                  </div>
                </div>
              )}
            </div>
            
            {raceState && (
              <BettingPanel
                raceState={raceState}
                bets={[]}
                onPlaceBet={handlePlaceBet}
                disabled={loading || raceState.race_started}
                currentUserAddress={account?.address.toString()}
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderHistory = () => (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6">📊 Race History</h2>
      {raceHistory.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No race history yet.</p>
      ) : (
        <div className="space-y-4">
          {raceHistory.map((record) => (
            <div key={record.race_id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold">Race #{record.race_id}</h3>
                  <p className="text-green-600 font-medium">
                    🏆 Winner: {record.winner_horse_name}
                  </p>
                  <p className="text-sm text-gray-600">
                    {record.participants} participants • {formatAPT(record.total_prize)} total prize
                  </p>
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(record.finish_time / 1000).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <WalletConnector />
      
      <div className="container mx-auto px-4 py-8">
        {!account ? (
          <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
            {/* Background decorative elements */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
              <div className="absolute top-20 left-10 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
              <div className="absolute bottom-20 right-10 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse animation-delay-4000"></div>
            </div>
            
            {/* Floating horse icons */}
            <div className="absolute top-16 left-16 text-4xl animate-bounce animation-delay-1000 opacity-30">🐎</div>
            <div className="absolute top-32 right-24 text-3xl animate-bounce animation-delay-2000 opacity-25">🏇</div>
            <div className="absolute bottom-24 left-32 text-3xl animate-bounce animation-delay-3000 opacity-20">🏆</div>
            <div className="absolute bottom-16 right-16 text-4xl animate-bounce animation-delay-4000 opacity-30">⚡</div>
            
            {/* Main content */}
            <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
              {/* Logo section */}
              <div className="mb-8 flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-white rounded-full opacity-20 blur-xl scale-110"></div>
                  <div className="relative bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                    <img 
                      src="/images/logo/logo.webp" 
                      alt="Equinox Racing Logo"
                      className="h-24 w-auto object-contain mx-auto animate-pulse"
                      onError={(e: any) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden text-8xl opacity-80">🏇</div>
                  </div>
                </div>
              </div>
              
              {/* Title section */}
              <div className="mb-12">
                <h1 className="text-6xl md:text-7xl font-bold text-white mb-6 tracking-tight">
                  <span className="bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
                    Equinox
                  </span>
                  <br />
                  <span className="text-white/90">Racing</span>
                </h1>
                <p className="text-xl md:text-2xl text-white/80 mb-4 font-light">
                  The Ultimate Blockchain Horse Racing Experience
                </p>
                <div className="flex justify-center items-center space-x-2 text-white/60">
                  <span className="h-px bg-white/30 w-12"></span>
                  <span className="text-sm uppercase tracking-widest">Web3 Gaming</span>
                  <span className="h-px bg-white/30 w-12"></span>
                </div>
              </div>
              
              {/* Welcome message */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 mb-8">
                <h2 className="text-3xl font-bold text-white mb-4">Ready to Race? 🏁</h2>
                <p className="text-lg text-white/80 mb-6 leading-relaxed">
                  Connect your wallet to enter the thrilling world of blockchain horse racing.
                  <br />
                  Compete with players worldwide and win real rewards!
                </p>
                
                {/* Features preview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="text-2xl mb-2">⚡</div>
                    <h3 className="text-white font-semibold mb-1">Quick Match</h3>
                    <p className="text-white/60 text-sm">Instant racing action</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="text-2xl mb-2">🎯</div>
                    <h3 className="text-white font-semibold mb-1">NFT Horses</h3>
                    <p className="text-white/60 text-sm">Unique racing companions</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="text-2xl mb-2">💰</div>
                    <h3 className="text-white font-semibold mb-1">Real Rewards</h3>
                    <p className="text-white/60 text-sm">Win APT tokens</p>
                  </div>
                </div>
              </div>
              
              {/* Call to action */}
              <div className="text-white/60 text-sm">
                <p className="flex items-center justify-center space-x-2">
                  <span>↑</span>
                  <span>Connect your wallet above to begin</span>
                  <span>↑</span>
                </p>
              </div>
            </div>
            
            {/* Animated racing track line */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-50">
              <div className="h-full bg-gradient-to-r from-transparent via-white to-transparent animate-pulse"></div>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex justify-center mb-6">
              <div className="bg-white rounded-lg shadow-md p-1 flex">
                {(['lobby', 'race', 'stable', 'history'] as TabType[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-6 py-3 rounded-md font-medium transition-all capitalize ${
                      activeTab === tab
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    {tab === 'lobby' && '🏛️'} 
                    {tab === 'race' && '🏁'} 
                    {tab === 'stable' && '🐎'} 
                    {tab === 'history' && '📊'} 
                    {' '}
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'lobby' && renderLobby()}
            {activeTab === 'race' && renderRace()}
            {activeTab === 'stable' && <HorseStable />}
            {activeTab === 'history' && renderHistory()}
          </div>
        )}
      </div>
    </div>
  );
}

function RaceCard({ raceId, onJoin }: { raceId: number; onJoin: () => void }) {
  const [raceState, setRaceState] = useState<RaceState | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchState = async () => {
      try {
        const state = await fetchRaceState(raceId);
        if (isMounted) {
          setRaceState(state);
        }
      } catch (error) {
        console.error(`Failed to fetch state for race ${raceId}`, error);
      }
    };
    
    fetchState();

    return () => {
      isMounted = false;
    };
  }, [raceId]);

  if (!raceState) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded mb-2"></div>
        <div className="h-3 bg-gray-200 rounded mb-4"></div>
        <div className="h-8 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-bold">Race #{raceId}</h3>
        <span className={`text-xs px-2 py-1 rounded ${
          raceState.race_type === RACE_TYPE.QUICK 
            ? 'bg-green-100 text-green-800' 
            : 'bg-blue-100 text-blue-800'
        }`}>
          {raceState.race_type === RACE_TYPE.QUICK ? 'Quick' : 'Normal'}
        </span>
      </div>
      
      <div className="space-y-2 text-sm mb-4">
        <div className="flex justify-between">
          <span>Players:</span>
          <span>{raceState.entries.length} / 6</span>
        </div>
        <div className="flex justify-between">
          <span>Total Pool:</span>
          <span>{formatAPT(raceState.entry_fee_pool + raceState.total_bet_pool)}</span>
        </div>
        <div className="flex justify-between">
          <span>Status:</span>
          <span className={raceState.race_started ? 'text-green-600' : 'text-orange-600'}>
            {raceState.race_started ? 'Racing' : 'Waiting'}
          </span>
        </div>
      </div>
      
      <button
        onClick={onJoin}
        className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
      >
        {raceState.race_started ? 'Spectate' : 'Join'}
      </button>
    </div>
  );
}