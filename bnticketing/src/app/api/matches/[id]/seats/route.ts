import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { api } from "@/lib/http";

export const GET = api<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const user = await getCurrentUser();
  const now = new Date();

  const tickets = await prisma.ticket.findMany({
    where: { matchId: id },
    include: { seat: { include: { section: true } } },
    orderBy: [
      { seat: { section: { name: "asc" } } },
      { seat: { row: "asc" } },
      { seat: { number: "asc" } },
    ],
  });

  let holdUntil: string | null = null;
  const seats = tickets.map((t) => {
    // Lazy expiry: a HELD ticket whose time ran out counts as free.
    const heldActive = t.status === "HELD" && t.heldUntil && t.heldUntil > now;
    const mine = !!user && heldActive && t.heldById === user.id;
    if (mine && t.heldUntil && (!holdUntil || t.heldUntil.toISOString() < holdUntil)) {
      holdUntil = t.heldUntil.toISOString();
    }
    const state = mine
      ? "MINE"
      : t.status === "AVAILABLE" || (t.status === "HELD" && !heldActive)
        ? "AVAILABLE"
        : "TAKEN";
    return {
      id: t.id,
      section: t.seat.section.name,
      row: t.seat.row,
      number: t.seat.number,
      priceCents: t.priceCents,
      state,
    };
  });

  return Response.json({ seats, holdUntil });
});