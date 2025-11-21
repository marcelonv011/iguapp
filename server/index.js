require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const admin = require("firebase-admin");

// 🔹 Importar rutas OAuth (nueva funcionalidad)
const mpOAuthRoutes = require("./mercadopago");

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);
app.use(express.json());

// ========= FIREBASE ADMIN =========
if (!admin.apps.length) {
  const serviceAccount = require("./serviceAccount.json");

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

// ========= MERCADO PAGO (para tus planes actuales) =========
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN, // ⚠️ el que ya usabas antes
});

// ========= MONTAR RUTAS OAUTH DE MERCADO PAGO =========
// /mercadopago/connect
// /mercadopago/callback
app.use("/mercadopago", mpOAuthRoutes);

// ================================
// CONFIGURACIÓN DE PLANES / SUSCRIPCIONES
// ================================
const PLAN_CONFIG = {
  publications_basic: {
    product_type: "publications",
    plan_tier: "basic",
    publications_limit: 3,
    months: 1,
  },
  publications_intermediate: {
    product_type: "publications",
    plan_tier: "intermediate",
    publications_limit: 6,
    months: 1,
  },
  publications_pro: {
    product_type: "publications",
    plan_tier: "pro",
    publications_limit: 12,
    months: 1,
  },
  restaurant_mensual: {
    product_type: "restaurant",
    plan_tier: "restaurant_mensual",
    months: 1,
  },
};

// ========= ACTIVAR PLAN USUARIO =========
async function activarPlanUsuario(userId, planType, paymentId) {
  console.log("🔥 activarPlanUsuario()", { userId, planType, paymentId });

  const cfg = PLAN_CONFIG[planType];
  if (!cfg) {
    console.warn("Plan no configurado:", planType);
    return;
  }

  const userRef = db.collection("users").doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    console.warn("Usuario no encontrado:", userId);
    return;
  }

  const userData = userSnap.data();
  const email = userData.email;

  if (userData.role_type !== "superadmin") {
    await userRef.update({ role_type: "admin" });
    console.log("✅ Rol actualizado a admin:", email);
  }

  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + (cfg.months || 1));

  const subDataBase = {
    user_email: email,
    plan_type: planType,
    product_type: cfg.product_type,
    plan_tier: cfg.plan_tier,
    start_date: admin.firestore.Timestamp.fromDate(now),
    end_date: admin.firestore.Timestamp.fromDate(end),
    status: "active",
    payment_id: paymentId ?? "optional",
  };

  if (cfg.product_type === "publications") {
    subDataBase.publications_limit = cfg.publications_limit;
    subDataBase.publications_used = 0;
  }

  await db.collection("subscriptions").add(subDataBase);

  console.log("✅ Suscripción creada:", subDataBase);
}

// ========= CREAR PREFERENCIA PARA PLANES =========
app.post("/create-preference", async (req, res) => {
  try {
    const { plan_type, user_email, user_id } = req.body;

    const PRICES = {
      publications_basic: 10,
      publications_intermediate: 1,
      publications_pro: 2,
      restaurant_mensual: 2,
    };

    const amount = PRICES[plan_type];
    if (!amount)
      return res.status(400).json({ error: "plan_type inválido" });

    const preferenceData = {
      items: [
        {
          id: plan_type,
          title: `Suscripción ConectCity - ${plan_type}`,
          unit_price: amount,
          quantity: 1,
          currency_id: "ARS",
        },
      ],
      payer: { email: user_email },
      back_urls: {
        success: "http://localhost:5173/?payment=success",
        failure: "http://localhost:5173/?payment=failure",
        pending: "http://localhost:5173/?payment=pending",
      },
      external_reference: `${user_id}|${plan_type}`,
      notification_url: `${process.env.BASE_URL}/webhook-mercadopago`,
    };

    const preference = new Preference(mpClient);
    const result = await preference.create({ body: preferenceData });

    const initPoint =
      result.init_point ||
      result.sandbox_init_point ||
      result?.body?.init_point ||
      result?.body?.sandbox_init_point;

    if (!initPoint)
      return res
        .status(500)
        .json({ error: "MercadoPago no devolvió init_point" });

    res.json({ init_point: initPoint });
  } catch (error) {
    console.error("❌ Error en create-preference:", error);
    res.status(500).json({ error: "Error al crear preferencia" });
  }
});

// ========= WEBHOOK (tus planes) =========
app.post("/webhook-mercadopago", async (req, res) => {
  try {
    console.log("📩 Webhook:", req.query, req.body);

    const topic = req.query.type || req.body.type;

    if (topic === "payment") {
      const paymentId = req.query["data.id"] || req.body.data?.id;
      if (!paymentId) return res.sendStatus(400);

      const paymentClient = new Payment(mpClient);
      const payment = await paymentClient.get({ id: paymentId });

      if (payment.status === "approved") {
        const externalRef = payment.external_reference;
        if (externalRef) {
          const [userId, planType] = externalRef.split("|");
          await activarPlanUsuario(userId, planType, paymentId);
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error en webhook:", err);
    res.sendStatus(500);
  }
});

// ========= PUERTO =========
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("🚀 Servidor MercadoPago corriendo en puerto " + PORT);
});
