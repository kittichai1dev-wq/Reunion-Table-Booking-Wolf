'use client';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { hasConfig, sb } from '@/lib/supabase';

// undefined = still checking, null = signed out
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    if (!hasConfig) { setSession(null); return; }
    sb().auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb().auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}
