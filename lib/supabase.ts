import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

/* Client is lazy-initialized so `next build` doesn't fail without env vars.
 * Anonymous users keep a local draft. Supabase persistence is scoped to the
 * authenticated user once Auth is connected. */
let _client: SupabaseClient | null = null;
function client(): SupabaseClient | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key);
  return _client;
}

const LOCAL_PROFILE_KEY = "pp_profile_draft";

export type AuthUser = Pick<User, "id" | "email">;

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function requireClient() {
  const c = client();
  if (!c) throw new Error("Supabase Auth is not configured.");
  return c;
}

function loadLocalProfile() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LOCAL_PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(LOCAL_PROFILE_KEY);
    return null;
  }
}

export async function loadProfile() {
  const c = client();
  if (!c) return loadLocalProfile();
  const { data: auth } = await c.auth.getUser();
  if (!auth.user) return loadLocalProfile();
  const { data } = await c.from("profiles").select("data").eq("user_id", auth.user.id).maybeSingle();
  return data?.data ?? null;
}

export async function saveProfile(payload: any) {
  const c = client();
  if (!c) {
    if (typeof window !== "undefined") localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(payload));
    return;
  }
  const { data: auth } = await c.auth.getUser();
  if (!auth.user) {
    if (typeof window !== "undefined") localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(payload));
    return;
  }
  await c.from("profiles").upsert(
    { user_id: auth.user.id, data: payload, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const c = client();
  if (!c) return null;
  const { data, error } = await c.auth.getUser();
  if (error) return null;
  return data.user ? { id: data.user.id, email: data.user.email } : null;
}

export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  const c = client();
  if (!c) return null;
  const { data } = c.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ? { id: session.user.id, email: session.user.email } : null;
    callback(user);
  });
  return data.subscription;
}

export async function signInWithPassword(email: string, password: string): Promise<AuthUser | null> {
  const { data, error } = await requireClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user ? { id: data.user.id, email: data.user.email } : null;
}

export async function signUp(email: string, password: string): Promise<{ user: AuthUser | null; needsConfirmation: boolean }> {
  const { data, error } = await requireClient().auth.signUp({ email, password });
  if (error) throw error;
  return {
    user: data.user ? { id: data.user.id, email: data.user.email } : null,
    needsConfirmation: Boolean(data.user && !data.session),
  };
}

export async function signOut() {
  const c = client();
  if (c) await c.auth.signOut();
}

export function clearLocalProfile() {
  if (typeof window !== "undefined") localStorage.removeItem(LOCAL_PROFILE_KEY);
}
