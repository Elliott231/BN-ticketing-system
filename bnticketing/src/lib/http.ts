import { ZodError } from "zod";

export class AppError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type Ctx<P> = { params: Promise<P> };

// Wraps a route handler so every failure becomes a clean JSON error.
export function api<P = Record<string, string>>(
  fn: (req: Request, ctx: Ctx<P>) => Promise<Response>,
) {
  return async (req: Request, ctx: Ctx<P>): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof AppError) {
        return Response.json({ error: { code: e.code, message: e.message } }, { status: e.status });
      }
      if (e instanceof ZodError) {
        return Response.json(
          { error: { code: "BAD_INPUT", message: "Invalid request data" } },
          { status: 400 },
        );
      }
      console.error(e);
      return Response.json(
        { error: { code: "INTERNAL", message: "Unexpected server error" } },
        { status: 500 },
      );
    }
  };
}