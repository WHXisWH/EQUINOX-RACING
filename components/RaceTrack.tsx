import { useState, useEffect } from 'react';
import { RaceState, Horse, RaceEntry, TERRAIN_NAMES, WEATHER_NAMES } from '@/lib/equinox';

interface RaceTrackProps {
  raceState: RaceState | null;
  onAdvanceRace?: () => void;
}

const HORSE_COLORS: Record<string, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  cyan: 'bg-cyan-500',
};

const HORSE_EMOJIS = ['🐎', '🏇', '🐴', '🎠'];

// Quick Race Countdown Component
function QuickRaceCountdown({ bettingEndTime }: { bettingEndTime: number }) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const left = Math.max(0, Math.ceil((bettingEndTime / 1000 - now) / 1000));
      setTimeLeft(left);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [bettingEndTime]);

  if (timeLeft <= 0) {
    return (
      <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg text-center">
        <p className="text-red-800 font-medium">
          ⚡ Betting window closed! Race can now be started.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 p-3 bg-orange-100 border border-orange-300 rounded-lg text-center">
      <p className="text-orange-800 font-medium">
        ⏱️ Betting ends in: {timeLeft} seconds
      </p>
      <div className="mt-2 w-full bg-orange-200 rounded-full h-2">
        <div 
          className="bg-orange-500 h-2 rounded-full transition-all duration-1000"
          style={{ width: `${Math.max(0, (timeLeft / 30) * 100)}%` }}
        ></div>
      </div>
    </div>
  );
}

