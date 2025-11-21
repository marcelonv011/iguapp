require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

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

// ========= NODEMAILER (feedback / contacto) =========
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false, // true si usás 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});


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
      publications_basic: 16300,
      publications_intermediate: 27100,
      publications_pro: 54200,
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
// FUNCIÓN PARA CALCULAR COMISIÓN
// =====================================================
function calcularComisionCorrecta(montoNeto) {
  const tasa = 0.0629; // 6,29 %
  return +(montoNeto / (1 - tasa) - montoNeto).toFixed(2);
}

// ========= CREAR PREFERENCIA DELIVERY =========
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

    const restaurantMpClient = new MercadoPagoConfig({
      accessToken: restaurantData.mp_access_token,
    });

    const preference = new Preference(restaurantMpClient);

    // Calcular items
    const baseItems = items.map((it) => ({
      title: it.name,
      unit_price: Number(it.price),
      quantity: it.quantity,
      currency_id: "ARS",
    }));

    const subtotal = items.reduce(
      (acc, it) => acc + Number(it.price) * it.quantity,
      0
    );

    const deliveryFee = Number(order.delivery_fee || 0);

    if (deliveryFee > 0) {
      baseItems.push({
        title: "Envío",
        unit_price: deliveryFee,
        quantity: 1,
        currency_id: "ARS",
      });
    }

    const commissionAmount = calcularComisionCorrecta(subtotal + deliveryFee);

    if (commissionAmount > 0) {
      baseItems.push({
        title: "Comisión Mercado Pago (6,29%)",
        unit_price: commissionAmount,
        quantity: 1,
        currency_id: "ARS",
      });
    }

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

// ========= FEEDBACK / SUGERENCIAS / RECLAMOS =========
// body: { name, email, type, message }
app.post("/feedback", async (req, res) => {
  try {
    const { name, email, type, message } = req.body;

    if (!email || !message) {
      return res
        .status(400)
        .json({ error: "El email y el mensaje son obligatorios" });
    }

    const fromName = name?.trim() || "Usuario sin nombre";
    const typeLabel = type || "Sin especificar";

    const mailOptions = {
      from: `"ConectCity - Feedback" <${process.env.SMTP_USER}>`,
      to: process.env.FEEDBACK_TO || "conectcity1@gmail.com",
      subject: `Nuevo ${typeLabel} desde ConectCity`,
      text: `
Tipo: ${typeLabel}
Nombre: ${fromName}
Email de contacto: ${email}

Mensaje:
${message}
      `.trim(),
      html: `
        <h2>Nuevo ${typeLabel} desde ConectCity</h2>
        <p><strong>Nombre:</strong> ${fromName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Tipo:</strong> ${typeLabel}</p>
        <p><strong>Mensaje:</strong></p>
        <p style="white-space: pre-line;">${message}</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.json({ ok: true });
  } catch (err) {
    console.error("❌ Error al enviar feedback:", err);
    return res
      .status(500)
      .json({ error: "Hubo un error al enviar el mensaje" });
  }
});


// ========= WEBHOOK CORREGIDO =========
app.post("/webhook-mercadopago", async (req, res) => {
  try {
    console.log("📩 Webhook:", req.query, req.body);

    // tipo de evento (por si lo querés loguear o filtrar)
    const topic = req.query.topic || req.query.type || req.body.type;
    console.log("📌 topic:", topic);

    // ID del pago (puede venir en distintos lugares)
    const paymentId =
      req.query.id ||
      req.query["data.id"] ||
      req.body.data?.id;

    if (!paymentId) {
      console.log("⚠️ Sin paymentId, ignorado");
      return res.sendStatus(200);
    }

    const paymentClient = new Payment(mpClient);
    const payment = await paymentClient.get({ id: paymentId });

    console.log("💳 Pago recibido:", {
      id: payment.id,
      status: payment.status,
      external_reference: payment.external_reference,
    });

    if (payment.status !== "approved") {
      return res.sendStatus(200);
    }

    const external = payment.external_reference || "";

    // -------------------------
    // A) PAGO DE DELIVERY
    // external_reference = "order|<orderId>"
    // -------------------------
    if (external.startsWith("order|")) {
      const [, orderId] = external.split("|");

      console.log("📦 Pago de un PEDIDO:", orderId);

      try {
        await db.collection("orders").doc(orderId).update({
          status: "paid",
          payment_id: paymentId,
        });
        console.log("✅ Pedido marcado como pagado");
      } catch (err) {
        console.log("⚠️ No se pudo actualizar el pedido:", err);
      }

      return res.sendStatus(200);
    }

    // -------------------------
    // B) PAGO DE PLAN / SUSCRIPCIÓN
    // external_reference = "userId|planType"
    // -------------------------
    const [userId, planType] = external.split("|");

    if (userId && planType && PLAN_CONFIG[planType]) {
      console.log("🎉 Activando plan:", { userId, planType });
      await activarPlanUsuario(userId, planType, paymentId);
    } else {
      console.warn("❌ external_reference inválida o plan no configurado:", external);
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
