import React, { useState, useEffect } from 'react';
import { Search, X, Sparkles } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = 'Search emails by recipient, subject, or content (Elasticsearch)...',
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      onSearch(searchTerm);
    }, 350);

    return () => clearTimeout(handler);
  }, [searchTerm, onSearch]);

  return (
    <div className="relative w-full max-w-lg">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
        <Search className="h-4 w-4" />
      </div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder={placeholder}
        className="block w-full pl-9 pr-20 py-2 border border-[#1F2430] rounded-lg bg-[#12161F] text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
      />
      <div className="absolute inset-y-0 right-0 pr-2 flex items-center space-x-1.5">
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="text-gray-500 hover:text-gray-300 p-1 rounded"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <span className="hidden sm:inline-flex items-center space-x-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <Sparkles className="h-2.5 w-2.5" />
          <span>Elastic</span>
        </span>
      </div>
    </div>
  );
};

export default SearchBar;
