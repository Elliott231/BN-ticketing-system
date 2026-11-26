import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { newSeed } from "../src/lib/qr";

const LAYOUT = [
  { name: "North Stand", rows: "ABCDEFGHIJ", perRow: 20, price: 2500 },
  { name: "South Stand", rows: "ABCDEFGHIJ", perRow: 20, price: 2500 },
  { name: "VIP", rows: "ABCD", perRow: 10, price: 8000 },
];

async function main() {
  await prisma.stadium.deleteMany(); // cascades to sections/seats (dev only!)
  const stadium = await prisma.stadium.create({
    data: { name: "Demo Arena", city: "Nairobi" },
  });

  const sectionPrice = new Map<string, number>();
  for (const layout of LAYOUT) {
    const section = await prisma.section.create({
      data: { stadiumId: stadium.id, name: layout.name },
    });
    sectionPrice.set(section.id, layout.price);
    await prisma.seat.createMany({
      data: [...layout.rows].flatMap((row) =>
        Array.from({ length: layout.perRow }, (_, i) => ({
          stadiumId: stadium.id,
          sectionId: section.id,
          row,
          number: i + 1,
        })),
      ),
    });
  }

  const kickoff = new Date(Date.now() + 14 * 24 * 3_600_000);
  const match = await prisma.match.create({
    data: {
      homeTeam: "Gor Mahia",
      awayTeam: "AFC Leopards",
      kickoff,
      stadiumId: stadium.id,
      highDemand: true,
    },
  });
  const seats = await prisma.seat.findMany({ where: { stadiumId: stadium.id } });
  await prisma.ticket.createMany({
    data: seats.map((s) => ({
      matchId: match.id,
      seatId: s.id,
      priceCents: sectionPrice.get(s.sectionId)!,
      qrSeed: newSeed(),
    })),
  });
  console.log(`Seeded stadium with ${seats.length} seats and match ${match.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());