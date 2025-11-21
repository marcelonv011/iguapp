// src/pages/Home.jsx
import React, { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl, asARS } from "@/utils";
import { useQuery } from "@tanstack/react-query";
import { useAuthUser } from "@/hooks/useAuthUser";
import { toast } from "sonner";
import {
  Briefcase,
  Building2,
  ShoppingBag,
  Store,
  UtensilsCrossed,
  ArrowRight,
  TrendingUp,
  Star,
  MapPin,
  Clock,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";

// ===== Firebase para filtrar por suscripción =====
import { db } from "@/firebase";
import {
  collection,
  getDocs,
  query as fsQuery,
  where,
  orderBy,
  limit,
} from "firebase/firestore";

// ==== Helpers de fecha / suscripción ====
const toJsDate = (v) => {
  if (!v) return null;
  if (v?.toDate) return v.toDate(); // Timestamp de Firestore
  if (v?.seconds) return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d) ? null : d;
};

const isExpired = (end) => {
  const d = toJsDate(end);
  // si no hay fecha, lo consideramos vencido
  return d ? d.getTime() < Date.now() : true;
};

/**
 * Recibe una lista de publicaciones y deja solo las
 * que pertenecen a usuarios con suscripción activa y no vencida.
 * Usa el campo `created_by` de cada publicación.
 */
async function filterPubsByActiveSubscription(list) {
  if (!list.length) return [];

  // emails únicos de creadores
  const emails = [...new Set(list.map((p) => p.created_by).filter(Boolean))];
  if (!emails.length) return [];

  const resultByEmail = {};

  await Promise.all(
    emails.map(async (email) => {
      try {
        const qSub = fsQuery(
          collection(db, "subscriptions"),
          where("user_email", "==", email)
        );
        const snap = await getDocs(qSub);
        if (snap.empty) return;

        const docs = snap.docs.map((d) => d.data());

        // elegir la suscripción con end_date más lejana
        const pickBest = (arr) =>
          arr.reduce((best, cur) => {
            const getMs = (x) =>
              x?.toDate
                ? x.toDate().getTime()
                : x?.seconds
                ? x.seconds * 1000
                : x
                ? new Date(x).getTime()
                : -Infinity;
            return getMs(cur.end_date) > getMs(best?.end_date) ? cur : best;
          }, null);

        const sub = pickBest(docs);
        if (!sub) return;

        const expired = isExpired(sub.end_date);
        resultByEmail[email] = { sub, expired };
      } catch (e) {
        console.error("[home] error leyendo suscripción de", email, e);
      }
    })
  );

  // Sólo dejamos publicaciones de usuarios con plan activo y no vencido
  return list.filter((p) => {
    const info = resultByEmail[p.created_by];
    if (!info) return false; // sin suscripción → no muestra
    if (info.sub.status !== "active") return false;
    if (info.expired) return false;
    return true;
  });
}

/**
 * Igual que arriba pero para restaurantes.
 * Usa el campo `owner_email` de cada restaurante.
 */
async function filterRestaurantsByActiveSubscription(list) {
  if (!list.length) return [];

  const emails = [...new Set(list.map((r) => r.owner_email).filter(Boolean))];
  if (!emails.length) return [];

  const resultByEmail = {};

  await Promise.all(
    emails.map(async (email) => {
      try {
        const qSub = fsQuery(
          collection(db, "subscriptions"),
          where("user_email", "==", email)
        );
        const snap = await getDocs(qSub);
        if (snap.empty) return;

        // Traemos todas las subs de ese mail
        const allSubs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // 🔹 Nos quedamos SOLO con planes de restaurante
        const restaurantSubs = allSubs.filter(
          (s) => s.plan_type && s.plan_type.startsWith("restaurant")
        );

        if (restaurantSubs.length === 0) return;

        // Elegimos la sub con end_date más lejana
        const pickBest = (arr) =>
          arr.reduce((best, cur) => {
            const getMs = (x) =>
              x?.toDate
                ? x.toDate().getTime()
                : x?.seconds
                ? x.seconds * 1000
                : x
                ? new Date(x).getTime()
                : -Infinity;
            return getMs(cur.end_date) > getMs(best?.end_date) ? cur : best;
          }, null);

        const sub = pickBest(restaurantSubs);
        if (!sub) return;

        const expired = isExpired(sub.end_date);
        resultByEmail[email] = { sub, expired };
      } catch (e) {
        console.error("[home] error leyendo suscripción (rest) de", email, e);
      }
    })
  );

  // 🔹 Solo restaurantes con plan de restaurante ACTIVO y NO vencido
  return list.filter((r) => {
    const info = resultByEmail[r.owner_email];
    if (!info) return false;
    if (info.sub.status !== "active") return false;
    if (info.expired) return false;
    return true;
  });
}

