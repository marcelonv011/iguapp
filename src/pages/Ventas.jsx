// src/pages/Ventas.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ShoppingBag,
  MapPin,
  DollarSign,
  Search,
  Tag,
  Heart,
  Flag,
} from "lucide-react";
import { Textarea } from "@/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";

// Firebase
import { db, auth } from "@/firebase";
import {
  collection,
  getDocs,
  query as fsQuery,
  where,
  orderBy,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  addDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Link } from "react-router-dom";
import { toast } from "sonner";

// ========= Helper: obtiene ciudad desde location =========
// Soporta formatos tipo:
// "Av. Misiones 123, Puerto Iguazú"
// "Puerto Iguazú - Barrio Las Orquídeas"
// "Foz do Iguaçu, PR"
function getCityFromLocation(location) {
  if (!location) return null;
  let loc = location.toString().trim();

  // Primero cortamos por coma y nos quedamos con la última parte
  const commaParts = loc
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (commaParts.length > 0) {
    loc = commaParts[commaParts.length - 1];
  }

  // Si tiene guión, nos quedamos con la primera parte (antes del barrio)
  const dashParts = loc
    .split("-")
    .map((p) => p.trim())
    .filter(Boolean);
  if (dashParts.length > 0) {
    loc = dashParts[0];
  }

  return loc || null;
}

// ==== Fechas / suscripciones ====
const toJsDate = (v) => {
  if (!v) return null;
  if (v?.toDate) return v.toDate(); // Timestamp de Firestore
  if (v?.seconds) return new Date(v.seconds * 1000); // otro formato timestamp
  const d = new Date(v);
  return isNaN(d) ? null : d;
};

const isExpired = (end) => {
  const d = toJsDate(end);
  // si no hay fecha, consideramos vencida
  return d ? d.getTime() < Date.now() : true;
};

/**
 * Recibe una lista de publicaciones y deja solo las
 * que pertenecen a usuarios con suscripción activa y no vencida.
 */
async function filterByActiveSubscription(list) {
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

        // elegir la suscripción con end_date más lejana (igual que en AdminPanel)
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
        console.error("[ventas] error cargando sub de", email, e);
      }
    })
  );

  // Solo dejamos publicaciones de usuarios con plan activo y no vencido
  return list.filter((p) => {
    const info = resultByEmail[p.created_by];
    if (!info) return false; // sin suscripción → no muestra
    if (info.sub.status !== "active") return false;
    if (info.expired) return false;
    return true;
  });
}

// ========= Fetch de ventas desde Firestore =========

async function fetchVentas() {
  const col = collection(db, "publications");

  const normalize = (docSnap) => {
    const r = docSnap.data();

    return {
      id: docSnap.id,
      ...r,
      created_date: r?.created_date?.toDate
        ? r.created_date.toDate()
        : r?.created_date
        ? new Date(r.created_date)
        : new Date(0),
      title: r?.title || "(Sin título)",
      description: r?.description || "",
      location: r?.location || "",
      price: r?.price ?? null,
      images: Array.isArray(r?.images) ? r.images : [],
      category: (r?.category || r?.tipo || "").toString().toLowerCase(),
      status: (r?.status || r?.estado || "").toString().toLowerCase(),
      // subcategoría para filtros (ej: "tecnologia", "autos", etc.)
      saleCategory: (
        r?.sale_category ||
        r?.saleCategory ||
        r?.subcategory ||
        r?.rubro ||
        ""
      )
        .toString()
        .toLowerCase(),
    };
  };

  const isVentaCat = (cat) =>
    ["venta", "ventas", "product", "producto", "productos"].includes(
      String(cat || "").toLowerCase()
    );

  const isActivoStatus = (st) =>
    ["active", "activo", "activa"].includes(String(st || "").toLowerCase());

  const tryQuery = async (q) => {
    const snap = await getDocs(q);
    return snap.docs.map(normalize);
  };

  // 1) Ideal: category = "venta" + status = "active" + orderBy(created_date)
  try {
    const q1 = fsQuery(
      col,
      where("category", "==", "venta"),
      where("status", "==", "active"),
      orderBy("created_date", "desc")
    );
    const r1 = await tryQuery(q1);
    return await filterByActiveSubscription(r1);
  } catch (e) {
    console.warn("[ventas] q1 falló:", e?.code || e);
  }

  // 2) Solo category="venta", filtrando status activo en cliente
  try {
    const q2 = fsQuery(col, where("category", "==", "venta"));
    const r2 = await tryQuery(q2);
    const activos = r2.filter((x) => isActivoStatus(x.status));
    const final = activos.sort((a, b) => b.created_date - a.created_date);
    return await filterByActiveSubscription(final);
  } catch (e) {
    console.warn("[ventas] q2 falló:", e?.code || e);
  }

  // 3) Fallback: traer todo y filtrar por categoría "venta" + status activo
  try {
    const snap = await getDocs(col);
    const all = snap.docs.map(normalize);
    const ventaLike = all.filter((x) => isVentaCat(x.category));
    const activos = ventaLike.filter((x) => isActivoStatus(x.status));
    const final = activos.sort((a, b) => b.created_date - a.created_date);
    return await filterByActiveSubscription(final);
  } catch (e) {
    console.error("[ventas] fallo general:", e?.code || e);
    return [];
  }
}

