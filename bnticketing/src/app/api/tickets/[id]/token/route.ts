import { prisma } from "@/lib/prisma";
import { api, AppError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { enforceLimit } from "@/lib/ratelimit";
import { generateToken, secondsLeftInWindow } from "@/lib/qr";

export const GET = api<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  await enforceLimit("api", req, user.id);

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket || ticket.ownerId !== user.id || ticket.status !== "SOLD") {
    throw new AppError("NOT_FOUND", "Ticket not found.", 404);
  }
  return Response.json(
    {
      token: generateToken(ticket.id, ticket.qrSeed),
      secondsLeft: secondsLeftInWindow(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});