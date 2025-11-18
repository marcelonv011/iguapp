// src/pages/Alquileres.jsx
import React, { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  collection,
  query as fsQuery,
  where,
  orderBy,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  runTransaction,
  addDoc,
} from "firebase/firestore";
import { db, auth } from "@/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { toast } from "sonner";
import {
  Building2,
  MapPin,
  DollarSign,
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Plus,
  Heart,
  Star,
  Flag,
} from "lucide-react";
import { Textarea } from "@/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";

// Helper: normaliza período a "dia" | "mes"
const getNormalizedPeriod = (p) => {
  const rt = (p?.rent_type || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/(^|\b)(diario|por dia)(\b|$)/.test(rt)) return "dia";
  if (/(^|\b)(mensual|por mes|mes)(\b|$)/.test(rt)) return "mes";

  const raw = (
    p?.price_period ||
    p?.period ||
    p?.rent_period ||
    p?.billing_period ||
    ""
  )
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/(^|\b)(dia|diario|por dia|daily|per day|day)(\b|$)/.test(raw))
    return "dia";
  if (/(^|\b)(mes|mensual|monthly|per month|month)(\b|$)/.test(raw))
    return "mes";
  return "mes";
};

// Helper: extraer ciudad de la ubicación
// "Av. Misiones 123, Puerto Iguazú" -> "Puerto Iguazú"
const getCityFromLocation = (loc) => {
  if (!loc) return "";
  const parts = loc.split(",");
  return parts[parts.length - 1].trim();
};

// ==== Fechas genéricas: Timestamp / string / Date a Date ====
// ==== Fechas para suscripciones ====
const toJsDate = (v) => {
  if (!v) return null;
  if (v?.toDate) return v.toDate();
  if (v?.seconds) return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d) ? null : d;
};

const isExpired = (end) => {
  const d = toJsDate(end);
  return d ? d.getTime() < Date.now() : true;
};

// Filtra lista de publicaciones según suscripción del autor
async function filterByActiveSubscription(list) {
  if (!list.length) return [];

  const emails = [
    ...new Set(list.map((p) => p.created_by).filter(Boolean)),
  ];
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
        console.error("[alquileres] error cargando sub de", email, e);
      }
    })
  );

  return list.filter((p) => {
    const info = resultByEmail[p.created_by];
    if (!info) return false;
    if (info.sub.status !== "active") return false;
    if (info.expired) return false;
    return true;
  });
}


// ¿La publicación está vencida por suscripción?
const isPublicationExpired = (pub) => {
  const d = toJsDate(pub.subscription_end_date);
  if (!d) return false; // si no tiene fecha, por ahora la dejamos pasar
  return d.getTime() < Date.now();
};

