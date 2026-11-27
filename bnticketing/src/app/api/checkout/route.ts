import { z } from "zod";
import { api } from "@/lib/http";
import { requireVerifiedUser } from "@/lib/auth";
import { enforceLimit } from "@/lib/ratelimit";
import { startCheckout } from "@/lib/orders";

const body = z.object({ ticketIds: z.array(z.string().min(1)).min(1).max(4) });

export const POST = api(async (req) => {
  const user = await requireVerifiedUser();
  await enforceLimit("checkout", req, user.id);
  const { ticketIds } = body.parse(await req.json());
  const origin = new URL(req.url).origin;
  return Response.json(await startCheckout(user, ticketIds, origin));
});