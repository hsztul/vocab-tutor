import { clerkMiddleware } from "@clerk/nextjs/server";

// Use default Clerk middleware; we'll handle route-level protection in layouts/pages.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static files, handle everything else
    "/((?!_next|.*\\..*|favicon.ico).*)",
  ],
};
