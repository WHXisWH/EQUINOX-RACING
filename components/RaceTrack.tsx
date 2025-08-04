import { RaceState, Horse, RaceEntry } from '@/lib/equinox';

interface RaceTrackProps {
  raceState: RaceState | null;
}

const HORSE_COLORS: Record<string, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  cyan: 'bg-cyan-500',
};

const TERRAIN_NAMES = ['Grass', 'Dirt'];
const WEATHER_NAMES = ['☀️ Sunny', '🌧️ Rainy'];

export function RaceTrack({ raceState }: RaceTrackProps) {
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

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-2xl font-bold">🏇 Race Track</h2>
        <div className="flex gap-4 text-sm">
          <span className="px-3 py-1 bg-green-100 rounded">
            {TERRAIN_NAMES[raceState.track.terrain]}
          </span>
          <span className="px-3 py-1 bg-blue-100 rounded">
            {WEATHER_NAMES[raceState.track.weather]}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Start 🏁</span>
          <span>Finish 🏆</span>
        </div>
        
        <div className="space-y-3">
          {raceState.entries.map((entry, index) => {
            const horse = getHorseByEntry(entry);
            if (!horse) return null;
            
            const progress = getHorseProgress(entry);
            const isFinished = entry.is_finished;
            
            return (
              <div key={index} className="relative">
                <div className="flex items-center mb-1">
                  <span className="text-sm font-medium w-32">{horse.name}</span>
                  {isFinished && (
                    <span className="ml-2 text-xs font-bold text-yellow-600">
                      #{entry.final_rank} 🏆
                    </span>
                  )}
                </div>
                
                <div className="relative h-12 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`absolute h-full ${HORSE_COLORS[horse.color]} transition-all duration-500`}
                    style={{ width: `${progress}%` }}
                  />
                  
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 transition-all duration-500 pixel-horse"
                    style={{ left: `calc(${progress}% - 20px)` }}
                  >
                    🐎
                  </div>
                </div>
                
                <div className="flex justify-between mt-1 text-xs text-gray-500">
                  <span>Energy: {entry.energy}%</span>
                  <span>{entry.position}m / {raceState.track.length}m</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {raceState.race_started && !raceState.race_finished && (
        <div className="mt-4 text-center">
          <p className="text-lg font-semibold text-green-600">
            Round {raceState.current_round} - Race in Progress! 🏁
          </p>
        </div>
      )}

      {raceState.race_finished && (
        <div className="mt-4 p-4 bg-yellow-50 rounded-lg text-center">
          <p className="text-xl font-bold text-yellow-800">
            🏆 Race Finished! 🏆
          </p>
          <p className="text-sm text-yellow-600 mt-2">
            Prize Pool: ${raceState.total_bet_pool}
          </p>
        </div>
      )}
    </div>
  );
}