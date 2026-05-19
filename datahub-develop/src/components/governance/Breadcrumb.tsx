import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="mb-2 flex items-center gap-1 text-sm text-gray-500">
      {items.map((c, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {c.href && !isLast ? (
              <Link href={c.href} className="hover:text-gray-900">
                {c.label}
              </Link>
            ) : (
              <span className={isLast ? "text-gray-900" : ""}>{c.label}</span>
            )}
            {!isLast && <ChevronRight size={14} className="text-gray-400" />}
          </span>
        );
      })}
    </nav>
  );
}
