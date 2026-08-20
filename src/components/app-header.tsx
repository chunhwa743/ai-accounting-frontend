"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, ScrollText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSessionUser } from "@/lib/session-context";

export function AppHeader() {
  const user = useSessionUser();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/session/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-4 px-6">
        <Link href="/clients" className="flex items-center gap-2 font-semibold">
          <ScrollText className="size-5" />
          <span>AI Accounting</span>
        </Link>

        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <span className="bg-muted text-muted-foreground flex size-6 items-center justify-center rounded-full text-[10px] font-medium">
                {initials}
              </span>
              <span className="hidden sm:inline">{user.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-muted-foreground text-xs">{user.email}</div>
              {/* Approvals and corrections are recorded against this person -
                  preparer and reviewer separation is ordinary practice. */}
              <div className="text-muted-foreground mt-1 text-xs">
                Sign-offs are recorded in your name.
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut()}>
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
