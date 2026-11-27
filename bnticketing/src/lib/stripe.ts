import Stripe from "stripe";

let client: Stripe | null = null;

// Created lazily so the app still runs in PAYMENT_MODE=mock without Stripe keys.
export function getStripe() {
  if (!client) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return client;
}