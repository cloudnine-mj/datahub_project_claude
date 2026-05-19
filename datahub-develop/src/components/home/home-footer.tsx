import Link from "next/link";

export function HomeFooter() {
  return (
    <footer className="border-t border-dh-border bg-white">
      <div className="mx-auto max-w-[1440px] px-6 py-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="font-heading text-sm font-bold text-brand">LGAIR</span>
            <span className="font-heading text-sm font-semibold text-text-primary">DataHub</span>
          </div>
          <nav className="flex gap-6 text-xs text-text-secondary">
            <Link href="/docs/api" className="hover:text-text-primary transition-colors">API Docs</Link>
            <Link href="/docs/sdk" className="hover:text-text-primary transition-colors">SDK Guide</Link>
            <Link href="/governance" className="hover:text-text-primary transition-colors">Governance</Link>
          </nav>
          <p className="text-xs text-text-muted">© 2026 LG AI Research. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
