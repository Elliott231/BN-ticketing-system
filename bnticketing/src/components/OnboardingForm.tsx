"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingForm({ initialName }: { initialName: string }) {
  const [fullName, setFullName] = useState(initialName);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function submit() {
    setMsg("Checking...");
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error?.message ?? "Failed");
    if (data.isVerified) {
      router.push("/");
      router.refresh();
    } else {
      setMsg("Phone not verified yet. Add and verify it under Manage account, then retry.");
    }
  }

  return (
    <div className="space-y-3">
      <input
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        className="w-full rounded border p-2"
        placeholder="Full legal name"
      />
      <button onClick={submit} className="rounded bg-emerald-600 px-4 py-2 text-white">
        Save and verify
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}