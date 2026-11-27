import { prisma } from "./prisma";
import { AppError } from "./http";
import { newSeed } from "./qr";
import { RETURN_CUTOFF_HOURS } from "./config";

// Note what is NOT here: there is no price parameter. The relisted price is
// always the ticket's original face value, so inflating it is impossible.
export async function returnTicket(userId: string, ticketId: string) {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      include: { match: true },
    });
    if (!ticket || ticket.ownerId !== userId) {
      throw new AppError("NOT_FOUND", "Ticket not found.", 404);
    }
    if (ticket.status !== "SOLD") {
      throw new AppError("NOT_RETURNABLE", "This ticket cannot be returned.", 409);
    }
    const cutoff = ticket.match.kickoff.getTime() - RETURN_CUTOFF_HOURS * 3_600_000;
    if (Date.now() > cutoff) {
      throw new AppError(
        "RETURN_CLOSED",
        `Returns close ${RETURN_CUTOFF_HOURS} hours before kickoff.`,
        409,
      );
    }

    const result = await tx.ticket.updateMany({
      where: { id: ticketId, ownerId: userId, status: "SOLD", checkedInAt: null },
      data: {
        status: "AVAILABLE",
        ownerId: null,
        leadBookerName: null,
        orderId: null,
        heldById: null,
        heldUntil: null,
        isOfficialResale: true,
        resaleCount: { increment: 1 },
        qrSeed: newSeed(),
      },
    });
    if (result.count !== 1) {
      throw new AppError("NOT_RETURNABLE", "This ticket cannot be returned.", 409);
    }
    await tx.ticketReturn.create({
      data: { ticketId, userId, amountCents: ticket.priceCents },
    });
    return { ok: true };
  });
}