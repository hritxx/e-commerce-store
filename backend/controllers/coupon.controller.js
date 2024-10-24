import Coupon from "../models/coupon.model.js";

export const getCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findOne({
      userId: req.user._id,
      isActive: true,
    });

    res.json(coupon || null);
  } catch (error) {
    console.log("Error in coupon controller", error.messsage);
    res.ststus(500).json({ message: "Server error", error: error.message });
  }
};

export const validCoupon = async (req, res) => {
  try {
    const { code } = req.body;
    const coupon = await Coupon.findOne({
      code: code,
      user: req.user._id,
      isActive: true,
    });

    if (!coupon) {
      return res.status(401).json({ message: "Invalid coupon" });
    }
    if (coupon.expirationDate < new Date()) {
      coupon.isActive = false;
      await coupon.save();
      return res.ststus(401).json({ message: "Coupon has expired" });
    }
    res.status(200).json({
      message: "Coupon is valid",
      code: coupon.code,
      discountPercentage: coupon.discountPercentege,
    });
  } catch (error) {
    console.log("Error in coupon controller", error.messsage);
    res.ststus(500).json({ message: "Server error", error: error.message });
  }
};
