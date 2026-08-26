import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_CONFIGURED,
} from "./config.js";

const authStub = {
  async getUser() {
    return { data: { user: null }, error: null };
  },
  async getSession() {
    return { data: { session: null }, error: null };
  },
  async signInWithPassword() {
    return {
      data: { user: null, session: null },
      error: {
        message:
          "Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env, then restart the server.",
      },
    };
  },
  async signUp() {
    return {
      data: { user: null, session: null },
      error: {
        message:
          "Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env, then restart the server.",
      },
    };
  },
  async signOut() {
    return { error: null };
  },
  onAuthStateChange() {
    return { data: { subscription: { unsubscribe() {} } } };
  },
};

/** @type {import("@supabase/supabase-js").SupabaseClient | { auth: typeof authStub, removeChannel: () => void, channel: () => { on: () => unknown, subscribe: () => unknown } }} */
export const supabase = SUPABASE_CONFIGURED
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "blemap-auth",
      },
    })
  : {
      auth: authStub,
      removeChannel() {},
      channel() {
        return {
          on() {
            return this;
          },
          subscribe() {
            return this;
          },
        };
      },
    };

export { SUPABASE_CONFIGURED };
