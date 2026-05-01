export function Footer() {
  return (
    <footer className="flex h-12 items-center justify-between border-t border-gray-200 bg-white px-6 text-xs text-gray-500">
      <div className="flex items-center gap-2">
        <span className="grid h-5 w-5 place-items-center rounded bg-brand text-[10px] font-bold text-white">A</span>
        <span className="font-semibold text-gray-700">LGAIR DataHub</span>
        <span className="text-gray-300">·</span>
        <span>© 2026 LG Electronics</span>
      </div>
      <div className="flex items-center gap-4">
        <a href="#" className="hover:text-gray-700">Terms</a>
        <a href="#" className="hover:text-gray-700">Privacy</a>
        <a href="#" className="hover:text-gray-700">Docs</a>
        <a href="#" className="hover:text-gray-700">Status</a>
        <span>🌐 한국어</span>
      </div>
    </footer>
  );
}
