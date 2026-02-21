import { Calendar, History } from 'lucide-react';

export function TopTabs({
  activeTab,
  onChange,
}: {
  activeTab: 'today' | 'history';
  onChange: (tab: 'today' | 'history') => void;
}) {
  return (
    <div className="flex gap-2 mb-6 bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
      <button
        onClick={() => onChange('today')}
        className={`flex-1 py-3 px-4 rounded-md font-medium transition-all ${
          activeTab === 'today' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        <span className="flex items-center justify-center gap-2">
          <Calendar className="w-5 h-5" />
          Today
        </span>
      </button>
      <button
        onClick={() => onChange('history')}
        className={`flex-1 py-3 px-4 rounded-md font-medium transition-all ${
          activeTab === 'history' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        <span className="flex items-center justify-center gap-2">
          <History className="w-5 h-5" />
          History
        </span>
      </button>
    </div>
  );
}
