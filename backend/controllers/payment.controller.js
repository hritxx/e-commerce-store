import { stripe } from "../lib/stripe.js";
import Coupon from "../models/coupon.model.js";
import Order from "../models/order.model.js";

export const createCheckoutSession = async (req, res) => {
  try {
    const { products, couponCode } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: "No products in cart" });
    }
    let totalAmount = 0;

    const lineItems = products.map((product) => {
      const amount = Math.round(product.price * 100);
      totalAmount += amount * product.quantity;

      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: product.name,
            images: [product.image],
          },
          unit_amount: amount,
        },
        quantity: product.quantity || 1,
      };
    });

    let coupon = null;

    if (couponCode) {
      coupon = await Coupon.findOne({
        code: couponCode,
        user: req.user._id,
        isActive: true,
      });
      if (coupon) {
        totalAmount -= Math.round(
          (totalAmount * coupon.discountPercentage) / 100
        );
      }
    }
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/purchase-failed`,
      customer_email: req.user.email,
      discounts: coupon
        ? [
            {
              coupon: await createStripeCoupon(coupon.discountPercentage),
            },
          ]
        : [],
      metadata: {
        userId: req.user._id.toString(),
        couponCode: couponCode || "",
        products: JSON.stringify({
          products: products.map((product) => ({
            id: product._id,
            name: product.name,
            quantity: product.quantity,
          })),
        }),
      },
    });
    if (totalAmount >= 15000) {
      await createNewCoupon(req.user._id);
    }
    res.status(200).json({ id: session.id, totalAmount: totalAmount / 100 });
  } catch (error) {
    console.log("Error in createCheckoutSession controller", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const checkoutSuccess = async (req, res) => {
  try {
    const { sessionId } = req.body;

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid") {
      if (session.metadata.couponCode) {
        await Coupon.findOneAndUpdate(
          {
            code: session.metadata.couponCode,
            userId: session.metadata.userId,
          },
          { isActive: false }
        );
      }

      const products = JSON.parse(session.metadata.products);
      const order = new Order({
        user: session.metadata.userId,
        products: products.map((product) => ({
          product: product.id,
          quantity: product.quantity,
          price: product.price,

          stripeSessionId: sessionId,
        })),
        totalAmount: session.amount_total / 100,
        stripeSessionId: sessionId,
      });
      await newOrder.save();

      res.status(200).json({
        success: true,
        message:
          "Payment successful,order created and coupon deactivated if used",
        orderId: newOrder._id,
      });
    }
  } catch (error) {
    console.log("Error in checkoutSuccess controller", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

async function createStripeCoupon(discountPercentage) {
  const stripeCoupon = await stripe.coupons.create({
    percent_off: discountPercentage,
    duration: "once",
  });

  return stripeCoupon.id;
}

async function createNewCoupon(userId) {
  await Coupon.findOneAndDelete({ user: userId });
  const newCoupon = new Coupon({
    code: "GIFT" + Math.floor(Math.random() * 1000),
    discountPercentage: 10,
    expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    user: userId,
  });

  await newCoupon.save();
  return newCoupon;
}
