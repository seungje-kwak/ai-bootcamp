// Road distance and taxi fare for one leg. The Kakao REST key stays on the server.
// GET /api/route-estimate                              -> { configured }
// GET /api/route-estimate?from=lat,lng&to=lat,lng      -> RouteEstimate
import { NextResponse } from "next/server";
import { estimateRoute, routeApiKey, type LatLng } from "@/lib/server/route-estimate";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const error = (status: number, code: string, message: string) =>
  NextResponse.json({ code, message }, { status, headers: noStore });

// Jeju Island only: this is not a general-purpose directions proxy.
const inJeju = (p: LatLng) => p.lat >= 33.1 && p.lat <= 33.6 && p.lng >= 126.1 && p.lng <= 127.0;

function parsePoint(raw: string | null): LatLng | null {
  const m = /^(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/.exec(raw ?? "");
  if (!m) return null;
  const p = { lat: Number(m[1]), lng: Number(m[2]) };
  return inJeju(p) ? p : null;
}

export async function GET(req: Request) {
  const key = routeApiKey();
  const params = new URL(req.url).searchParams;
  if (!params.has("from") && !params.has("to")) {
    return NextResponse.json({ configured: key !== null }, { headers: noStore });
  }

  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return error(403, "FORBIDDEN", "Cross-site requests are not allowed.");
  if (!key) return error(501, "ROUTE_API_NOT_CONFIGURED", "No route service is connected.");

  const from = parsePoint(params.get("from"));
  const to = parsePoint(params.get("to"));
  if (!from || !to) return error(400, "BAD_REQUEST", "from and to must be lat,lng pairs on Jeju Island.");

  try {
    return NextResponse.json(await estimateRoute(key, from, to), { headers: noStore });
  } catch (e) {
    console.warn("route estimate failed:", e instanceof Error ? e.message : e);
    return error(502, "ROUTE_API_FAILED", "The route service did not answer.");
  }
}
