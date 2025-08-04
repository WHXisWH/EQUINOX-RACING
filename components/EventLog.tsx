interface EventLogProps {
  lastMessage: string;
  error: string | null;
}

export function EventLog({ lastMessage, error }: EventLogProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
      <h2 className="text-xl font-bold mb-4">📢 Event Log</h2>
      <div className="h-48 bg-gray-50 rounded-lg p-4 overflow-y-auto font-mono text-sm space-y-2">
        {error && (
          <div className="text-red-500 p-2 bg-red-50 rounded">
            <span className="font-bold">Error:</span> {error}
          </div>
        )}
        {lastMessage && (
           <div className="text-gray-800 p-2">
             <span className="text-blue-500 font-semibold">&gt;</span> {lastMessage}
           </div>
        )}
         {!lastMessage && !error && (
          <div className="text-gray-400">Waiting for events...</div>
        )}
      </div>
    </div>
  );
}
