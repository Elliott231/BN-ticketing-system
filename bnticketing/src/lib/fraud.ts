import { prisma } from "./prisma";
import type { FraudKind } from "../generated/prisma/enums";

type FraudInput = {
  ip?: string | null;
  userId?: string | null;
  ticketId?: string | null;
  detail?: string;
};

// Never let logging break a request: swallow errors.
export async function logFraud(kind: FraudKind, data: FraudInput = {}) {
  try {
    await prisma.fraudEvent.create({ data: { kind, ...data } });
  } catch (e) {
    console.error("logFraud failed", e);
  }
}