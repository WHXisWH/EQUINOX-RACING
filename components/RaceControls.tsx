import { RaceState } from '@/lib/equinox';

interface RaceControlsProps {
  raceState: RaceState | null;
  isCreator: boolean;
  isInRace: boolean;
  loading: boolean;
  onCreateRace: () => void;
  onJoinRace: () => void;
  onStartRace: () => void;
  onAdvanceRace: () => void;
}

export function RaceControls({
  raceState,
  isCreator,
  isInRace,
  loading,
  onCreateRace,
  onJoinRace,
  onStartRace,
  onAdvanceRace,
}: RaceControlsProps) {
  if (!raceState) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold mb-4">🏁 Race Controls</h2>
        <button
          onClick={onCreateRace}
          disabled={loading}
          className="w-full py-3 px-4 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
        >
          {loading ? 'Creating...' : 'Create New Race 🐎'}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold mb-4">🏁 Race Controls</h2>
      
      <div className="space-y-3">
        {!raceState.race_started && !isInRace && (
          <button
            onClick={onJoinRace}
            disabled={loading || raceState.entries.length >= 6}
            className="w-full py-3 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            Join Race 🏇
          </button>
        )}
        
        {!raceState.race_started && isCreator && raceState.entries.length >= 2 && (
          <button
            onClick={onStartRace}
            disabled={loading}
            className="w-full py-3 px-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            Start Race 🏁
          </button>
        )}
        
        {raceState.race_started && !raceState.race_finished && (
          <button
            onClick={onAdvanceRace}
            disabled={loading}
            className="w-full py-3 px-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            Next Round ⏭️
          </button>
        )}
        
        {raceState.race_finished && (
          <div className="text-center">
            <p className="text-lg font-medium text-gray-600">Race Completed! 🏆</p>
            <button
              onClick={onCreateRace}
              disabled={loading}
              className="mt-3 w-full py-3 px-4 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              Create New Race 🐎
            </button>
          </div>
        )}
      </div>
      
      <div className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Players:</span>
          <span className="font-medium">{raceState.entries.length} / 6</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Status:</span>
          <span className="font-medium">
            {raceState.race_finished ? 'Finished' : 
             raceState.race_started ? 'In Progress' : 'Waiting'}
          </span>
        </div>
      </div>
    </div>
  );
}