require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const admin = require("firebase-admin");

// 🔹 Importar rutas OAuth
const mpOAuthRoutes = require("./mercadopago");

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);
app.use(express.json());

// 🔹 FRONTEND BASE URL
const FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL || "http://localhost:5173";

// ========= FIREBASE ADMIN =========
if (!admin.apps.length) {
  const serviceAccount = require("./serviceAccount.json");

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

// ========= MERCADO PAGO (planes actuales) =========
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

// ========= MONTAR RUTAS OAUTH MP =========
app.use("/mercadopago", mpOAuthRoutes);

// ================================
// CONFIGURACIÓN DE PLANES
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
  if (!cfg) return console.warn("Plan no configurado:", planType);

  const userRef = db.collection("users").doc(userId);
  const snap = await userRef.get();
  if (!snap.exists) return console.warn("Usuario no encontrado:", userId);

  const userData = snap.data();
  const email = userData.email;

  if (userData.role_type !== "superadmin") {
    await userRef.update({ role_type: "admin" });
    console.log("✅ Rol actualizado a admin:", email);
  }

  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + cfg.months);

  const subData = {
    user_email: email,
    plan_type: planType,
    product_type: cfg.product_type,
    plan_tier: cfg.plan_tier,
    start_date: admin.firestore.Timestamp.fromDate(now),
    end_date: admin.firestore.Timestamp.fromDate(end),
    status: "active",
    payment_id: paymentId || "optional",
  };

  if (cfg.product_type === "publications") {
    subData.publications_limit = cfg.publications_limit;
    subData.publications_used = 0;
  }

  await db.collection("subscriptions").add(subData);
  console.log("✅ Suscripción creada:", subData);
}

// ========= CREAR PREFERENCIA PLANES =========
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
    if (!amount) return res.status(400).json({ error: "plan_type inválido" });

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
        success: `${FRONTEND_BASE_URL}/?payment=success`,
        failure: `${FRONTEND_BASE_URL}/?payment=failure`,
        pending: `${FRONTEND_BASE_URL}/?payment=pending`,
      },
      external_reference: `${user_id}|${plan_type}`,
      notification_url: `${process.env.BASE_URL}/webhook-mercadopago`,
    };

    const preference = new Preference(mpClient);
    const result = await preference.create({ body: preferenceData });

    res.json({
      init_point:
        result.init_point ||
        result.sandbox_init_point ||
        result?.body?.init_point ||
        result?.body?.sandbox_init_point,
    });
  } catch (error) {
    console.error("❌ Error en create-preference:", error);
    res.status(500).json({ error: "Error al crear preferencia" });
  }
});

// =====================================================
// FUNCIÓN PARA CALCULAR COMISIÓN QUE PAGA EL CLIENTE
// =====================================================
function calcularComisionCorrecta(montoNeto) {
  const tasa = 0.0629; // 6,29 %
  return +(montoNeto / (1 - tasa) - montoNeto).toFixed(2);
}

// ========= CREAR PREFERENCIA PARA DELIVERY =========
app.post("/delivery/create-order-mp", async (req, res) => {
  try {
    const { order, order_id } = req.body;

    if (!order) return res.status(400).json({ error: "order es requerido" });

    const items = order.items || [];
    if (!items.length)
      return res.status(400).json({ error: "El pedido no tiene items" });

    const restaurantId = order.restaurant_id;
    if (!restaurantId)
      return res.status(400).json({ error: "restaurant_id es requerido" });

    // 🔥 Obtener restaurante
    const restaurantSnap = await db
      .collection("restaurants")
      .doc(restaurantId)
      .get();

    if (!restaurantSnap.exists)
      return res.status(404).json({ error: "Restaurante no encontrado" });

    const restaurantData = restaurantSnap.data();

    if (!restaurantData.mp_connected || !restaurantData.mp_access_token) {
      return res.status(400).json({
        error: "El restaurante no tiene Mercado Pago conectado",
      });
    }

    // Cliente MP del restaurante
    const restaurantMpClient = new MercadoPagoConfig({
      accessToken: restaurantData.mp_access_token,
    });

    const preference = new Preference(restaurantMpClient);

    // ---------------------
    // CALCULAR ITEMS + COMISIÓN
    // ---------------------
    const baseItems = items.map((it) => ({
      title: it.name,
      unit_price: Number(it.price),
      quantity: it.quantity,
      currency_id: "ARS",
    }));

    const productsSubtotal = items.reduce(
      (sum, it) => sum + Number(it.price) * it.quantity,
      0
    );

    // Envío
    const deliveryFee = Number(order.delivery_fee || 0);
    if (deliveryFee > 0) {
      baseItems.push({
        title: "Envío",
        unit_price: deliveryFee,
        quantity: 1,
        currency_id: "ARS",
      });
    }

    // 🧮 COMISIÓN REAL → EL CLIENTE LA PAGA
    const commissionBase = productsSubtotal + deliveryFee;
    const commissionAmount = calcularComisionCorrecta(commissionBase);

    if (commissionAmount > 0) {
      baseItems.push({
        title: "Comisión Mercado Pago (6,29%)",
        unit_price: commissionAmount,
        quantity: 1,
        currency_id: "ARS",
      });
    }

    // ---------------------
    // PREFERENCIA MP
    // ---------------------
    const preferenceBody = {
      items: baseItems,
      back_urls: {
        success: `${FRONTEND_BASE_URL}/mis-pedidos?payment=success`,
        failure: `${FRONTEND_BASE_URL}/mis-pedidos?payment=failure`,
        pending: `${FRONTEND_BASE_URL}/mis-pedidos?payment=pending`,
      },
      external_reference: order_id ? `order|${order_id}` : undefined,
      notification_url: `${process.env.BASE_URL}/webhook-mercadopago`,
    };

    const result = await preference.create({ body: preferenceBody });

    res.json({
      init_point:
        result.init_point ||
        result.sandbox_init_point ||
        result?.body?.init_point ||
        result?.body?.sandbox_init_point,
    });
  } catch (error) {
    console.error("❌ Error en /delivery/create-order-mp:", error);
    res
      .status(500)
      .json({ error: "Error al crear preferencia de delivery" });
  }
});

// ========= WEBHOOK =========
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
        const [userId, planType] =
          payment.external_reference?.split("|") || [];
        if (userId && planType) {
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
