import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import SeatMap from "@/components/SeatMap";

export const dynamic = "force-dynamic";

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = await prisma.match.findUnique({ where: { id }, include: { stadium: true } });
  if (!match) notFound();
  const user = await getCurrentUser();

  return (
    <div>
      <h1 className="text-2xl font-bold">
        {match.homeTeam} vs {match.awayTeam}
      </h1>
      <p className="mb-4 text-gray-600">
        {match.kickoff.toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" })} |{" "}
        {match.stadium.name}
      </p>
      {!user && <p className="mb-4 rounded bg-blue-50 p-3 text-sm">Sign in to reserve seats.</p>}
      {user && !user.isVerified && (
        <p className="mb-4 rounded bg-amber-50 p-3 text-sm">
          Verify your profile first.{" "}
          <Link href="/onboarding" className="underline">
            Complete verification
          </Link>
        </p>
      )}
      <SeatMap matchId={match.id} canBuy={!!user && user.isVerified} />
    </div>
  );
}