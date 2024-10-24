import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getCoupon, validCoupon } from "../controllers/coupon.controller.js";

const router = express.Router();

router.get("/", protectRoute, getCoupon);
router.post("/validate", protectRoute, validCoupon);

export default router;
