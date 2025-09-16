import type { Metadata } from "next";
import Header from "@/components/header";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "SAT Vocab Journey",
  description: "Review and test SAT vocabulary senses",
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;
  if (hasClerk) {
    // Protect all /app routes; unauthenticated users will be redirected to sign-in
    const { userId } = await auth();
    if (!userId) {
      redirect("/sign-in");
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
