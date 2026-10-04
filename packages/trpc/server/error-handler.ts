import { TRPCError } from "@trpc/server";
import { logger } from "@repo/logger";

export function sanitizeTrpcError(error: unknown): never {
  if (error instanceof TRPCError) throw error;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : "Unknown error";

  logger.error("Unhandled tRPC error", {
    message,
    stack: error instanceof Error ? error.stack : undefined,
  });

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Something went wrong. Please try again.",
  });
}
