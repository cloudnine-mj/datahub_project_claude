"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "@/components/session-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, KeyRound, LogOut, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mainNavItems } from "./nav-items";
import { cn } from "@/lib/utils";

export function Header() {
  const { data: session, status } = useSession();
  const user = session?.user;
  const pathname = usePathname();

  const isActiveNav = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-50 flex h-16 w-full items-center border-b border-dh-border bg-white">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-lg font-bold font-heading text-brand">LGAIR</span>
          <span className="text-lg font-semibold font-heading text-text-primary">DataHub</span>
        </Link>

        {/* Main Navigation */}
        <nav className="hidden md:flex items-center gap-1 ml-8">
          {mainNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                isActiveNav(item.href)
                  ? "text-text-primary bg-bg-surface"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
              )}
            >
              {item.title}
            </Link>
          ))}
        </nav>

        {/* Right Side */}
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="ghost" size="icon" className="text-text-secondary hover:text-text-primary">
            <Search className="h-4 w-4" />
          </Button>

          {status === "authenticated" ? (
            <>
              <Button variant="ghost" size="icon" className="relative text-text-secondary hover:text-text-primary">
                <Bell className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 px-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user?.image ?? ""} />
                      <AvatarFallback className="text-xs bg-brand text-white">
                        {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="text-xs text-text-secondary">{user?.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <User className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings/access-tokens">
                      <KeyRound className="mr-2 h-4 w-4" />
                      Access Tokens
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button asChild size="sm" className="bg-brand hover:bg-brand/90 text-white">
              <Link href="/login">Sign In</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
