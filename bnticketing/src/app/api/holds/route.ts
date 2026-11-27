import { z } from "zod";
import { api } from "@/lib/http";
import { requireVerifiedUser } from "@/lib/auth";
import { enforceLimit } from "@/lib/ratelimit";
import { holdSeats, releaseHolds } from "@/lib/holds";

const holdBody = z.object({
  matchId: z.string().min(1),
  ticketIds: z.array(z.string().min(1)).min(1).max(4),
});

export const POST = api(async (req) => {
  const user = await requireVerifiedUser();
  await enforceLimit("hold", req, user.id);
  const body = holdBody.parse(await req.json());
  const result = await holdSeats(user.id, body.matchId, body.ticketIds);
  return Response.json({ heldUntil: result.heldUntil });
});

const releaseBody = z.object({ ticketIds: z.array(z.string().min(1)).min(1).max(4) });

export const DELETE = api(async (req) => {
  const user = await requireVerifiedUser();
  await enforceLimit("api", req, user.id);
  const body = releaseBody.parse(await req.json());
  return Response.json(await releaseHolds(user.id, body.ticketIds));
});