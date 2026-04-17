import { Router } from "express";
import authRoutes from "./auth";
import userRoutes from "./users";
import roleRoutes from "./roles";
import projectRoutes from "./projects";
import codeRoutes from "./codes";
import productRoutes from "./products";
import customDataRoutes from "./custom-data";
import securityPolicyRoutes from "./security-policies";
import logRoutes from "./logs";
import uploadRoutes from "./upload";
import profileRoutes from "./profile";
import systemRoutes from "./system";
import dashboardRoutes from "./dashboard";
import notificationRoutes from "./notifications";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/roles", roleRoutes);
router.use("/projects", projectRoutes);
router.use("/codes", codeRoutes);
router.use("/products", productRoutes);
router.use("/custom-data", customDataRoutes);
router.use("/security-policies", securityPolicyRoutes);
router.use("/logs", logRoutes);
router.use("/upload", uploadRoutes);
router.use("/profile", profileRoutes);
router.use("/system", systemRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/notifications", notificationRoutes);

export default router;