// ==== Fetch destacado para Home (Publicaciones) ====
async function fetchHomeFeaturedPublications() {
  const col = collection(db, "publications");

  const normalize = (d) => {
    const r = d.data();
    return {
      id: d.id,
      ...r,
      created_date: r?.created_date?.toDate
        ? r.created_date.toDate()
        : r?.created_date
        ? new Date(r.created_date)
        : new Date(0),
    };
  };

  const tryQuery = async (q) => {
    const snap = await getDocs(q);
    return snap.docs.map(normalize);
  };

  // 1) featured + status=active + orderBy + limit
  try {
    const q1 = fsQuery(
      col,
      where("featured", "==", true),
      where("status", "==", "active"),
      orderBy("created_date", "desc"),
      limit(6)
    );
    const r1 = await tryQuery(q1);
    if (r1.length > 0) {
      const filtered = await filterPubsByActiveSubscription(r1);
      return filtered;
    }
  } catch (e) {
    console.warn("[home] q1 destacadas falló:", e?.code || e);
  }

  // 2) Solo featured + active (sin orderBy, por si falta índice)
  try {
    const q2 = fsQuery(
      col,
      where("featured", "==", true),
      where("status", "==", "active")
    );
    const r2 = await tryQuery(q2);
    if (r2.length > 0) {
      r2.sort((a, b) => b.created_date - a.created_date);
      const filtered = await filterPubsByActiveSubscription(r2);
      return filtered;
    }
  } catch (e) {
    console.warn("[home] q2 destacadas falló:", e?.code || e);
  }

  // 3) Fallback muy simple: todas las featured
  try {
    const q3 = fsQuery(col, where("featured", "==", true));
    const r3 = await tryQuery(q3);
    if (r3.length > 0) {
      r3.sort((a, b) => b.created_date - a.created_date);
      const filtered = await filterPubsByActiveSubscription(r3);
      return filtered;
    }
  } catch (e) {
    console.warn("[home] q3 fallback destacadas falló:", e?.code || e);
  }

  return [];
}

// ==== Fetch destacado para Home (Restaurantes) ====
async function fetchHomeFeaturedRestaurants() {
  const col = collection(db, "restaurants");

  const normalize = (d) => {
    const r = d.data();
    return {
      id: d.id,
      ...r,
      createdAt: r?.createdAt?.toDate
        ? r.createdAt.toDate()
        : r?.createdAt
        ? new Date(r.createdAt)
        : new Date(0),
    };
  };

  const tryQuery = async (q) => {
    const snap = await getDocs(q);
    return snap.docs.map(normalize);
  };

  // 👉 helper: le agrega promedio de rating y ordena por rating desc, devolviendo solo 3
  const attachRatingsAndSort = async (list) => {
    if (!list.length) return [];

    // Traemos TODAS las reseñas (si después tenés MUCHÍSIMAS, se puede optimizar)
    const snap = await getDocs(collection(db, "restaurant_reviews"));

    const map = {}; // { [restaurant_id]: { sum, count, avg } }

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const restId = data.restaurant_id;
      const rating = Number(data.rating || 0);
      if (!restId || !rating) return;

      if (!map[restId]) {
        map[restId] = { sum: 0, count: 0, avg: 0 };
      }
      map[restId].sum += rating;
      map[restId].count += 1;
    });

    Object.keys(map).forEach((id) => {
      const { sum, count } = map[id];
      map[id].avg = count > 0 ? sum / count : 0;
    });

    const withRatings = list.map((r) => {
      const info = map[r.id] || { avg: 0, count: 0 };
      return {
        ...r,
        rating_avg: info.avg,
        rating_count: info.count,
      };
    });

    // Ordenar por promedio de rating (desc) y quedarnos con los 3 mejores
    withRatings.sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0));

    return withRatings.slice(0, 3);
  };

  // 1) Restaurantes aprobados, abiertos
  try {
    const q1 = fsQuery(
      col,
      where("status", "==", "approved"),
      where("is_open", "==", true),
      orderBy("createdAt", "desc"),
      limit(20) // traemos algunos y después filtramos + top 3
    );
    let r1 = await tryQuery(q1);
    if (r1.length > 0) {
      const filtered = await filterRestaurantsByActiveSubscription(r1);
      return await attachRatingsAndSort(filtered);
    }
  } catch (e) {
    console.warn("[home] q1 restaurantes destacados falló:", e?.code || e);
  }

  // 2) Fallback: todos los aprobados, ordenados por fecha
  try {
    const q2 = fsQuery(col, where("status", "==", "approved"));
    let r2 = await tryQuery(q2);
    if (r2.length > 0) {
      r2.sort((a, b) => b.createdAt - a.createdAt);
      const filtered = await filterRestaurantsByActiveSubscription(r2);
      return await attachRatingsAndSort(filtered);
    }
  } catch (e) {
    console.warn("[home] q2 restaurantes destacados falló:", e?.code || e);
  }

  return [];
}