export default function Alquileres() {
  const queryClient = useQueryClient();

  // ===== Favoritos / Auth / Ratings =====
  const [user, setUser] = useState(null);
  const [favIds, setFavIds] = useState(new Set());
  const [favBusy, setFavBusy] = useState({}); // id -> boolean
  const [userRatings, setUserRatings] = useState({}); // { [publicationId]: number }
    // ===== Reportes =====
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportComment, setReportComment] = useState("");


  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);

      if (!u) {
        setFavIds(new Set());
        setUserRatings({});
        return;
      }

      try {
        const favSnap = await getDocs(
          collection(db, "users", u.uid, "favorites")
        );
        setFavIds(new Set(favSnap.docs.map((d) => d.id)));

        // cargar ratings previos del usuario para alquileres
        const ratingsSnap = await getDocs(
          collection(db, "users", u.uid, "rental_ratings")
        );
        const map = {};
        ratingsSnap.docs.forEach((d) => {
          const data = d.data();
          if (typeof data.value === "number") {
            map[d.id] = data.value;
          }
        });
        setUserRatings(map);
      } catch (e) {
        console.error("Error cargando favoritos/ratings:", e);
      }
    });
    return () => unsub();
  }, []);

  const toggleFavorite = async (pub) => {
    if (!user) {
      toast.error("Iniciá sesión para guardar favoritos");
      return;
    }
    const id = pub.id;
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
          category: pub.category || "alquiler",
          title: pub.title || "",
          created_at: serverTimestamp(),
        });
        setFavIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        toast.success("Guardado en favoritos");
      }
    } catch (e) {
      console.error(e);
      toast.error("No se pudo actualizar el favorito");
    } finally {
      setFavBusy((m) => ({ ...m, [id]: false }));
    }
  };

  const handleRate = async (property, value) => {
    if (!user) {
      toast.error("Iniciá sesión para calificar el alquiler");
      return;
    }
    if (value < 1 || value > 5) return;

    const pubId = property.id;
    const pubRef = doc(db, "publications", pubId);
    const userRatingRef = doc(db, "users", user.uid, "rental_ratings", pubId);

    try {
      await runTransaction(db, async (tx) => {
        const pubSnap = await tx.get(pubRef);
        if (!pubSnap.exists()) {
          throw new Error("Publicación no encontrada");
        }
        const data = pubSnap.data();

        const userRatingSnap = await tx.get(userRatingRef);
        const prevVal = userRatingSnap.exists()
          ? userRatingSnap.data().value
          : null;

        let count = data.rating_count || 0;
        let sum = data.rating_sum || 0;

        if (prevVal == null) {
          // voto nuevo
          count += 1;
          sum += value;
        } else {
          // actualización de voto anterior
          sum = sum - prevVal + value;
        }

        const avg = count > 0 ? sum / count : 0;

        tx.update(pubRef, {
          rating_count: count,
          rating_sum: sum,
          rating: avg,
        });

        tx.set(userRatingRef, {
          value,
          publication_id: pubId,
          updated_at: serverTimestamp(),
        });
      });

      setUserRatings((prev) => ({ ...prev, [pubId]: value }));
      toast.success(`Calificación enviada: ${value}★`);

      // refrescar lista de alquileres
      queryClient.invalidateQueries({ queryKey: ["alquileres"] });
    } catch (e) {
      console.error(e);
      toast.error("No se pudo guardar tu voto");
    }
  };

    const openReport = (property) => {
    if (!user) {
      toast.error("Iniciá sesión para reportar un alquiler");
      return;
    }
    setReportTarget(property);
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
        owner_email:
          reportTarget.user_email || reportTarget.created_by || "",
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
      console.error("Error creando reporte:", err);
      toast.error("No se pudo enviar el reporte");
    }
  };


  // ===== Filtros / estado =====
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all"); // "all" | "mes" | "dia"
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sortBy, setSortBy] = useState("newest"); // "newest" | "priceAsc" | "priceDesc" | "topRated"
  const [showFavOnly, setShowFavOnly] = useState(false);

  // Paginación
  const [page, setPage] = useState(1);
  const pageSize = 9;

  useEffect(() => {
    setPage(1);
  }, [
    searchTerm,
    locationFilter,
    periodFilter,
    priceMin,
    priceMax,
    sortBy,
    showFavOnly,
    favIds,
  ]);

  // ===== Query Firestore =====
   const {
    data: publications = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["alquileres"],
    queryFn: async () => {
      const col = collection(db, "publications");

      try {
        const q1 = fsQuery(
          col,
          where("category", "==", "alquiler"),
          where("status", "==", "active"),
          orderBy("created_date", "desc")
        );
        const s1 = await getDocs(q1);
        const rows1 = s1.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (rows1.length > 0) {
          return await filterByActiveSubscription(rows1);
        }
      } catch (e) {
        console.warn(
          "[q1] Necesita índice o falló created_date/orderBy:",
          e?.code,
          e?.message
        );
      }

      try {
        const q2 = fsQuery(
          col,
          where("category", "==", "alquiler"),
          where("status", "==", "active")
        );
        const s2 = await getDocs(q2);
        const rows2 = s2.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (rows2.length > 0) {
          return await filterByActiveSubscription(rows2);
        }
      } catch (e) {
        console.warn("[q2] Falla en where/lectura:", e?.code, e?.message);
      }

      try {
        const q3 = fsQuery(col, orderBy("created_date", "desc"));
        const s3 = await getDocs(q3);
        const sample = s3.docs
          .slice(0, 10)
          .map((d) => ({ id: d.id, ...d.data() }));
        console.info("[Diagnóstico] Muestra de 'publications':", sample);

        if (sample.length === 0) {
          const s4 = await getDocs(col);
          const sample2 = s4.docs
            .slice(0, 10)
            .map((d) => ({ id: d.id, ...d.data() }));
          console.info("[Diagnóstico] Muestra sin orderBy:", sample2);
        }
        return [];
      } catch (e) {
        console.warn("[q3] Falla diagnóstico:", e?.code, e?.message);
        return [];
      }
    },
  });


  const formatter = useMemo(
    () =>
      new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }),
    []
  );

  const locations = useMemo(() => {
    const set = new Set(
      publications.map((p) => getCityFromLocation(p.location)).filter(Boolean)
    );
    return ["all", ...Array.from(set)];
  }, [publications]);

  // ===== Filtrado + orden + favoritos primero =====
    const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    let list = publications.filter((p) => {
      // 👇 si la suscripción del dueño está vencida, NO mostramos este alquiler
      if (isPublicationExpired(p)) return false;

      const matchesSearch =
        !term ||
        p?.title?.toLowerCase().includes(term) ||
        p?.description?.toLowerCase().includes(term) ||
        p?.location?.toLowerCase().includes(term);

      const city = getCityFromLocation(p?.location);
      const matchesLocation =
        locationFilter === "all" || city === locationFilter;

      const normalizedPeriod = getNormalizedPeriod(p);
      const matchesPeriod =
        periodFilter === "all" || normalizedPeriod === periodFilter;

      const price = Number(p?.price || 0);
      const matchesMin = priceMin === "" || price >= Number(priceMin);
      const matchesMax = priceMax === "" || price <= Number(priceMax);

      const matchesFav = !showFavOnly || favIds.has(p.id);

      return (
        matchesSearch &&
        matchesLocation &&
        matchesPeriod &&
        matchesMin &&
        matchesMax &&
        matchesFav
      );
    });

    // Orden primario
    list.sort((a, b) => {
      if (sortBy === "priceAsc") {
        return (a.price || 0) - (b.price || 0);
      }

      if (sortBy === "priceDesc") {
        return (b.price || 0) - (a.price || 0);
      }

      if (sortBy === "topRated") {
        const ra = typeof a.rating === "number" ? a.rating : 0;
        const rb = typeof b.rating === "number" ? b.rating : 0;

        const ca = typeof a.rating_count === "number" ? a.rating_count : 0;
        const cb = typeof b.rating_count === "number" ? b.rating_count : 0;

        // 1) los que NO tienen votos van al fondo
        if (ca === 0 && cb > 0) return 1;
        if (cb === 0 && ca > 0) return -1;

        // 2) ambos tienen votos → ordenar por promedio
        if (rb !== ra) return rb - ra;

        // 3) si empatan, ordenar por cantidad de votos
        if (cb !== ca) return cb - ca;

        // 4) si sigue igual, más nuevo primero
        return new Date(b.created_date || 0) - new Date(a.created_date || 0);
      }

      // default: más recientes
      return new Date(b.created_date || 0) - new Date(a.created_date || 0);
    });

    // Favoritos primero
    list.sort(
      (a, b) => (favIds.has(b.id) ? 1 : 0) - (favIds.has(a.id) ? 1 : 0)
    );

    return list;
  }, [
    publications,
    searchTerm,
    locationFilter,
    periodFilter,
    priceMin,
    priceMax,
    sortBy,
    favIds,
    showFavOnly,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  const clearAll = () => {
    setSearchTerm("");
    setLocationFilter("all");
    setPeriodFilter("all");
    setPriceMin("");
    setPriceMax("");
    setSortBy("newest");
    setShowFavOnly(false);
    setPage(1);
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-purple-50 via-white to-slate-100">
      {/* Blob decorativo */}
      <div className="pointer-events-none absolute inset-x-0 -top-24 flex justify-center opacity-60">
        <div className="h-56 w-[820px] bg-gradient-to-r from-purple-300 via-fuchsia-200 to-indigo-200 blur-3xl rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl grid place-items-center shadow-lg shadow-purple-200/50">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
                Alquileres
              </h1>
              <p className="text-slate-600">
                Encontrá tu próximo hogar con filtros inteligentes
              </p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <Input
                  placeholder="Buscar por título, descripción o zona..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>

            <Select
              value={locationFilter}
              onValueChange={(v) => {
                setLocationFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="bg-white">
                <MapPin className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Ubicación" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc === "all" ? "Todas las ubicaciones" : loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={periodFilter}
              onValueChange={(v) => {
                setPeriodFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="bg-white">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Periodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los periodos</SelectItem>
                <SelectItem value="mes">Por mes</SelectItem>
                <SelectItem value="dia">Por día</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start bg-white">
                  <DollarSign className="w-4 h-4 mr-2" /> Rango de precio
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500">Mín</label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={priceMin}
                        onChange={(e) => {
                          setPriceMin(e.target.value);
                          setPage(1);
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Máx</label>
                      <Input
                        type="number"
                        placeholder="500000"
                        value={priceMax}
                        onChange={(e) => {
                          setPriceMax(e.target.value);
                          setPage(1);
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setPriceMin("");
                        setPriceMax("");
                        setPage(1);
                      }}
                    >
                      Limpiar
                    </Button>
                    <Button size="sm" onClick={() => setPage(1)}>
                      Aplicar
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v)}>
              <SelectTrigger className="bg-white">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Orden" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Más recientes</SelectItem>
                <SelectItem value="priceAsc">Precio: menor a mayor</SelectItem>
                <SelectItem value="priceDesc">Precio: mayor a menor</SelectItem>
                <SelectItem value="topRated">Mejor valorados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {/* Chips activos */}
            <div className="flex flex-wrap gap-2">
              {searchTerm && (
                <span className="px-2.5 py-1 text-xs rounded-full bg-slate-100 border text-slate-700">
                  Buscando: <b>{searchTerm}</b>
                </span>
              )}
              {locationFilter !== "all" && (
                <span className="px-2.5 py-1 text-xs rounded-full bg-slate-100 border text-slate-700">
                  Zona: <b>{locationFilter}</b>
                </span>
              )}
              {periodFilter !== "all" && (
                <span className="px-2.5 py-1 text-xs rounded-full bg-slate-100 border text-slate-700">
                  Período:{" "}
                  <b>{periodFilter === "mes" ? "Mensual" : "Diario"}</b>
                </span>
              )}
              {(priceMin || priceMax) && (
                <span className="px-2.5 py-1 text-xs rounded-full bg-slate-100 border text-slate-700">
                  ARS {priceMin || 0} – {priceMax || "∞"}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Botón para ordenar por mejor valorados */}
              <button
                onClick={() =>
                  setSortBy((prev) =>
                    prev === "topRated" ? "newest" : "topRated"
                  )
                }
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                  sortBy === "topRated"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Star
                  className={`w-4 h-4 ${
                    sortBy === "topRated" ? "text-amber-600" : "text-slate-500"
                  }`}
                  fill={sortBy === "topRated" ? "currentColor" : "none"}
                />
                {sortBy === "topRated"
                  ? "Mejor valorados primero"
                  : "Ver mejor valorados"}
              </button>

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

              {(locationFilter !== "all" ||
                periodFilter !== "all" ||
                priceMin !== "" ||
                priceMax !== "" ||
                searchTerm) && (
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  Limpiar todo
                </Button>
              )}

              {/* Publicar alquiler */}
              <Link to="/admin?new=1&category=alquiler">
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Publicar alquiler
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Meta */}
        {!isLoading && !error && (
          <div className="mb-4 text-sm text-slate-600">
            {filtered.length}{" "}
            {filtered.length === 1 ? "resultado" : "resultados"}
            {filtered.length > 0 && (
              <>
                {" "}
                · Página {currentPage} de {totalPages}
              </>
            )}
          </div>
        )}

        {/* Contenido */}
        {error ? (
          <div className="text-center py-16">
            <p className="text-red-600 font-medium">
              Hubo un error al cargar los datos.
            </p>
            <p className="text-slate-500 text-sm">
              Intentá nuevamente en unos segundos.
            </p>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(9)].map((_, i) => (
              <Card
                key={i}
                className="overflow-hidden animate-pulse rounded-2xl"
              >
                <div className="h-48 bg-slate-200" />
                <CardContent className="p-6">
                  <div className="h-6 bg-slate-200 rounded mb-2" />
                  <div className="h-4 bg-slate-200 rounded w-4/5" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pageItems.map((property) => {
                const normalizedPeriodForCard = getNormalizedPeriod(property);
                const priceLabel = property.price
                  ? `${formatter.format(Number(property.price))}/${
                      normalizedPeriodForCard === "mes" ? "mes" : "día"
                    }`
                  : null;
                const cover = property.images && property.images[0];
                const isFav = favIds.has(property.id);

                return (
                  <Card
                    key={property.id}
                    className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm hover:shadow-xl hover:border-purple-200 transition-all"
                  >
                    {/* Botón Favorito */}
                    <button
                      onClick={() => toggleFavorite(property)}
                      disabled={!!favBusy[property.id]}
                      title={
                        isFav ? "Quitar de favoritos" : "Agregar a favoritos"
                      }
                      className={`absolute right-3 top-3 z-10 rounded-full p-2 border bg-white/95 backdrop-blur shadow-sm transition-all
                        ${
                          isFav
                            ? "border-rose-300 ring-2 ring-rose-200"
                            : "border-slate-200 hover:bg-purple-50"
                        }
                        active:scale-95`}
                    >
                      <Heart
                        className={`w-5 h-5 transition-colors ${
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

                    {/* Cover */}
                    {cover ? (
                      <div className="relative h-48 overflow-hidden bg-slate-50">
                        <img
                          src={cover}
                          alt={property.title}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          onError={(e) => {
                            e.currentTarget.classList.add("hidden");
                            const fallback = e.currentTarget.nextElementSibling;
                            if (fallback) fallback.classList.remove("hidden");
                          }}
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-70" />
                        <div className="hidden absolute inset-0 items-center justify-center text-slate-400 bg-slate-50">
                          <ImageOff className="w-10 h-10" />
                        </div>
                      </div>
                    ) : (
                      <div className="h-48 bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center">
                        <Building2 className="w-16 h-16 text-white/80" />
                      </div>
                    )}

                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <Badge className="bg-purple-100 text-purple-700">
                          Alquiler
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-xs border-purple-200 text-purple-700"
                        >
                          {normalizedPeriodForCard === "mes"
                            ? "Por mes"
                            : "Por día"}
                        </Badge>
                      </div>

                      <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-purple-700 transition-colors line-clamp-1">
                        {property.title}
                      </h3>

                      {/* Rating con estrellas clickeables */}
                      <div className="mb-2">
                        {(() => {
                          const ratingCount =
                            typeof property.rating_count === "number"
                              ? property.rating_count
                              : 0;
                          const hasVotes = ratingCount > 0;

                          // si NO hay votos, ignoramos property.rating y lo tratamos como 0
                          const avgRating =
                            hasVotes &&
                            typeof property.rating === "number" &&
                            !isNaN(property.rating)
                              ? property.rating
                              : 0;

                          const userRating = userRatings[property.id] || null;
                          const roundedAvg = hasVotes
                            ? Math.round(avgRating)
                            : 0;

                          return (
                            <>
                              <div className="flex items-center gap-1">
                                {Array.from({ length: 5 }).map((_, i) => {
                                  const starValue = i + 1;
                                  const filled =
                                    hasVotes && starValue <= roundedAvg;
                                  const isUserStar = userRating === starValue;

                                  return (
                                    <button
                                      key={starValue}
                                      type="button"
                                      onClick={() =>
                                        handleRate(property, starValue)
                                      }
                                      className="focus:outline-none"
                                      title={
                                        user
                                          ? `Calificar con ${starValue} estrellas`
                                          : "Iniciá sesión para calificar"
                                      }
                                    >
                                      <Star
                                        className={`w-4 h-4 transition-transform ${
                                          filled
                                            ? "text-amber-400 fill-amber-400"
                                            : "text-slate-300"
                                        } ${isUserStar ? "scale-110" : ""}`}
                                      />
                                    </button>
                                  );
                                })}

                                <span className="ml-1 text-xs text-slate-500">
                                  {hasVotes
                                    ? `${avgRating.toFixed(1)}/5`
                                    : "Sin valoraciones"}
                                  {hasVotes && <> ({ratingCount})</>}
                                </span>
                              </div>

                              {userRating ? (
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  Tu voto: {userRating}★
                                </p>
                              ) : (
                                user && (
                                  <p className="text-[11px] text-slate-400 mt-0.5 italic">
                                    Aún no votaste
                                  </p>
                                )
                              )}
                            </>
                          );
                        })()}
                      </div>

                      <p className="text-slate-600 text-sm mb-4 line-clamp-2">
                        {property.description}
                      </p>

                      {priceLabel && (
                        <div className="inline-flex items-center text-lg font-extrabold text-purple-700 mb-3 rounded-full bg-purple-50 border border-purple-100 px-3 py-1">
                          <DollarSign className="w-4 h-4 mr-1" />
                          <span>{priceLabel}</span>
                        </div>
                      )}

                      {property.location && (
                        <div className="flex items-center text-slate-600 text-sm mb-5">
                          <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                          {getCityFromLocation(property.location)}
                        </div>
                      )}

                                            <div className="pt-4 border-t border-slate-200 space-y-2">
                        <Button
                          asChild
                          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-sm"
                        >
                          <Link to={`/alquileres/${property.id}`}>
                            Ver detalles
                          </Link>
                        </Button>

                        <button
                          type="button"
                          onClick={() => openReport(property)}
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

              {filtered.length === 0 && (
                <div className="col-span-full text-center py-16 rounded-2xl border bg-white/70 backdrop-blur-sm">
                  <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-700 text-lg">
                    No se encontraron propiedades
                  </p>
                  <p className="text-slate-500 text-sm">
                    Probá limpiando filtros o cambiando los términos de
                    búsqueda.
                  </p>
                  <div className="mt-6">
                    <Link to="/admin?new=1&category=alquiler">
                      <Button className="gap-2">
                        <Plus className="w-4 h-4" />
                        Publicar alquiler
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Paginación */}
            {filtered.length > pageSize && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="secondary"
                  size="icon"
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .slice(
                    Math.max(0, Math.min(currentPage - 3, totalPages - 6)),
                    Math.max(6, Math.min(totalPages, currentPage + 3))
                  )
                  .map((n) => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`px-3 py-2 rounded-full text-sm border transition-colors ${
                        n === currentPage
                          ? "bg-purple-600 text-white border-purple-600"
                          : "bg-white hover:bg-slate-50 border-slate-200"
                      }`}
                    >
                      {n}
                    </button>
                  ))}

                <Button
                  variant="secondary"
                  size="icon"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      {/* Modal para reportar publicación */}
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
                  placeholder="Ej: Información falsa, contenido inapropiado, sospecha de estafa, etc."
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
