import { supabaseAdmin } from "../../database/supabaseAdmin.js";

export async function requireAdmin(req, res, next) {
    try {
        const userId = req.user.id;

        const { data: user, error } = await supabaseAdmin
            .from("users")
            .select(`
                role_id,
                roles (
                    name
                )
            `)
            .eq("id", userId)
            .single();

        if (error || !user) {
            return res.status(403).json({
                error: "Access denied. Admin privileges required."
            });
        }

        console.log("Authenticated user:", userId);
        console.log("Resolved role_id:", user.role_id);
        console.log("Resolved role:", user.roles?.name);

        if (user.roles?.name !== "admin") {
            return res.status(403).json({
                error: "Access denied. Admin privileges required."
            });
        }

        next();
    } catch (error) {
        console.error("Admin authorization error:", error);

        return res.status(500).json({
            error: "Authorization check failed"
        });
    }
}