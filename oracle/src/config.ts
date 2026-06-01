import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  ARBITRUM_SEPOLIA_RPC: z.string().url(),
  ORACLE_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  WORKPROOF_CONTRACT: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  GENLAYER_STUDIO_RPC: z.string().url(),
  GENLAYER_CONTRACT: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
  DEADLINE_CHECK_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
  ORACLE_HTTP_PORT: z.coerce.number().int().positive().default(8787)
});

export const env = schema.parse(process.env);
