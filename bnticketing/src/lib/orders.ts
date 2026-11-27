import { prisma } from "./prisma";
import { AppError } from "./http";
import { newSeed } from "./qr";
import { getStripe } from "./stripe";
import { PAYMENT_WINDOW_MINUTES } from "./config";

type Buyer = { id: string };

export async function startCheckout(user: Buyer, ticketIds: string[], origin: string) {
  const unique = [...new Set(ticketIds)];
  const now = new Date();
  const payUntil = new Date(now.getTime() + PAYMENT_WINDOW_MINUTES * 60_000);

  const { order, tickets } = await prisma.$transaction(async (tx) => {
    const mine = {
      id: { in: unique },
      status: "HELD" as const,
      heldById: user.id,
      heldUntil: { gt: now },
    };
    const tickets = await tx.ticket.findMany({
      where: mine,
      include: { match: true, seat: { include: { section: true } } },
    });
    if (tickets.length !== unique.length) {
      throw new AppError("HOLD_EXPIRED", "Your seat hold expired. Pick seats again.", 409);
    }
    const order = await tx.order.create({
      data: {
        userId: user.id,
        totalCents: tickets.reduce((sum, t) => sum + t.priceCents, 0),
        expiresAt: payUntil,
      },
    });
    // Extend the hold to cover the payment window and attach the order.
    const moved = await tx.ticket.updateMany({
      where: mine,
      data: { orderId: order.id, heldUntil: payUntil },
    });
    if (moved.count !== unique.length) {
      throw new AppError("HOLD_EXPIRED", "Your seat hold expired. Pick seats again.", 409);
    }
    return { order, tickets };
  });

  // Development shortcut: skip the payment provider entirely.
  if ((process.env.PAYMENT_MODE ?? "mock") === "mock") {
    await finalizeOrder(order.id, "mock-payment");
    return { url: `${origin}/wallet` };
  }

  const first = tickets[0];
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    client_reference_id: order.id,
    metadata: { orderId: order.id },
    expires_at: Math.floor(payUntil.getTime() / 1000),
    success_url: `${origin}/wallet?paid=1`,
    cancel_url: `${origin}/matches/${first.matchId}`,
    line_items: tickets.map((t) => ({
      quantity: 1,
      price_data: {
        currency: process.env.CURRENCY ?? "usd",
        unit_amount: t.priceCents,
        product_data: {
          name: `${t.match.homeTeam} vs ${t.match.awayTeam} | ${t.seat.section.name} Row ${t.seat.row} Seat ${t.seat.number}`,
        },
      },
    })),
  });
  await prisma.order.update({
    where: { id: order.id },
    data: { stripeSessionId: session.id },
  });
  return { url: session.url! };
}

// Idempotent: safe to call many times (webhook retries, double clicks).
export async function finalizeOrder(orderId: string, paymentRef?: string) {
  return prisma.$transaction(async (tx) => {
    // Only the first caller flips PENDING -> PAID. Everyone else sees count 0.
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date(), paymentRef },
    });
    if (claimed.count === 0) return { duplicate: true };

    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { user: true, tickets: true },
    });
    const stillOurs = order.tickets.every(
      (t) => t.status === "HELD" && t.heldById === order.userId,
    );
    if (!stillOurs || order.tickets.length === 0) {
      // Throwing rolls the whole transaction back, including the PAID flag.
      throw new AppError("HOLD_LOST", "Seats were released before payment.", 409);
    }

    for (const t of order.tickets) {
      await tx.ticket.update({
        where: { id: t.id },
        data: {
          status: "SOLD",
          ownerId: order.userId,
          leadBookerName: order.user.fullName, // identity binding snapshot
          heldById: null,
          heldUntil: null,
          qrSeed: newSeed(), // fresh secret: any earlier owner's QR is now dead
        },
      });
      // If this seat came back through an official return, the original buyer
      // becomes eligible for their refund now that it has resold.
      await tx.ticketReturn.updateMany({
        where: { ticketId: t.id, refundStatus: "PENDING_RESALE" },
        data: { refundStatus: "REFUNDABLE" },
      });
    }
    return { duplicate: false };
  });
}

export async function releaseOrder(orderId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status: "EXPIRED" },
    });
    await tx.ticket.updateMany({
      where: { orderId, status: "HELD" },
      data: { status: "AVAILABLE", heldById: null, heldUntil: null, orderId: null },
    });
  });
}