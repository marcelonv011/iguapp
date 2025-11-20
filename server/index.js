require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MercadoPagoConfig, Preference } = require("mercadopago");

const app = express();

// CORS solo permite tu frontend
app.use(
  cors({
    origin: "http://localhost:5173",
  })
);
app.use(express.json());

// 🔑 Configurar Mercado Pago (SDK v2)
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN, // APP_USR-xxxxxxxx
});

// Ruta para crear preferencia
app.post("/create-preference", async (req, res) => {
  try {
    const { plan_type, user_email } = req.body;

    console.log("👉 Petición recibida:", { plan_type, user_email });

    // Precios reales
    const PRICES = {
      publications_basic: 100,
      publications_intermediate: 25000,
      publications_pro: 50000,
      restaurant_mensual: 25000,
    };

    const amount = PRICES[plan_type];
    if (!amount) {
      console.error("❌ plan_type inválido:", plan_type);
      return res.status(400).json({ error: "plan_type inválido" });
    }

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
        success: "http://localhost:5173/planes-publicar",
        failure: "http://localhost:5173/planes-publicar",
        pending: "http://localhost:5173/planes-publicar",
      },

      // Después podemos activarlo otra vez
      // auto_return: "approved",
    };

    const preference = new Preference(mpClient);
    const result = await preference.create({ body: preferenceData });

    console.log("✅ Respuesta de MP:", result);

    // Para evitar problemas con el SDK, probamos varias opciones
    const initPoint =
      result.init_point ||
      result.sandbox_init_point ||
      result?.body?.init_point ||
      result?.body?.sandbox_init_point;

    if (!initPoint) {
      console.error("⚠️ MercadoPago NO devolvió init_point");
      return res
        .status(500)
        .json({ error: "MercadoPago no devolvió init_point" });
    }

    res.json({ init_point: initPoint });
  } catch (error) {
    console.error("❌ ERROR EN MERCADO PAGO:", error);
    res.status(500).json({ error: "Error al crear preferencia" });
  }
});

// Levantar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("🚀 Servidor MercadoPago corriendo en puerto " + PORT);
});
