import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const hasConfig = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

// Created lazily so `next build` works before the env vars are filled in
export function sb(): SupabaseClient {
  if (!client) client = createClient(url, anonKey);
  return client;
}

// Every API call in spec §8 is a Postgres function (see supabase/schema.sql)
export async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}
