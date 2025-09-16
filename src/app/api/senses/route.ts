// Back-compat route: proxy to /api/words now that the 'senses' table was removed
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  url.pathname = "/api/words";
  // Forward cookies/auth
  const res = await fetch(url.toString(), {
    headers: {
      cookie: req.headers.get("cookie") ?? "",
    },
  });
  return new Response(await res.text(), { status: res.status, headers: res.headers });
}
