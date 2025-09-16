"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={
        "px-3 py-2 rounded-md text-sm font-medium transition-colors " +
        (active
          ? "bg-black/10 dark:bg-white/10 text-foreground"
          : "text-foreground/70 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5")
      }
    >
      {label}
    </Link>
  );
}

export default function Header() {
  const [counts, setCounts] = React.useState<{ passed: number; totalSenses: number } | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/me/progress', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setCounts({ passed: Number(data.passed || 0), totalSenses: Number(data.totalSenses || 0) });
      } catch {}
    }
    load();
    const t = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);
  const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return (
    <header className="sticky top-0 z-40 w-full border-b border-black/[.08] dark:border-white/[.12] backdrop-blur bg-background/80">
      <div className="mx-auto max-w-5xl flex h-14 items-center justify-between px-4">
        <nav className="flex items-center gap-2">
          <NavLink href="/app/review" label="Review" />
          <NavLink href="/app/test" label="Test" />
          <NavLink href="/app/profile" label="Profile" />
        </nav>
        <div className="flex items-center gap-3">
          <div className="text-xs px-2 py-1 rounded-full bg-black/5 dark:bg-white/10">
            Passed <span className="font-semibold">{counts?.passed ?? 0}</span> / <span className="font-semibold">{counts?.totalSenses ?? 0}</span>
          </div>
          {hasClerk ? (
            <>
              <SignedIn>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <Button variant="outline" size="sm">Sign in</Button>
                </SignInButton>
              </SignedOut>
            </>
          ) : (
            <Button asChild variant="outline" size="sm">
              <a href="/sign-in">Sign in</a>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
