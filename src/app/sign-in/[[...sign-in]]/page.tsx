import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <SignIn appearance={{ elements: { card: "shadow-none border border-black/10 dark:border-white/10" } }} />
    </div>
  );
}
