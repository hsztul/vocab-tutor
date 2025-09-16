import * as React from "react";
import { ClerkProvider } from "@clerk/nextjs";

export function SafeClerkProvider({ children }: { children: React.ReactNode }) {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!pk) {
    // In development use, allow rendering without Clerk to avoid crashes while env is not set.
    if (process.env.NODE_ENV !== "production") {
      if (typeof console !== "undefined") {
        console.warn("Clerk publishable key not set. Rendering without ClerkProvider.");
      }
      return <>{children}</>;
    }
  }
  return <ClerkProvider publishableKey={pk}>{children}</ClerkProvider>;
}
