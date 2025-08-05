import { useState, useEffect, useCallback } from 'react';
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

  const refreshLobbyData = useCallback(async () => {
    try {
      const [races, quickMatch, history] = await Promise.all([
        fetchActiveRaces(),
        fetchQuickMatchStatus(),
        fetchRaceHistory(10),
      ]);
      setActiveRaces(races);
      setQuickMatchStatus(quickMatch);
      setRaceHistory(history);
      setError(null);
      setRateLimited(false);
    } catch (e: any) {
      console.error('Error refreshing lobby data:', e);
      if (e?.message?.includes('Rate limit')) {
        setError('API rate limit reached. Reducing refresh frequency...');
        setRateLimited(true);
        setTimeout(() => setRateLimited(false), 60000);
      }
    }
  }, []);

  const refreshRaceData = useCallback(async () => {
    if (!currentRaceId) return;
    try {
      const state = await fetchRaceState(currentRaceId);
      setRaceState(state);
      setError(null);
      setRateLimited(false);
    } catch (e: any) {
      console.error('Error refreshing race data:', e);
      if (e?.message?.includes('Rate limit')) {
        setError('API rate limit reached. Reducing refresh frequency...');
        setRateLimited(true);
        setTimeout(() => setRateLimited(false), 60000);
      }
    }
  }, [currentRaceId]);

  useEffect(() => {
    refreshLobbyData();
    const intervalTime = rateLimited ? 30000 : 15000;
    const interval = setInterval(refreshLobbyData, intervalTime);
    return () => clearInterval(interval);
  }, [rateLimited, refreshLobbyData]);

  useEffect(() => {
    if (currentRaceId) {
      refreshRaceData();
      const intervalTime = rateLimited ? 20000 : 8000;
      const interval = setInterval(refreshRaceData, intervalTime);
      return () => clearInterval(interval);
    }
  }, [currentRaceId, rateLimited, refreshRaceData]);

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
      await refreshLobbyData();
      if (currentRaceId) {
        await refreshRaceData();
      }
      return response.hash;
    } catch (e: any) {
      setError(`Transaction failed: ${e.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNormalRace = async () => {
    const txHash = await handleTransaction(
      transactions.createNormalRace(),
      "Normal race created! Entry fee: 0.1 APT"
    );
    if (txHash) {
      const races = await fetchActiveRaces();
      const latestRaceId = Math.max(...races);
      setCurrentRaceId(latestRaceId);
      setActiveTab('race');
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
      await handleTransaction(
        transactions.joinRaceWithHorse(raceId, selectedHorseId),
        `Joined race with ${raceState?.horses[selectedHorseId]?.name}!`
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
    await handleTransaction(
      transactions.placeBet(currentRaceId, entryIndex, amount * 100000000),
      `Bet placed: ${formatAPT(amount * 100000000)}`
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
      "Quick race auto-started! You earned gas reward."
    );
  };

  const handleAdvanceRace = async () => {
    if (!currentRaceId) return;
    await handleTransaction(
      transactions.advanceRace(currentRaceId),
      `Round ${(raceState?.current_round || 0) + 1} completed!`
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
      {/* Logo Area */}
      <div className="text-center py-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl text-white">
        <div className="h-20 flex items-center justify-center mb-4">
          <img 
            src="/images/logo/logo.webp" 
            alt="Equinox Racing Logo"
            className="h-16 w-auto object-contain"
            onError={(e) => {
              // 如果Logo图片加载失败，显示备用emoji
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <div className="hidden text-6xl">🏇</div>
        </div>
        <h1 className="text-5xl font-bold mb-4">Equinox Racing</h1>
        <p className="text-xl opacity-90">The Ultimate Blockchain Horse Racing Experience</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quick Match */}
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

        {/* Create Normal Race */}
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

      {/* Active Races */}
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
        {/* Race Header */}
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
            <RaceTrack raceState={raceState} onAdvanceRace={handleAdvanceRace} />
            
            {raceState && !raceState.race_started && !isPlayerInRace() && (
              <div>
                {/* Race Mode Toggle */}
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
            {/* Race Controls */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">🏁 Race Controls</h3>
              
              <div className="space-y-3">
                {raceState && !raceState.race_started && !isPlayerInRace() && (
                  <button
                    onClick={() => handleJoinRace(currentRaceId)}
                    disabled={loading || raceState.entries.length >= 6}
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
                
                {raceState && raceState.race_finished && (
                  <div className="text-center">
                    <p className="text-lg font-medium text-gray-600 mb-2">🏆 Race Completed!</p>
                    <p className="text-sm text-gray-500">Prizes distributed automatically</p>
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
            
            {raceState && !raceState.race_started && (
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
          {raceHistory.map((record, index) => (
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

            {/* Tab Content */}
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

// Race Card Component for Lobby
function RaceCard({ raceId, onJoin }: { raceId: number; onJoin: () => void }) {
  const [raceState, setRaceState] = useState<RaceState | null>(null);

  useEffect(() => {
    let mounted = true;
    const timeout = setTimeout(() => {
      if (mounted) {
        fetchRaceState(raceId).then(setRaceState);
      }
    }, Math.random() * 2000);
    return () => {
      mounted = false;
      clearTimeout(timeout);
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