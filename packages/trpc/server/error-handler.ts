import { TRPCError } from "@trpc/server";
import { logger } from "@repo/logger";

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (typeof error === "object" && error !== null) {
    return JSON.stringify(error);
  }
  return "Unknown error";
}

export function sanitizeTrpcError(error: unknown): never {
  if (error instanceof TRPCError) throw error;

  logger.error("Unhandled tRPC error", {
    message: resolveErrorMessage(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Something went wrong. Please try again.",
  });
}
