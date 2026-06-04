import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* No auth for MVP. Profile keyed to a random device id stored locally.
 * Client is lazy-initialized so `next build` doesn't fail without env vars. */
let _client: SupabaseClient | null = null;
function client(): SupabaseClient | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key);
  return _client;
}

export function deviceId() {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem("pp_device");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("pp_device", id); }
  return id;
}

export async function loadProfile() {
  const c = client();
  if (!c) return null;
  const { data } = await c.from("profiles").select("data").eq("device", deviceId()).maybeSingle();
  return data?.data ?? null;
}

export async function saveProfile(payload: any) {
  const c = client();
  if (!c) return;
  await c.from("profiles").upsert({ device: deviceId(), data: payload, updated_at: new Date().toISOString() });
}
