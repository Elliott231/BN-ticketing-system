import { api } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { enforceLimit } from "@/lib/ratelimit";
import { returnTicket } from "@/lib/returns";

export const POST = api<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  await enforceLimit("api", req, user.id);
  return Response.json(await returnTicket(user.id, id));
});