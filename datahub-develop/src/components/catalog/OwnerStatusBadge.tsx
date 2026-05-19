export default function OwnerStatusBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-red-600 bg-red-100 rounded-full">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
      담당자 확인 필요
    </span>
  );
}
