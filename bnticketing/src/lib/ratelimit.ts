import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { AppError } from "./http";
import { logFraud } from "./fraud";

const enabled = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = enabled ? Redis.fromEnv() : null;

function make(max: number, window: `${number} ${"s" | "m"}`, prefix: string) {
  return redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(max, window),
        prefix: `rl:${prefix}`,
      })
    : null;
}

const limiters = {
  api: make(60, "1 m", "api"),
  hold: make(10, "1 m", "hold"),
  checkout: make(5, "1 m", "checkout"),
  gate: make(120, "1 m", "gate"),
};
export type LimitKind = keyof typeof limiters;

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

const STRIKES_BEFORE_BLOCK = 5;
const BLOCK_SECONDS = 3600;

export async function enforceLimit(kind: LimitKind, req: Request, userId?: string) {
  if (!redis) return; // local dev without Upstash: limits are skipped
  const ip = clientIp(req);
  const id = userId ?? ip;

  if (await redis.get(`block:${ip}`)) {
    throw new AppError("BLOCKED", "Too many violations. Try again later.", 429);
  }

  const { success } = await limiters[kind]!.limit(`${kind}:${id}`);
  if (success) return;

  await logFraud("RATE_LIMIT", { ip, userId, detail: kind });
  const strikes = await redis.incr(`strikes:${ip}`);
  if (strikes === 1) await redis.expire(`strikes:${ip}`, BLOCK_SECONDS);
  if (strikes >= STRIKES_BEFORE_BLOCK) {
    await redis.set(`block:${ip}`, 1, { ex: BLOCK_SECONDS });
    await logFraud("IP_BLOCKED", { ip, userId, detail: `${strikes} strikes` });
  }
  throw new AppError("RATE_LIMITED", "Slow down and try again shortly.", 429);
}