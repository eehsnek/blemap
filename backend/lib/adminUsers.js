import { getSupabaseAdmin } from "./supabaseAdmin.js";

const MANAGEABLE_ROLES = new Set([
  "user",
  "guest",
  "prospector",
  "poster",
  "admin",
]);

export function manageableRoles() {
  return [...MANAGEABLE_ROLES];
}

async function emailMap(admin) {
  const map = new Map();
  const perPage = 200;
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    for (const u of data.users || []) {
      map.set(u.id, {
        email: u.email || null,
        lastSignIn: u.last_sign_in_at || null,
        createdAt: u.created_at || null,
      });
    }
    if (!data.users?.length || data.users.length < perPage) break;
    page += 1;
    if (page > 20) break;
  }
  return map;
}

export async function listStewardUsers() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return { error: "SUPABASE_SERVICE_ROLE_KEY required for user management", status: 503 };
  }

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, username, role_id, disabled, created_at, roles(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const emails = await emailMap(admin);
  const users = (profiles || []).map((p) => {
    const auth = emails.get(p.id) || {};
    return {
      id: p.id,
      username: p.username || null,
      email: auth.email || null,
      role: p.roles?.name || "user",
      disabled: Boolean(p.disabled),
      created_at: p.created_at || auth.createdAt || null,
      last_sign_in_at: auth.lastSignIn || null,
    };
  });

  return { users, roles: manageableRoles() };
}

export async function setUserRole(targetUserId, roleName, actorId) {
  const role = String(roleName || "")
    .trim()
    .toLowerCase();
  if (!MANAGEABLE_ROLES.has(role)) {
    return { error: `Invalid role. Use: ${[...MANAGEABLE_ROLES].join(", ")}`, status: 400 };
  }
  if (!targetUserId) {
    return { error: "user id required", status: 400 };
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return { error: "SUPABASE_SERVICE_ROLE_KEY required", status: 503 };
  }

  const { data: roleRow, error: roleErr } = await admin
    .from("roles")
    .select("id, name")
    .eq("name", role)
    .maybeSingle();
  if (roleErr) throw roleErr;
  if (!roleRow) {
    return { error: `Role "${role}" missing in roles table`, status: 400 };
  }

  if (role !== "admin" && targetUserId === actorId) {
    const { data: admins } = await admin
      .from("profiles")
      .select("id, roles!inner(name)")
      .eq("roles.name", "admin");
    const otherAdmins = (admins || []).filter((a) => a.id !== actorId);
    if (!otherAdmins.length) {
      return {
        error: "Cannot remove admin from the last steward account",
        status: 400,
      };
    }
  }

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("id", targetUserId)
    .maybeSingle();

  if (!existing) {
    const { error: insErr } = await admin.from("profiles").insert({
      id: targetUserId,
      username: null,
      role_id: roleRow.id,
      disabled: false,
    });
    if (insErr) throw insErr;
  } else {
    const { error: updErr } = await admin
      .from("profiles")
      .update({ role_id: roleRow.id })
      .eq("id", targetUserId);
    if (updErr) throw updErr;
  }

  return {
    user: {
      id: targetUserId,
      role,
    },
  };
}

export async function setUserDisabled(targetUserId, disabled, actorId) {
  if (!targetUserId) {
    return { error: "user id required", status: 400 };
  }
  if (targetUserId === actorId && disabled) {
    return { error: "Cannot disable your own steward account", status: 400 };
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return { error: "SUPABASE_SERVICE_ROLE_KEY required", status: 503 };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, roles(name)")
    .eq("id", targetUserId)
    .maybeSingle();

  if (!profile) {
    return { error: "User profile not found", status: 404 };
  }

  if (disabled && profile.roles?.name === "admin") {
    const { data: admins } = await admin
      .from("profiles")
      .select("id, roles!inner(name)")
      .eq("roles.name", "admin")
      .eq("disabled", false);
    const others = (admins || []).filter((a) => a.id !== targetUserId);
    if (!others.length) {
      return { error: "Cannot disable the last active steward", status: 400 };
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({ disabled: Boolean(disabled) })
    .eq("id", targetUserId);
  if (error) throw error;

  return { user: { id: targetUserId, disabled: Boolean(disabled) } };
}

export async function isProfileDisabled(userId) {
  if (!userId) return false;
  const admin = getSupabaseAdmin();
  if (!admin) return false;
  const { data } = await admin
    .from("profiles")
    .select("disabled")
    .eq("id", userId)
    .maybeSingle();
  return Boolean(data?.disabled);
}
