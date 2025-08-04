import { Horse, RaceState } from '@/lib/equinox';

interface HorseSelectionProps {
  raceState: RaceState | null;
  onSelectHorse: (horseId: number) => void;
  selectedHorseId: number | null;
  disabled: boolean;
}

const HORSE_COLORS: Record<string, string> = {
  red: 'border-red-500 bg-red-50',
  blue: 'border-blue-500 bg-blue-50',
  green: 'border-green-500 bg-green-50',
  purple: 'border-purple-500 bg-purple-50',
  orange: 'border-orange-500 bg-orange-50',
  cyan: 'border-cyan-500 bg-cyan-50',
};

const TERRAIN_TYPES = ['🌱 Grass', '🏜️ Dirt', '🌐 All-weather'];

export function HorseSelection({ raceState, onSelectHorse, selectedHorseId, disabled }: HorseSelectionProps) {
  if (!raceState) return null;

  const isHorseTaken = (horseId: number) => {
    return raceState.entries.some(entry => entry.horse_id === horseId);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold mb-4">🐎 Select Your Horse</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {raceState.horses.map((horse) => {
          const taken = isHorseTaken(horse.id);
          const selected = selectedHorseId === horse.id;
          
          return (
            <button
              key={horse.id}
              onClick={() => !taken && !disabled && onSelectHorse(horse.id)}
              disabled={taken || disabled}
              className={`
                p-4 rounded-lg border-2 transition-all
                ${selected ? 'ring-2 ring-green-500' : ''}
                ${taken ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md cursor-pointer'}
                ${HORSE_COLORS[horse.color]}
              `}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg">{horse.name}</h3>
                <span className="text-2xl">🐎</span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Speed:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">{horse.speed}</span>
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-red-500 h-2 rounded-full"
                        style={{ width: `${(horse.speed / 70) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between">
                  <span>Endurance:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">{horse.endurance}</span>
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${(horse.endurance / 100) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between">
                  <span>Terrain:</span>
                  <span className="font-medium">{TERRAIN_TYPES[horse.terrain_type]}</span>
                </div>
              </div>
              
              {taken && (
                <div className="mt-2 text-xs text-red-600 font-semibold">
                  Already Taken
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}