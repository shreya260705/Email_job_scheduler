import React, { useState } from 'react';
import { Search, SlidersHorizontal, RefreshCw, X } from 'lucide-react';

interface HeaderSearchProps {
  onSearch: (q: string) => void;
  onRefresh: () => void;
  loading?: boolean;
}

export const HeaderSearch: React.FC<HeaderSearchProps> = ({
  onSearch,
  onRefresh,
  loading = false,
}) => {
  const [query, setQuery] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onSearch(val);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <div className="h-16 px-6 border-b border-[#F0F0F0] flex items-center justify-between bg-white shrink-0">
      {/* Search Input Pill */}
      <div className="relative w-full max-w-xl">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
          <Search className="h-4 w-4" />
        </div>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Search by recipient, subject, or content..."
          className="w-full pl-10 pr-10 py-2 bg-[#F3F4F6] border-0 rounded-full text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 transition-all"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
            title="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Action Icons */}
      <div className="flex items-center space-x-3 text-gray-400">
        <button
          className="p-1.5 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          title="Filter"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
        <button
          onClick={onRefresh}
          className={`p-1.5 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors ${
            loading ? 'animate-spin text-gray-600' : ''
          }`}
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default HeaderSearch;
