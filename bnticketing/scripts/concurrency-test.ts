import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { holdSeats } from "../src/lib/holds";

const USERS = 50;

async function main() {
  const match = await prisma.match.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
  const target = await prisma.ticket.findFirstOrThrow({
    where: { matchId: match.id, status: "AVAILABLE" },
  });

  const users = await Promise.all(
    Array.from({ length: USERS }, (_, i) =>
      prisma.user.upsert({
        where: { clerkId: `load-test-${i}` },
        update: {},
        create: {
          clerkId: `load-test-${i}`,
          email: `load${i}@test.local`,
          fullName: `Load User ${i}`,
          isVerified: true,
        },
      }),
    ),
  );

  console.log(`Firing ${USERS} simultaneous holds for seat ${target.id} ...`);
  const t0 = Date.now();
  const results = await Promise.allSettled(
    users.map((u) => holdSeats(u.id, match.id, [target.id])),
  );
  const wins = results.filter((r) => r.status === "fulfilled").length;
  const final = await prisma.ticket.findUniqueOrThrow({ where: { id: target.id } });

  console.log(`${wins} succeeded, ${USERS - wins} rejected in ${Date.now() - t0} ms`);
  console.log(`Final state: ${final.status}, held by ${final.heldById}`);

  // clean up so the demo seat is free again
  await prisma.ticket.update({
    where: { id: target.id },
    data: { status: "AVAILABLE", heldById: null, heldUntil: null },
  });
  await prisma.$disconnect();

  if (wins !== 1) {
    console.error("FAIL: expected exactly one winner");
    process.exit(1);
  }
  console.log("PASS: exactly one winner, no double booking");
}

main();