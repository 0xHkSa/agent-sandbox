interface SpotCardProps {
  spot: {
    name: string;
    location: string;
    image: string;
    description: string;
  };
}

export default function SpotCard({ spot }: SpotCardProps) {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 cursor-pointer group">
      <div className="h-40 bg-gradient-to-br from-gray-800 to-gray-600 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
        <span className="text-6xl">{spot.image}</span>
      </div>
      <div className="p-5">
        <h4 className="text-xl font-bold text-gray-900 mb-1">{spot.name}</h4>
        <p className="text-sm text-gray-500 mb-3">{spot.location}</p>
        <p className="text-gray-600 text-sm">{spot.description}</p>
        
        <div className="mt-4 flex items-center justify-between text-sm">
          <button className="text-blue-600 hover:text-blue-700 font-medium">
            View Details →
          </button>
          <div className="flex space-x-2">
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              Live Data
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

