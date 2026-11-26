import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "./prisma";
import { AppError } from "./http";

// Returns the app-database user for the signed-in Clerk user (or null).
// The row is created lazily on first visit, so no Clerk webhook is needed.
export const getCurrentUser = cache(async () => {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const existing = await prisma.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

  const cu = await currentUser();
  if (!cu) return null;
  const email = cu.primaryEmailAddress?.emailAddress ?? `${clerkId}@no-email.local`;
  const fullName = [cu.firstName, cu.lastName].filter(Boolean).join(" ") || "Unnamed Fan";

  return prisma.user.upsert({
    where: { clerkId },
    update: {},
    create: { clerkId, email, fullName },
  });
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in.", 401);
  return user;
}

export async function requireVerifiedUser() {
  const user = await requireUser();
  if (!user.isVerified) {
    throw new AppError("NOT_VERIFIED", "Verify your profile before buying.", 403);
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new AppError("FORBIDDEN", "Admins only.", 403);
  return user;
}