export function RaceTrack({ raceState, onAdvanceRace }: RaceTrackProps) {
  const [animatingHorses, setAnimatingHorses] = useState<Set<number>>(new Set());
  const [currentHorseEmoji, setCurrentHorseEmoji] = useState<Record<number, string>>({});

  // 自动推进比赛
  useEffect(() => {
    if (raceState?.race_started && !raceState?.race_finished && onAdvanceRace) {
      const interval = setInterval(() => {
        onAdvanceRace();
      }, 3000); // 每3秒自动推进一轮
      
      return () => clearInterval(interval);
    }
  }, [raceState?.race_started, raceState?.race_finished, onAdvanceRace]);

  // 马匹移动时的动画效果
  useEffect(() => {
    if (raceState?.race_started && !raceState?.race_finished) {
      // 触发所有马匹的跑步动画
      const horseIds = raceState.entries.map((_, index) => index);
      setAnimatingHorses(new Set(horseIds));
      
      // 随机切换马匹表情
      const newEmojis: Record<number, string> = {};
      horseIds.forEach(id => {
        newEmojis[id] = HORSE_EMOJIS[Math.floor(Math.random() * HORSE_EMOJIS.length)];
      });
      setCurrentHorseEmoji(newEmojis);
      
      // 动画持续2秒
      const timeout = setTimeout(() => {
        setAnimatingHorses(new Set());
      }, 2000);
      
      return () => clearTimeout(timeout);
    }
  }, [raceState?.current_round]);

  if (!raceState) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
        <p className="text-xl text-gray-600">Waiting for race to be created...</p>
      </div>
    );
  }

  const getHorseProgress = (entry: RaceEntry) => {
    return Math.min((entry.position / raceState.track.length) * 100, 100);
  };

  const getHorseByEntry = (entry: RaceEntry): Horse | undefined => {
    return raceState.horses.find(h => h.id === entry.horse_id);
  };

  const getHorseImage = (horse: Horse) => {
    return `/images/horses/horse-${horse.color}.webp`;
  };

  const getTrackBackground = () => {
    const terrainType = raceState.track.terrain === 0 ? 'grass' : 'dirt';
    return `/images/terrain/${terrainType}.webp`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-2xl font-bold">🏇 Race Track</h2>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2 px-3 py-1 bg-green-100 rounded">
            <div className="w-4 h-4 bg-gray-300 rounded flex items-center justify-center text-xs">
              🌱
            </div>
            <span>{TERRAIN_NAMES[raceState.track.terrain]}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 rounded">
            <div className="w-4 h-4 bg-gray-300 rounded flex items-center justify-center text-xs">
              {raceState.track.weather === 0 ? '☀️' : '🌧️'}
            </div>
            <span>{WEATHER_NAMES[raceState.track.weather]}</span>
          </div>
        </div>
      </div>

      {/* 自动比赛状态提示 */}
      {raceState.race_started && !raceState.race_finished && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-blue-800">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="font-medium">🏁 Race is running automatically...</span>
            <div className="ml-auto text-sm">Round {raceState.current_round}</div>
          </div>
        </div>
      )}

      {/* 赛道区域 */}
      <div 
        className="mb-4 relative bg-cover bg-center rounded-lg overflow-hidden"
        style={{
          backgroundImage: `url(${getTrackBackground()})`,
          backgroundColor: '#f3f4f6',
        }}
      >
        <div className="bg-gradient-to-r from-green-100/80 to-yellow-100/80 p-4">
          <div className="flex justify-between text-sm text-gray-700 mb-2">
            <span className="font-medium">Start 🏁</span>
            <span className="font-medium">Finish 🏆</span>
          </div>
          
          <div className="space-y-3">
            {raceState.entries.map((entry, index) => {
              const horse = getHorseByEntry(entry);
              if (!horse) return null;
              
              const progress = getHorseProgress(entry);
              const isFinished = entry.is_finished;
              const isAnimating = animatingHorses.has(index);
              const horseEmoji = currentHorseEmoji[index] || '🐎';
              
              return (
                <div key={index} className="relative">
                  <div className="flex items-center mb-1">
                    <div className="flex items-center gap-2 w-48">
                      <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
                        <img 
                          src={getHorseImage(horse)} 
                          alt={horse.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                        <span className="hidden text-lg">{horseEmoji}</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium">{horse.name}</span>
                        {entry.is_nft_horse && (
                          <span className="ml-1 text-xs bg-purple-100 text-purple-800 px-1 rounded">
                            NFT
                          </span>
                        )}
                      </div>
                    </div>
                    {isFinished && (
                      <span className="ml-2 text-xs font-bold text-yellow-600 animate-bounce">
                        #{entry.final_rank} 🏆
                      </span>
                    )}
                  </div>
                  
                  <div className="relative h-12 bg-white/70 rounded-full overflow-hidden border-2 border-gray-300">
                    {/* 进度条背景 */}
                    <div 
                      className={`absolute h-full ${HORSE_COLORS[horse.color]} transition-all duration-1000 opacity-30`}
                      style={{ width: `${progress}%` }}
                    />
                    
                    {/* 跑道标记线 */}
                    <div className="absolute inset-0 flex">
                      {[...Array(10)].map((_, i) => (
                        <div 
                          key={i} 
                          className="flex-1 border-r border-gray-300/50 last:border-r-0"
                        />
                      ))}
                    </div>
                    
                    {/* 马匹位置指示器 */}
                    <div 
                      className={`absolute top-1/2 -translate-y-1/2 transition-all duration-1000 z-10 ${
                        isAnimating ? 'animate-bounce' : ''
                      }`}
                      style={{ left: `calc(${progress}% - 20px)` }}
                    >
                      <div className={`w-8 h-8 rounded-full bg-white border-2 border-gray-400 flex items-center justify-center shadow-md ${
                        isAnimating ? 'animate-pulse' : ''
                      }`}>
                        <img 
                          src={getHorseImage(horse)} 
                          alt={horse.name}
                          className={`w-6 h-6 object-cover rounded-full ${
                            isAnimating ? 'animate-spin' : ''
                          }`}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                        <span className={`hidden text-lg ${
                          isAnimating ? 'animate-bounce' : ''
                        }`}>
                          {horseEmoji}
                        </span>
                      </div>
                      
                      {/* 奔跑特效 */}
                      {isAnimating && !isFinished && (
                        <div className="absolute -right-2 top-1/2 -translate-y-1/2">
                          <div className="flex gap-1">
                            <div className="w-1 h-1 bg-amber-600 rounded-full animate-ping"></div>
                            <div className="w-1 h-1 bg-amber-600 rounded-full animate-ping" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-1 h-1 bg-amber-600 rounded-full animate-ping" style={{animationDelay: '0.2s'}}></div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 终点线 */}
                    <div className="absolute right-0 top-0 h-full w-2 bg-gradient-to-b from-yellow-400 via-yellow-500 to-yellow-400 flex flex-col justify-center">
                      <div className="h-1 bg-red-500 mx-auto w-full"></div>
                      <div className="h-1 bg-white mx-auto w-full"></div>
                      <div className="h-1 bg-red-500 mx-auto w-full"></div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between mt-1 text-xs text-gray-600">
                    <span className={`${entry.energy < 30 ? 'text-red-500 font-bold' : ''}`}>
                      Energy: {entry.energy}%
                    </span>
                    <span>{entry.position}m / {raceState.track.length}m</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Race Status */}
      {raceState.race_started && !raceState.race_finished && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <p className="font-semibold">
              Round {raceState.current_round} - Race in Progress! 🏁
            </p>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Next round in 3 seconds... ⏱️
          </p>
        </div>
      )}

      {raceState.race_finished && (
        <div className="mt-4 p-4 bg-gradient-to-r from-yellow-100 to-orange-100 rounded-lg text-center border-2 border-yellow-300">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-2xl animate-bounce">🏆</span>
            <p className="text-xl font-bold text-yellow-800">Race Finished!</p>
            <span className="text-2xl animate-bounce" style={{animationDelay: '0.3s'}}>🏆</span>
          </div>
          
          {/* Winner Display */}
          {raceState.entries.filter(e => e.final_rank === 1).map(winner => {
            const winnerHorse = getHorseByEntry(winner);
            return winnerHorse ? (
              <div key={winner.player_address} className="mb-2">
                <p className="text-lg font-medium text-yellow-700 animate-pulse">
                  🥇 Winner: {winnerHorse.name}
                </p>
                <p className="text-sm text-yellow-600">
                  Rider: {winner.player_address.slice(0, 8)}...
                </p>
              </div>
            ) : null;
          })}
          
          <p className="text-sm text-yellow-600 mt-2">
            Total Prize Pool: {((raceState.entry_fee_pool + raceState.total_bet_pool) / 100000000).toFixed(4)} APT
          </p>
        </div>
      )}

      {/* Betting Window Countdown for Quick Races */}
      {raceState.race_type === 1 && !raceState.race_started && raceState.betting_end_time && (
        <QuickRaceCountdown bettingEndTime={raceState.betting_end_time} />
      )}
    </div>
  );
}