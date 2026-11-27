import { z } from "zod";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { api } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { enforceLimit } from "@/lib/ratelimit";

const body = z.object({ fullName: z.string().trim().min(3).max(100) });

export const POST = api(async (req) => {
  const user = await requireUser();
  await enforceLimit("api", req, user.id);
  const { fullName } = body.parse(await req.json());

  // "Verified" = the user proved ownership of a phone number through Clerk (SMS OTP).
  const clerkUser = await currentUser();
  const phone = clerkUser?.phoneNumbers.find((p) => p.verification?.status === "verified");
  const verified = !!phone || process.env.DEV_AUTO_VERIFY === "true";

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      fullName,
      phoneNumber: phone?.phoneNumber ?? user.phoneNumber,
      isVerified: verified,
    },
  });
  return Response.json({ isVerified: updated.isVerified });
});