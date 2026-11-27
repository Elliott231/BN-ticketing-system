"use client";
import { useState } from "react";

export default function ReturnButton({ ticketId }: { ticketId: string }) {
  const [msg, setMsg] = useState("");

  async function ret() {
    if (!confirm("Return this ticket to the official pool at face value?")) return;
    const res = await fetch(`/api/tickets/${ticketId}/return`, { method: "POST" });
    const data = await res.json();
    if (res.ok) window.location.reload();
    else setMsg(data.error?.message ?? "Failed");
  }

  return (
    <div>
      <button onClick={ret} className="rounded border px-3 py-1 text-sm">
        Return ticket
      </button>
      {msg && <p className="mt-1 text-xs text-red-600">{msg}</p>}
    </div>
  );
}