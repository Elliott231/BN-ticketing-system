"use client";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function TicketQR({ ticketId }: { ticketId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function refresh() {
      const res = await fetch(`/api/tickets/${ticketId}/token`, { cache: "no-store" });
      if (!alive) return;
      if (!res.ok) return setError("Ticket unavailable");
      const data = await res.json();
      setToken(data.token);
      setLeft(data.secondsLeft);
      // fetch the next code right after the current 60 s window ends
      timer = setTimeout(refresh, data.secondsLeft * 1000 + 250);
    }
    refresh();
    const tick = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, [ticketId]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!token) return <p className="text-sm">Loading code...</p>;
  return (
    <div className="flex flex-col items-center gap-2">
      <QRCodeSVG value={token} size={180} />
      <div className="h-1 w-44 overflow-hidden rounded bg-gray-200">
        <div
          className="h-full bg-emerald-600 transition-all duration-1000"
          style={{ width: `${(left / 60) * 100}%` }}
        />
      </div>
      <p className="text-xs text-gray-500">Refreshes in {left}s. Screenshots will not work.</p>
    </div>
  );
}