import { prisma } from "./prisma";
import { AppError } from "./http";
import { HOLD_MINUTES, MAX_TICKETS_PER_MATCH_PER_USER, MAX_TICKETS_PER_ORDER } from "./config";

export async function holdSeats(userId: string, matchId: string, ticketIds: string[]) {
  const unique = [...new Set(ticketIds)];
  if (unique.length < 1 || unique.length > MAX_TICKETS_PER_ORDER) {
    throw new AppError(
      "LIMIT_EXCEEDED",
      `You can hold 1 to ${MAX_TICKETS_PER_ORDER} seats at a time.`,
      400,
    );
  }

  const now = new Date();
  const heldUntil = new Date(now.getTime() + HOLD_MINUTES * 60_000);

  return prisma.$transaction(async (tx) => {
    // Serialise this user's holds for this match so the per-user cap cannot be raced.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId + ":" + matchId}))`;

    const already = await tx.ticket.count({
      where: {
        matchId,
        OR: [
          { ownerId: userId, status: { in: ["SOLD", "USED"] } },
          { heldById: userId, status: "HELD", heldUntil: { gt: now } },
        ],
      },
    });
    if (already + unique.length > MAX_TICKETS_PER_MATCH_PER_USER) {
      throw new AppError(
        "LIMIT_EXCEEDED",
        `Maximum ${MAX_TICKETS_PER_MATCH_PER_USER} tickets per match per fan.`,
        409,
      );
    }

    // The atomic compare-and-set: only rows that are free (or whose hold expired)
    // are updated. If two requests race, Postgres makes the second one re-check the
    // WHERE clause after the first commits, and it no longer matches.
    const result = await tx.ticket.updateMany({
      where: {
        id: { in: unique },
        matchId,
        OR: [{ status: "AVAILABLE" }, { status: "HELD", heldUntil: { lt: now } }],
      },
      data: { status: "HELD", heldById: userId, heldUntil, orderId: null },
    });

    if (result.count !== unique.length) {
      throw new AppError("SEAT_TAKEN", "One or more seats were just taken.", 409);
    }
    return { heldUntil };
  });
}

export async function releaseHolds(userId: string, ticketIds: string[]) {
  const result = await prisma.ticket.updateMany({
    where: { id: { in: ticketIds }, heldById: userId, status: "HELD" },
    data: { status: "AVAILABLE", heldById: null, heldUntil: null, orderId: null },
  });
  return { released: result.count };
}