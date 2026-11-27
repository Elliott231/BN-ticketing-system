"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type Seat = {
  id: string;
  section: string;
  row: string;
  number: number;
  priceCents: number;
  state: "AVAILABLE" | "TAKEN" | "MINE";
};

const MAX = 4;
const money = (c: number) => (c / 100).toFixed(2);

export default function SeatMap({ matchId, canBuy }: { matchId: string; canBuy: boolean }) {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [holdUntil, setHoldUntil] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/matches/${matchId}/seats`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setSeats(data.seats);
    setHoldUntil(data.holdUntil);
  }, [matchId]);

  useEffect(() => {
    const first = setTimeout(load, 0); // initial fetch
    const t = setInterval(load, 10_000); // near-real-time availability
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  // Countdown for the active hold
  useEffect(() => {
    if (!holdUntil) return;
    const tick = () =>
      setLeft(Math.max(0, Math.floor((new Date(holdUntil).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [holdUntil]);

  const mine = useMemo(() => seats.filter((s) => s.state === "MINE"), [seats]);
  const hasHold = mine.length > 0 && left > 0;
  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, Seat[]>>();
    for (const s of seats) {
      if (!map.has(s.section)) map.set(s.section, new Map());
      const rows = map.get(s.section)!;
      if (!rows.has(s.row)) rows.set(s.row, []);
      rows.get(s.row)!.push(s);
    }
    return map;
  }, [seats]);

  function toggle(s: Seat) {
    if (!canBuy || hasHold || s.state !== "AVAILABLE") return;
    setPicked((p) =>
      p.includes(s.id) ? p.filter((x) => x !== s.id) : p.length < MAX ? [...p, s.id] : p,
    );
  }

  async function call(url: string, method: string, body: unknown) {
    setBusy(true);
    setMsg("");
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error?.message ?? "Something went wrong");
      await load();
      return null;
    }
    return data;
  }

  async function reserve() {
    const ok = await call("/api/holds", "POST", { matchId, ticketIds: picked });
    if (ok) {
      setPicked([]);
      await load();
    }
  }
  async function release() {
    await call("/api/holds", "DELETE", { ticketIds: mine.map((s) => s.id) });
    await load();
  }
  async function pay() {
    const data = await call("/api/checkout", "POST", { ticketIds: mine.map((s) => s.id) });
    if (data?.url) window.location.href = data.url;
  }

  const total = (hasHold ? mine : seats.filter((s) => picked.includes(s.id))).reduce(
    (sum, s) => sum + s.priceCents,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex gap-4 text-xs">
        <Legend color="bg-white border" label="Available" />
        <Legend color="bg-emerald-600" label="Selected / yours" />
        <Legend color="bg-gray-300" label="Taken" />
      </div>

      {[...grouped.entries()].map(([section, rows]) => (
        <section key={section}>
          <h3 className="mb-2 font-semibold">{section}</h3>
          <div className="space-y-1 overflow-x-auto">
            {[...rows.entries()].map(([row, rowSeats]) => (
              <div key={row} className="flex items-center gap-1">
                <span className="w-6 text-xs text-gray-500">{row}</span>
                {rowSeats.map((s) => {
                  const sel = picked.includes(s.id) || s.state === "MINE";
                  const cls = sel
                    ? "bg-emerald-600 text-white"
                    : s.state === "TAKEN"
                      ? "bg-gray-300 text-gray-400"
                      : "bg-white border hover:bg-emerald-50";
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggle(s)}
                      disabled={s.state === "TAKEN"}
                      title={`${section} ${row}${s.number} | ${money(s.priceCents)}`}
                      className={`h-6 w-6 shrink-0 rounded text-[10px] ${cls}`}
                    >
                      {s.number}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t bg-white p-3">
        <span className="text-sm">Total: {money(total)}</span>
        {!hasHold && (
          <button
            onClick={reserve}
            disabled={busy || picked.length === 0 || !canBuy}
            className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-40"
          >
            Reserve {picked.length || ""} seat(s)
          </button>
        )}
        {hasHold && (
          <>
            <span className="text-sm font-medium text-amber-700">
              Held for {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
            </span>
            <button
              onClick={pay}
              disabled={busy}
              className="rounded bg-emerald-600 px-4 py-2 text-white"
            >
              Pay now
            </button>
            <button onClick={release} disabled={busy} className="rounded border px-4 py-2">
              Release
            </button>
          </>
        )}
        {msg && <span className="text-sm text-red-600">{msg}</span>}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block h-3 w-3 rounded ${color}`} />
      {label}
    </span>
  );
}