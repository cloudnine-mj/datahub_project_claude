import Link from "next/link";
import { ChevronRight, Home as HomeIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageShellProps {
  breadcrumbs?: BreadcrumbItem[];
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function PageShell({
  breadcrumbs,
  title,
  description,
  actions,
  children,
  className,
}: PageShellProps) {
  return (
    <div className={cn("mx-auto w-full max-w-[1440px] px-6 py-8", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-4 flex items-center gap-1.5 text-xs text-text-secondary">
          <Link
            href="/"
            className="flex items-center gap-1 hover:text-text-primary transition-colors"
          >
            <HomeIcon className="h-3.5 w-3.5" />
            Home
          </Link>
          {breadcrumbs.map((crumb, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <ChevronRight className="h-3 w-3 text-text-muted" />
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="hover:text-text-primary transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-text-primary">{crumb.label}</span>
              )}
            </div>
          ))}
        </nav>
      )}

      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-2xl font-semibold text-text-primary">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-text-secondary">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>

      <div>{children}</div>
    </div>
  );
}
