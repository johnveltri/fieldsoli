import { createClient } from "@supabase/supabase-js";

import { parseResolveResult, type SharedDocument } from "./share-document";

export async function loadSharedDocument(token: string): Promise<SharedDocument> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { status: "outage" };
  try {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.rpc("resolve_shared_financial_document", {
      p_token: token,
    });
    if (error) return { status: "outage" };
    return parseResolveResult(data);
  } catch {
    return { status: "outage" };
  }
}
