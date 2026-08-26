import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_CONFIGURED,
} from "./config.js";

if (typeof window !== "undefined") {
  const blob = `${window.location.hash}\n${window.location.search}`;
  if (/type=recovery/i.test(blob)) {
    try {
      sessionStorage.setItem("blemap-password-recovery", "1");
    } catch {
      /* ignore */
    }
  }
}

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
  async setSession() {
    return {
      data: { session: null },
      error: { message: "Supabase is not configured." },
    };
  },
  async updateUser() {
    return { data: { user: null }, error: { message: "Supabase is not configured." } };
  },
  async resetPasswordForEmail() {
    return { data: {}, error: { message: "Supabase is not configured." } };
  },
  async verifyOtp() {
    return { data: { session: null }, error: { message: "Supabase is not configured." } };
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
