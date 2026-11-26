import crypto from "node:crypto";
import { QR_WINDOW_SECONDS } from "./config";

// Token format: <ticketId>.<window>.<signature>
// window = floor(unixSeconds / 60)
// signature = first 22 chars of base64url(HMAC-SHA256(secret:seed, ticketId:window))

function sign(seed: string, ticketId: string, window: number) {
  return crypto
    .createHmac("sha256", `${process.env.QR_SECRET}:${seed}`)
    .update(`${ticketId}:${window}`)
    .digest("base64url")
    .slice(0, 22);
}

export function newSeed() {
  return crypto.randomBytes(32).toString("hex");
}

export function currentWindow(nowMs = Date.now()) {
  return Math.floor(nowMs / 1000 / QR_WINDOW_SECONDS);
}

export function secondsLeftInWindow(nowMs = Date.now()) {
  return QR_WINDOW_SECONDS - (Math.floor(nowMs / 1000) % QR_WINDOW_SECONDS);
}

export function generateToken(ticketId: string, seed: string, nowMs = Date.now()) {
  const w = currentWindow(nowMs);
  return `${ticketId}.${w}.${sign(seed, ticketId, w)}`;
}

export function parseToken(token: unknown) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [ticketId, w, sig] = parts;
  const window = Number(w);
  if (!ticketId || !Number.isInteger(window) || !sig) return null;
  return { ticketId, window, sig };
}

// Accepts the previous, current and next window to tolerate phone clock drift.
export function verifyToken(token: string, seed: string, nowMs = Date.now()) {
  const p = parseToken(token);
  if (!p) return false;
  const now = currentWindow(nowMs);
  if (Math.abs(now - p.window) > 1) return false;
  const expected = Buffer.from(sign(seed, p.ticketId, p.window));
  const given = Buffer.from(p.sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}