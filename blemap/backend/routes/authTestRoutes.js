import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/authmwAdmin.js";

const router = express.Router();

router.get("/test-auth", authenticate, (req, res) => {
  res.json({
    authenticated: true,
    userId: req.user.id,
    email: req.user.email
  });
});

router.get(
    "/test-admin",
    authenticate,
    requireAdmin,
    (req, res) => {
        res.json({
            authenticated: true,
            adminCheckPassed: true,
            userId: req.user.id
        });
    }
);

export default router;