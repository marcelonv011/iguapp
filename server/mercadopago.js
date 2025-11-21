// routes/mercadopago.js
const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");

const router = express.Router();

// ⚙️ Variables de entorno (asegurate de que estén en el .env del server)
const MP_CLIENT_ID = process.env.MP_CLIENT_ID;
const MP_CLIENT_SECRET = process.env.MP_CLIENT_SECRET;
const MP_REDIRECT_URI = process.env.MP_REDIRECT_URI;
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL;

// GET /mercadopago/connect?restaurant_id=...
router.get("/connect", (req, res) => {
  const { restaurant_id } = req.query;

  if (!restaurant_id) {
    return res.status(400).send("restaurant_id es requerido");
  }

  const baseAuthUrl = "https://auth.mercadopago.com/authorization";

  const params = new URLSearchParams({
    response_type: "code",
    client_id: MP_CLIENT_ID,
    redirect_uri: MP_REDIRECT_URI, // 👈 DEBE ser igual al de la app de MP
    state: restaurant_id,          // 👈 acá viaja el id del restaurante
    scope: "offline_access read_write",
  });

  const redirectUrl = `${baseAuthUrl}?${params.toString()}`;

  return res.redirect(redirectUrl);
});

// GET /mercadopago/callback?code=XXX&state=restaurant_id
router.get("/callback", async (req, res) => {
  const { code, state } = req.query; // state = restaurant_id

  if (!code || !state) {
    return res.status(400).send("Faltan parámetros");
  }

  try {
    const tokenUrl = "https://api.mercadopago.com/oauth/token";

    const body = {
      grant_type: "authorization_code",
      client_id: MP_CLIENT_ID,
      client_secret: MP_CLIENT_SECRET,
      code,
      redirect_uri: MP_REDIRECT_URI, // 👈 tiene que coincidir exacto
    };

    const { data } = await axios.post(tokenUrl, body, {
      headers: { "Content-Type": "application/json" },
    });

    const {
      access_token,
      refresh_token,
      user_id,
      expires_in,
      scope,
      token_type,
    } = data;

    const db = admin.firestore();

    // state = restaurant_id (doc de restaurants)
    await db.collection("restaurants").doc(state).set(
      {
        mp_connected: true,
        mp_user_id: user_id,
        mp_access_token: access_token,
        mp_refresh_token: refresh_token,
        mp_expires_in: expires_in,
        mp_scope: scope,
        mp_token_type: token_type,
        mp_last_sync: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 👇 Volvemos al frontend, por ejemplo /mi-restaurante?mp=connected
    return res.redirect(`${FRONTEND_BASE_URL}?mp=connected`);
  } catch (error) {
    console.error(
      "Error en callback de Mercado Pago:",
      error.response?.data || error.message
    );

    return res.redirect(`${FRONTEND_BASE_URL}?mp=error`);
  }
});

module.exports = router;
