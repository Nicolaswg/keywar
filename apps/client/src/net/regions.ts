import { Client } from "@colyseus/sdk";

export interface Region {
  id: string;
  url: string;
  ping: number | null;
}

/** VITE_REGIONS="sa-east=wss://sa.keywar.gg,us-east=wss://us.keywar.gg" */
export function configuredRegions(): Region[] {
  const raw = (import.meta.env.VITE_REGIONS as string | undefined) ?? "local=ws://localhost:2567";
  return raw
    .split(",")
    .map((pair) => pair.trim().split("="))
    .filter((p): p is [string, string] => p.length === 2 && !!p[0] && !!p[1])
    .map(([id, url]) => ({ id, url, ping: null }));
}

/** Pings every region in parallel; unreachable ones keep ping = null. Sorted fastest first. */
export async function measureRegions(regions: Region[]): Promise<Region[]> {
  const measured = await Promise.all(
    regions.map(async (r) => {
      try {
        const ping = await new Client(r.url).getLatency({ pingCount: 3, timeout: 1500 });
        return { ...r, ping: Math.round(ping) };
      } catch {
        return { ...r, ping: null };
      }
    }),
  );
  return measured.sort((a, b) => (a.ping ?? Infinity) - (b.ping ?? Infinity));
}
