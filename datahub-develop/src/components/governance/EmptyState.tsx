import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ message, icon }: { message: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
      {icon ?? <Inbox size={32} strokeWidth={1.5} />}
      <p className="text-sm">{message}</p>
    </div>
  );
}
