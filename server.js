import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* -----------------------------
   IN-MEMORY STORE (replace later with DB)
------------------------------*/
let stock = {
  hoodie: 10,
  sneakers: 5
};

/* -----------------------------
   UNIVERSAL DROP TIMER
------------------------------*/
let dropTime = Date.now() + 3 * 60 * 60 * 1000;

/* -----------------------------
   STRIPE (REAL PAYMENTS)
------------------------------*/
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* -----------------------------
   GET DROP TIME
------------------------------*/
app.get("/api/drop-time", (req, res) => {
  res.json({ dropTime });
});

/* -----------------------------
   GET STOCK
------------------------------*/
app.get("/api/stock", (req, res) => {
  res.json(stock);
});

/* -----------------------------
   CREATE ORDER → STRIPE CHECKOUT
------------------------------*/
app.post("/api/create-order", async (req, res) => {
  const { itemId } = req.body;

  if (!stock[itemId] || stock[itemId] <= 0) {
    return res.status(400).json({ error: "Out of stock" });
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: itemId
          },
          unit_amount: itemId === "hoodie" ? 5000 : 12000
        },
        quantity: 1
      }
    ],
    success_url: "https://YOUR_FRONTEND/success.html",
    cancel_url: "https://YOUR_FRONTEND/cancel.html"
  });

  res.json({ checkoutUrl: session.url });
});

/* -----------------------------
   STRIPE WEBHOOK (CONFIRMED PAYMENT)
   - THIS IS WHERE STOCK DECREASE HAPPENS
------------------------------*/
app.post("/api/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const event = JSON.parse(req.body);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // EXAMPLE: parse item
    const itemId = "hoodie"; // you can pass metadata later

    if (stock[itemId] > 0) {
      stock[itemId]--;
      console.log("Stock updated:", stock);
    }
  }

  res.json({ received: true });
});

/* -----------------------------
   START SERVER
------------------------------*/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on", PORT));
