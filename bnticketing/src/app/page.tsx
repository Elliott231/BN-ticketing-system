import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic"; // always read live availability

export default async function Home() {
  const matches = await prisma.match.findMany({
    where: { kickoff: { gt: new Date() } },
    orderBy: { kickoff: "asc" },
    include: {
      stadium: true,
      _count: { select: { tickets: { where: { status: "AVAILABLE" } } } },
    },
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Upcoming matches</h1>
      <p className="mb-6 text-gray-600">
        Face-value tickets only. Resale happens through the official exchange.
      </p>
      {matches.length === 0 && <p>No upcoming matches yet.</p>}
      <ul className="grid gap-4 sm:grid-cols-2">
        {matches.map((m) => (
          <li key={m.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">
              {m.homeTeam} vs {m.awayTeam}
            </h2>
            <p className="text-sm text-gray-600">
              {m.kickoff.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} |{" "}
              {m.stadium.name}
            </p>
            {m.highDemand && (
              <span className="mt-2 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                High demand: ID checked at gate
              </span>
            )}
            <p className="mt-2 text-sm">{m._count.tickets} seats available</p>
            <Link
              href={`/matches/${m.id}`}
              className="mt-3 inline-block rounded bg-emerald-600 px-3 py-1.5 text-sm text-white"
            >
              Choose seats
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}