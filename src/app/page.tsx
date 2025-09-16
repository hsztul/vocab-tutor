import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const { userId } = await auth();
  if (userId) {
    redirect("/app/review");
  }
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      <div className="space-y-4">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">SAT Vocab Journey</h1>
        <p className="text-foreground/70 max-w-prose">
          Review senses with flip cards and practice by speaking concise definitions. Sign in to save your progress.
        </p>
        <div>
          <Button asChild>
            <a href="/sign-in">Sign in to get started</a>
          </Button>
        </div>
      </div>
    </main>
  );
}
