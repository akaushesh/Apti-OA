import { Router } from "express";
import {
    Signup,
    Login,
    Logout,
    getCurrentUser,
    changePassword,
    getAllUsersWithStats,
    getUserDetailsByAdmin,
    updateUserRole,
    deleteUserByAdmin,
    getAdminAnalytics
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/admin.middleware.js";

const router = Router();

// Public Routes
router.route("/register").post(Signup);
router.route("/login").post(Login);

// Secured User Routes
router.route("/logout").post(verifyJWT, Logout);
router.route("/me").get(verifyJWT, getCurrentUser);
router.route("/changePassword").post(verifyJWT, changePassword);

// Secured Admin Routes
router.route("/admin/users").get(verifyJWT, verifyAdmin, getAllUsersWithStats);
router.route("/admin/users/:userId/details").get(verifyJWT, verifyAdmin, getUserDetailsByAdmin);
router.route("/admin/users/:userId/role").patch(verifyJWT, verifyAdmin, updateUserRole);
router.route("/admin/users/:userId").delete(verifyJWT, verifyAdmin, deleteUserByAdmin);
router.route("/admin/analytics").get(verifyJWT, verifyAdmin, getAdminAnalytics);

export default router;