import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import TicketQR from "@/components/TicketQR";
import ReturnButton from "@/components/ReturnButton";

export const dynamic = "force-dynamic";

export default async function Wallet() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const tickets = await prisma.ticket.findMany({
    where: { ownerId: user.id, status: { in: ["SOLD", "USED"] } },
    include: { match: true, seat: { include: { section: true } } },
    orderBy: { match: { kickoff: "asc" } },
  });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">My tickets</h1>
      {tickets.length === 0 && <p>You have no tickets yet.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {tickets.map((t) => (
          <div key={t.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="font-semibold">
              {t.match.homeTeam} vs {t.match.awayTeam}
            </h2>
            <p className="text-sm text-gray-600">
              {t.seat.section.name}, Row {t.seat.row}, Seat {t.seat.number}
            </p>
            <p className="mb-3 text-xs text-gray-500">Lead Booker: {t.leadBookerName}</p>
            {t.status === "USED" ? (
              <p className="rounded bg-gray-100 p-2 text-sm">Scanned at the gate.</p>
            ) : (
              <>
                <TicketQR ticketId={t.id} />
                <div className="mt-3">
                  <ReturnButton ticketId={t.id} />
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}