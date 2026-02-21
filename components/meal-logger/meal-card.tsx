import type { ReactNode } from 'react';
import { format } from 'date-fns';
import { Trash2, Flame, Beef, Wheat, Droplet } from 'lucide-react';
import type { UIMeal } from '../../lib/meal-types';

interface MealCardProps {
  meal: UIMeal;
  onDelete: (id: string) => void;
}

export function MealCard({ meal, onDelete }: MealCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3 gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-gray-900 font-medium truncate">{meal.description}</p>
          <p className="text-sm text-gray-500 mt-1">{format(meal.timestamp, 'h:mm a')}</p>
        </div>
        <button
          onClick={() => onDelete(meal.id)}
          className="text-gray-400 hover:text-red-600 transition-colors p-1"
          title="Delete meal"
          aria-label="Delete meal"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricBox icon={<Flame className="w-4 h-4 text-orange-600" />} bg="bg-orange-50" label="Calories" value={`${meal.calories}`} />
        <MetricBox icon={<Beef className="w-4 h-4 text-red-600" />} bg="bg-red-50" label="Protein" value={`${meal.protein}g`} />
        <MetricBox icon={<Wheat className="w-4 h-4 text-yellow-600" />} bg="bg-yellow-50" label="Carbs" value={`${meal.carbs}g`} />
        <MetricBox icon={<Droplet className="w-4 h-4 text-blue-600" />} bg="bg-blue-50" label="Fat" value={`${meal.fat}g`} />
      </div>
    </div>
  );
}

function MetricBox({
  icon,
  bg,
  label,
  value,
}: {
  icon: ReactNode;
  bg: string;
  label: string;
  value: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${bg} rounded-lg p-2`}>
      {icon}
      <div>
        <p className="text-xs text-gray-600">{label}</p>
        <p className="text-sm font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
}
