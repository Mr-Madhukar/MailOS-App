import { env } from "../env";

/** Used by createCorsair approval.formatAsyncMessage — keep free of getCorsair() to avoid circular imports. */
export function formatCorsairApprovalMessage({ token }: {
  token: string;
  plugin: string;
  endpoint: string;
}) {
  return `Action requires approval. Visit ${env.CLIENT_URL}/corsair/approve/${token} to approve or deny, then retry.`;
}
