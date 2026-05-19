"use client";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
}

export default function SearchBar({ value, onChange, onSearch }: SearchBarProps) {
  return (
    <div className="flex items-center gap-0 border border-gray-300 rounded-lg overflow-hidden bg-white">
      <div className="flex items-center flex-1 px-4">
        <svg
          className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          placeholder="데이터셋 이름, 모달리티, 조직으로 검색..."
          className="w-full py-3 outline-none text-sm text-gray-700 placeholder-gray-400"
        />
      </div>
      <button
        onClick={onSearch}
        className="px-6 py-3 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        검색
      </button>
    </div>
  );
}