export default function Home() {
  const { user, loadingUser } = useAuthUser();

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const goToLogin = () => navigate("/login");

  // 👇 NUEVO: estado para el modal de modo testing
  const [showTestingModal, setShowTestingModal] = React.useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");

    if (paymentStatus === "success") {
      // Borramos el query param y vamos al home limpio
      navigate("/", { replace: true });
    }
  }, []);

  useEffect(() => {
    const payment = searchParams.get("payment");
    if (!payment) return;

    if (payment === "success") {
      toast.success("Pago realizado con éxito. Tu plan ya está activo 🎉");
    } else if (payment === "failure") {
      toast.error("El pago falló o fue cancelado.");
    } else if (payment === "pending") {
      toast("Tu pago quedó pendiente. Cuando se apruebe se activará el plan.");
    }

    // Limpio los parámetros para volver a "/" pelado
    setSearchParams({});
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setShowTestingModal(true);
  }, []);

  // Publicaciones destacadas (con filtro de suscripción)
  const { data: publications = [], isLoading: loadingPubs } = useQuery({
    queryKey: ["featured-publications"],
    queryFn: fetchHomeFeaturedPublications,
  });

  const mainPub = publications[0] || null;
  const otherPubs = publications.slice(1);

  // Restaurantes destacados
  const { data: restaurants = [], isLoading: loadingRests } = useQuery({
    queryKey: ["featured-restaurants"],
    queryFn: fetchHomeFeaturedRestaurants,
  });

  const categories = [
    {
      name: "Empleos",
      icon: Briefcase,
      description: "Encontrá tu próximo trabajo",
      color: "from-blue-500 to-blue-600",
      href: createPageUrl("Empleos"),
    },
    {
      name: "Alquileres",
      icon: Building2,
      description: "Casas, deptos y más",
      color: "from-purple-500 to-purple-600",
      href: createPageUrl("Alquileres"),
    },
    {
      name: "Ventas",
      icon: ShoppingBag,
      description: "Comprá y vendé",
      color: "from-green-500 to-green-600",
      href: createPageUrl("Ventas"),
    },
    {
      name: "Emprendimientos",
      icon: Store,
      description: "Descubrí negocios locales",
      color: "from-orange-500 to-orange-600",
      href: createPageUrl("Emprendimientos"),
    },
    {
      name: "Delivery",
      icon: UtensilsCrossed,
      description: "Pedí comida a domicilio",
      color: "from-red-500 to-red-600",
      href: createPageUrl("Delivery"),
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Modal Modo Testing */}
      <Dialog
        open={showTestingModal}
        onOpenChange={(open) => setShowTestingModal(open)}
      >
        <DialogContent className="max-w-lg border border-red-500 bg-red-50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              ConectCity en modo TESTING (GRATUITO)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm text-red-800">
            <p className="font-semibold">
              La plataforma está en fase de pruebas. El acceso y las
              publicaciones son <span className="underline">gratuitas</span> por
              ahora.
            </p>

            <ul className="list-disc list-inside space-y-1">
              <li>
                Si encontrás algún error o algo raro, por favor escribinos a{" "}
                <span className="font-semibold">conectcity1@gmail.com</span>.
              </li>

              <li>
                Cuando te registrás e iniciás sesión, un{" "}
                <strong>moderador</strong> revisa y aprueba tu cuenta antes de
                que puedas empezar a publicar{" "}
                <strong>empleos, alquileres, ventas y emprendimientos</strong>.
              </li>

              <li>
                Si querés publicar tu <strong>restaurante o delivery</strong>,
                también debe ser
                <strong> aprobado manualmente por un moderador</strong> antes de
                aparecer en la app.
              </li>

              <li>
                En el futuro, algunas funciones pasarán a ser{" "}
                <strong>pagas</strong>, pero por ahora estamos en modo testing
                abierto.
              </li>
            </ul>

            <p className="text-xs text-red-600/80">
              Gracias por ayudar a probar ConectCity. Tus comentarios nos sirven
              muchísimo para mejorar la plataforma.
            </p>

            <div className="flex justify-end pt-2">
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  setShowTestingModal(false);
                  try {
                    localStorage.setItem("cc_testing_notice_seen", "1");
                  } catch {}
                }}
              >
                Entendido
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* ===== Hero Section ===== */}
      <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-purple-800 text-white py-20 overflow-hidden">
        {/* blobs decorativos */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-300 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <Badge className="mb-4 bg-white/20 text-white border-white/30">
              <TrendingUp className="w-3 h-3 mr-1" />
              Tu ciudad conectada
            </Badge>

            <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight tracking-tight">
              Todo lo que necesitás
              <br />
              <span className="gradient-title">en un solo lugar</span>
            </h1>

            <p className="text-xl md:text-2xl text-blue-100 mb-8">
              Empleos, alquileres, ventas, emprendimientos y delivery
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                variant="white"
                className="shadow-xl hover:shadow-2xl"
                onClick={() =>
                  document
                    .getElementById("cats")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Explorar Categorías
              </Button>

              {!loadingUser && !user && (
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white text-white hover:bg-white/10"
                  onClick={goToLogin}
                >
                  Crear Cuenta
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===== Categories Grid ===== */}
      <section
        id="cats"
        className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Explorá por Categoría
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Link key={category.name} to={category.href}>
                <Card className="group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border-white/70 bg-white/80 backdrop-blur-xl overflow-hidden h-full">
                  <CardContent className="p-6">
                    <div
                      className={`w-16 h-16 bg-gradient-to-br ${category.color} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}
                    >
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">
                      {category.name}
                    </h3>
                    <p className="text-slate-600 mb-4">
                      {category.description}
                    </p>
                    <div className="flex items-center text-blue-600 font-medium group-hover:gap-3 gap-2 transition-all">
                      Ver más
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ===== Featured Publications ===== */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                Publicaciones Destacadas
              </h2>
              <p className="text-slate-600">
                Las mejores oportunidades elegidas para vos
              </p>
            </div>
            <div className="flex items-center gap-2 text-amber-500">
              <Star className="w-7 h-7 fill-amber-400" />
              <span className="font-semibold">Destacadas</span>
            </div>
          </div>

          {loadingPubs ? (
            <p className="text-slate-500">Cargando publicaciones…</p>
          ) : !mainPub ? (
            <p className="text-slate-500">
              No hay publicaciones destacadas por ahora.
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Tarjeta principal */}
              <Card className="lg:col-span-2 relative overflow-hidden border border-amber-100 shadow-sm bg-white">
                <div className="relative z-10 flex flex-col md:flex-row gap-4 p-5">
                  {/* Imagen reducida */}
                  {mainPub.images?.[0] && (
                    <div className="shrink-0 w-full md:w-44 h-40 md:h-40 rounded-xl overflow-hidden bg-slate-100">
                      <img
                        src={mainPub.images[0]}
                        alt={mainPub.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Texto / info */}
                  <div className="flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge className="bg-amber-500 text-white flex items-center gap-1">
                          <Star className="w-3 h-3 fill-white" />
                          Destacada
                        </Badge>
                        {mainPub.category && (
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200 capitalize">
                            {mainPub.category}
                          </Badge>
                        )}
                        {mainPub.location && (
                          <span className="inline-flex items-center text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
                            <MapPin className="w-3 h-3 mr-1" />
                            <span className="truncate max-w-[160px] md:max-w-[220px]">
                              {mainPub.location}
                            </span>
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] uppercase tracking-[0.18em] text-amber-600 font-semibold mb-1">
                        Oportunidad destacada
                      </p>

                      <h3 className="text-xl md:text-2xl font-extrabold text-slate-900 mb-2 leading-snug line-clamp-2">
                        {mainPub.title}
                      </h3>

                      {mainPub.description && (
                        <p className="text-slate-600 text-sm mb-1 line-clamp-2">
                          {mainPub.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {typeof mainPub.price === "number" ? (
                        <p className="text-2xl font-extrabold text-emerald-600">
                          {asARS(mainPub.price)}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-500">
                          Consultar precio
                        </p>
                      )}

                      {mainPub.contact_phone && (
                        <p className="text-xs text-slate-500">
                          Contacto:{" "}
                          <span className="font-medium">
                            {mainPub.contact_phone}
                          </span>
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-1">
                      {mainPub.category === "empleo" && (
                        <Badge
                          variant="outline"
                          className="text-[11px] border-blue-200 text-blue-700 bg-blue-50"
                        >
                          Ideal para conseguir trabajo
                        </Badge>
                      )}
                      {mainPub.category === "alquiler" && (
                        <Badge
                          variant="outline"
                          className="text-[11px] border-purple-200 text-purple-700 bg-purple-50"
                        >
                          Oportunidad para mudarte
                        </Badge>
                      )}
                      {mainPub.category === "venta" && (
                        <Badge
                          variant="outline"
                          className="text-[11px] border-emerald-200 text-emerald-700 bg-emerald-50"
                        >
                          Oferta especial
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Otras destacadas */}
              <div className="space-y-4">
                {otherPubs.length === 0 ? (
                  <Card className="h-full flex items-center justify-center border-dashed border-slate-200">
                    <CardContent className="text-center text-slate-500">
                      No hay más destacadas por ahora.
                    </CardContent>
                  </Card>
                ) : (
                  otherPubs.map((pub) => (
                    <Card
                      key={pub.id}
                      className="flex gap-3 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all border border-slate-100 bg-white"
                    >
                      {pub.images?.[0] && (
                        <div className="w-24 h-24 shrink-0 overflow-hidden bg-slate-100">
                          <img
                            src={pub.images[0]}
                            alt={pub.title}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <CardContent className="py-3 px-3 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <h4 className="font-semibold text-sm text-slate-900 line-clamp-1">
                              {pub.title}
                            </h4>
                            {pub.category && (
                              <Badge className="capitalize text-[10px] px-2 py-0.5">
                                {pub.category}
                              </Badge>
                            )}
                          </div>
                          {pub.description && (
                            <p className="text-xs text-slate-600 line-clamp-2">
                              {pub.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          {typeof pub.price === "number" ? (
                            <span className="text-sm font-bold text-emerald-600">
                              {asARS(pub.price)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">
                              Consultar precio
                            </span>
                          )}
                          {pub.location && (
                            <div className="flex items-center text-[11px] text-slate-500">
                              <MapPin className="w-3 h-3 mr-1" />
                              <span className="truncate max-w-[120px]">
                                {pub.location}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ===== Featured Restaurants ===== */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                Restaurantes Destacados
              </h2>
              <p className="text-slate-600">
                Pedí comida de los mejores lugares de tu ciudad
              </p>
            </div>
            <Link to={createPageUrl("Delivery")}>
              <Button variant="outline">
                Ver todos
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          {loadingRests ? (
            <p className="text-slate-500">Cargando restaurantes…</p>
          ) : restaurants.length === 0 ? (
            <p className="text-slate-500">
              No hay restaurantes destacados por ahora.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {restaurants.map((restaurant) => (
                <Link
                  key={restaurant.id}
                  to={`${createPageUrl("Delivery")}/${restaurant.id}`}
                >
                  <Card className="hover:shadow-xl hover:-translate-y-1 transition-all group overflow-hidden">
                    <div className="h-40 bg-gradient-to-br from-orange-400 to-red-500 relative overflow-hidden">
                      {restaurant.cover_image ? (
                        <img
                          src={restaurant.cover_image}
                          alt={restaurant.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <UtensilsCrossed className="w-16 h-16 text-white opacity-50" />
                        </div>
                      )}
                      {restaurant.logo_url && (
                        <div className="absolute bottom-0 left-4 translate-y-1/2">
                          <div className="w-16 h-16 rounded-full bg-white p-1 shadow-lg">
                            <img
                              src={restaurant.logo_url}
                              alt=""
                              className="w-full h-full object-cover rounded-full"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <CardContent className="pt-10 pb-6 px-4">
                      <h3 className="font-bold text-lg mb-1">
                        {restaurant.name}
                      </h3>
                      <p className="text-slate-600 text-sm mb-2 clamp-1">
                        {restaurant.description}
                      </p>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center text-slate-500">
                          <Clock className="w-4 h-4 mr-1" />
                          {restaurant.delivery_time || "30-45 min"}
                        </div>
                        <div className="flex items-center text-yellow-500">
                          <Star className="w-4 h-4 mr-1 fill-yellow-500" />
                          {restaurant.rating_count > 0 ? (
                            <>
                              <span className="text-sm font-semibold">
                                {restaurant.rating_avg.toFixed(1)}
                              </span>
                              <span className="text-[11px] text-slate-500 ml-1">
                                ({restaurant.rating_count})
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-slate-500">
                              Sin valoraciones
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== CTA Admins ===== */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            ¿Querés publicar tu negocio o servicio?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Elegí un plan y empezá a aparecer en ConectCity.
          </p>
          <div className="mt-4">
            <Link to="/planes-publicar">
              <Button size="lg" className="rounded-xl" variant="white">
                Ver planes para publicar
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