// ========= Componente principal =========

export default function Ventas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("all"); // ahora es por ciudad
  const [categoryFilter, setCategoryFilter] = useState("all");

  // ===== Favoritos / Auth (similar a Alquileres) =====
  const [user, setUser] = useState(null);
  const [favIds, setFavIds] = useState(new Set());
  const [favBusy, setFavBusy] = useState({});
  const [showFavOnly, setShowFavOnly] = useState(false);
  // ===== Reportes =====
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportComment, setReportComment] = useState("");

  const {
    data: publications = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["ventas"],
    queryFn: fetchVentas,
  });

  // Escuchar auth y cargar favoritos desde /users/{uid}/favorites
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      if (!u) {
        setFavIds(new Set());
        return;
      }
      try {
        const snap = await getDocs(collection(db, "users", u.uid, "favorites"));
        setFavIds(new Set(snap.docs.map((d) => d.id)));
      } catch (e) {
        console.error("[ventas] error leyendo favoritos:", e);
      }
    });
    return () => unsub();
  }, []);

  const isFavorite = (id) => favIds.has(id);

  const toggleFavorite = async (product) => {
    if (!user) {
      toast.error("Iniciá sesión para guardar favoritos");
      return;
    }
    const id = product.id;
    setFavBusy((m) => ({ ...m, [id]: true }));
    try {
      const isFav = favIds.has(id);
      const favRef = doc(db, "users", user.uid, "favorites", id);

      if (isFav) {
        await deleteDoc(favRef);
        setFavIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast("Quitado de favoritos");
      } else {
        await setDoc(favRef, {
          publication_id: id,
          category: product.category || "venta",
          title: product.title || "",
          created_at: serverTimestamp(),
        });
        setFavIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        toast.success("Guardado en favoritos");
      }
    } catch (err) {
      console.error("[ventas] error toggle favorito:", err?.code || err);
      toast.error("No se pudo actualizar el favorito");
    } finally {
      setFavBusy((m) => ({ ...m, [id]: false }));
    }
  };

  const openReport = (product) => {
    if (!user) {
      toast.error("Iniciá sesión para reportar un producto");
      return;
    }
    setReportTarget(product);
    setReportComment("");
    setReportOpen(true);
  };

  const submitReport = async (e) => {
    e.preventDefault();
    if (!user || !reportTarget) return;

    const comment = reportComment.trim();
    if (!comment) {
      toast.error("Escribí un motivo para el reporte");
      return;
    }

    try {
      await addDoc(collection(db, "reports"), {
        publication_id: reportTarget.id,
        publication_title: reportTarget.title || "",
        owner_email: reportTarget.user_email || reportTarget.created_by || "",
        reporter_uid: user.uid,
        reporter_email: user.email || "",
        comment,
        status: "open",
        created_at: serverTimestamp(),
      });

      toast.success("Reporte enviado. Gracias por avisarnos 🙌");
      setReportOpen(false);
      setReportTarget(null);
      setReportComment("");
    } catch (err) {
      console.error("[ventas] error creando reporte:", err);
      toast.error("No se pudo enviar el reporte");
    }
  };

  // Opciones de ubicación (CIUDADES únicas)
  const locations = useMemo(
    () => [
      ...new Set(
        (publications || [])
          .map((p) => getCityFromLocation(p.location))
          .filter(Boolean)
      ),
    ],
    [publications]
  );

  // Opciones de categoría (únicas)
  const categories = useMemo(
    () => [
      ...new Set(
        (publications || []).map((p) => p.saleCategory?.trim()).filter(Boolean)
      ),
    ],
    [publications]
  );

  // Filtrado en memoria
  const filteredPublications = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return (publications || []).filter((pub) => {
      const title = (pub.title || "").toLowerCase();
      const desc = (pub.description || "").toLowerCase();
      const cat = (pub.saleCategory || "").toLowerCase();
      const pubCity = getCityFromLocation(pub.location);

      const matchesSearch = !q || title.includes(q) || desc.includes(q);

      const matchesLocation =
        locationFilter === "all" || pubCity === locationFilter;

      const matchesCategory =
        categoryFilter === "all" || cat === categoryFilter;

      const matchesFav = !showFavOnly || favIds.has(pub.id);

      return matchesSearch && matchesLocation && matchesCategory && matchesFav;
    });
  }, [
    publications,
    searchTerm,
    locationFilter,
    categoryFilter,
    showFavOnly,
    favIds,
  ]);

  const hasAnyFilter =
    searchTerm ||
    locationFilter !== "all" ||
    categoryFilter !== "all" ||
    showFavOnly;

  const clearAll = () => {
    setSearchTerm("");
    setLocationFilter("all");
    setCategoryFilter("all");
    setShowFavOnly(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-slate-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30">
              <ShoppingBag className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
                Ventas
              </h1>
              <p className="text-slate-600">Comprá y vendé lo que necesites</p>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Buscador */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <Input
                    placeholder="Buscar productos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 shadow-sm"
                  />
                </div>
              </div>

              {/* Filtro categoría */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="shadow-sm">
                  <Tag className="w-4 h-4 mr-2 text-slate-500" />
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filtro ubicación (solo ciudades) */}
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="shadow-sm">
                  <MapPin className="w-4 h-4 mr-2 text-slate-500" />
                  <SelectValue placeholder="Ubicación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las ubicaciones</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtros secundarios (chips + toggle favoritos + limpiar) */}
            <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                {searchTerm && (
                  <span className="px-2 py-1 rounded-full bg-slate-100 border">
                    Buscando: <b>{searchTerm}</b>
                  </span>
                )}
                {locationFilter !== "all" && (
                  <span className="px-2 py-1 rounded-full bg-slate-100 border">
                    Zona: <b>{locationFilter}</b>
                  </span>
                )}
                {categoryFilter !== "all" && (
                  <span className="px-2 py-1 rounded-full bg-slate-100 border">
                    Categoría: <b>{categoryFilter}</b>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* Toggle Solo favoritos */}
                <button
                  onClick={() => setShowFavOnly((v) => !v)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                    showFavOnly
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Heart
                    className={`w-4 h-4 ${
                      showFavOnly ? "text-rose-600" : "text-slate-500"
                    }`}
                    fill={showFavOnly ? "currentColor" : "none"}
                  />
                  {showFavOnly ? "Solo favoritos" : "Ver favoritos"}
                </button>

                {hasAnyFilter && (
                  <Button variant="ghost" size="sm" onClick={clearAll}>
                    Limpiar todo
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Meta resultados */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-2">
          <p className="text-slate-600">
            {filteredPublications.length}{" "}
            {filteredPublications.length === 1
              ? "producto encontrado"
              : "productos encontrados"}
          </p>

          {isError && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-red-500">
                No se pudo cargar la lista.
              </span>
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                Reintentar
              </Button>
            </div>
          )}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Card
                key={i}
                className="animate-pulse overflow-hidden border-2 border-slate-100"
              >
                <div className="h-48 bg-slate-200" />
                <CardContent className="p-4">
                  <div className="h-4 bg-slate-200 rounded mb-2" />
                  <div className="h-6 bg-slate-200 rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredPublications.map((product) => {
              const isFav = isFavorite(product.id);
              return (
                <Card
                  key={product.id}
                  className="relative hover:shadow-xl transition-all group overflow-hidden border-2 border-slate-100 hover:border-green-200 bg-white"
                >
                  {/* Botón favorito */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(product);
                    }}
                    disabled={!!favBusy[product.id]}
                    title={
                      isFav ? "Quitar de favoritos" : "Agregar a favoritos"
                    }
                    className={`absolute top-3 right-3 z-10 rounded-full bg-white/95 backdrop-blur p-2 border shadow-sm hover:scale-105 transition
                      ${
                        isFav
                          ? "border-rose-300 ring-2 ring-rose-200"
                          : "border-slate-200 hover:bg-green-50"
                      }`}
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        isFav ? "text-rose-600" : "text-slate-600"
                      }`}
                      fill={isFav ? "currentColor" : "none"}
                    />
                  </button>

                  {/* Ribbon FAVORITO */}
                  {isFav && (
                    <div className="absolute -right-10 top-6 rotate-45 z-[5]">
                      <div className="bg-rose-600 text-white text-xs font-semibold px-12 py-1 shadow-sm">
                        FAVORITO
                      </div>
                    </div>
                  )}

                  {/* Imagen */}
                  {product.images && product.images[0] ? (
                    <div className="h-48 overflow-hidden bg-slate-50 flex items-center justify-center">
                      <img
                        src={product.images[0]}
                        alt={product.title}
                        className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300 p-2"
                      />
                    </div>
                  ) : (
                    <div className="h-48 bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center">
                      <Tag className="w-16 h-16 text-white opacity-60" />
                    </div>
                  )}

                  <CardContent className="p-4">
                    <Badge className="mb-2" tone="green">
                      Venta
                    </Badge>

                    <h3 className="font-bold text-slate-900 mb-2 group-hover:text-green-600 transition-colors line-clamp-2">
                      {product.title}
                    </h3>

                    {product.price && (
                      <div className="flex items-center text-xl font-bold text-green-600 mb-2">
                        <DollarSign className="w-5 h-5" />
                        {Number(product.price).toLocaleString("es-AR")}
                      </div>
                    )}

                    {product.location && (
                      <div className="flex items-center text-slate-500 text-xs mb-3">
                        <MapPin className="w-3 h-3 mr-1" />
                        {/* Mostramos la ciudad también acá si querés */}
                        {getCityFromLocation(product.location) ||
                          product.location}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Button
                        asChild
                        size="sm"
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <Link to={`/ventas/${product.id}`}>Ver detalles</Link>
                      </Button>

                      <button
                        type="button"
                        onClick={() => openReport(product)}
                        className="w-full inline-flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50/70 border border-dashed border-slate-200 rounded-full px-3 py-1 transition-colors"
                      >
                        <Flag className="w-3 h-3" />
                        Reportar publicación
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {filteredPublications.length === 0 && !isLoading && !isError && (
              <div className="col-span-full text-center py-12">
                <ShoppingBag className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 text-lg">
                  No se encontraron productos
                </p>
                <p className="text-slate-400 text-sm">
                  Probá buscar por otra palabra o cambiar la ubicación /
                  categoría.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal para reportar publicación en Ventas */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-md w-[92vw] sm:w-auto">
          <DialogHeader>
            <DialogTitle>Reportar publicación</DialogTitle>
          </DialogHeader>

          {reportTarget && (
            <form onSubmit={submitReport} className="space-y-4">
              <div className="text-sm">
                <p className="font-semibold text-slate-800 line-clamp-2">
                  {reportTarget.title}
                </p>
                {reportTarget.location && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {reportTarget.location}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Contanos qué pasa
                </label>
                <Textarea
                  rows={4}
                  placeholder="Ej: Información falsa, producto no existe, contenido inapropiado, etc."
                  value={reportComment}
                  onChange={(e) => setReportComment(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReportOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Enviar reporte</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
