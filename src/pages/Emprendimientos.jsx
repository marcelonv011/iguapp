// src/pages/Emprendimientos.jsx
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
  addDoc,
  runTransaction,
} from "firebase/firestore";
import { db, auth } from "@/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { toast } from "sonner";
import {
  Store,
  MapPin,
  Search,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Plus,
  Heart,
  ArrowUpDown,
  Phone,
  Clock,
  Star,
  MessageCircle,
  Flag,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Textarea } from "@/ui/textarea";
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

// Helper: extraer ciudad de la ubicación
const getCityFromLocation = (loc) => {
  if (!loc) return "";
  const parts = loc.split(",");
  return parts[parts.length - 1].trim();
};

// ==== Fechas / suscripciones ====
const toJsDate = (v) => {
  if (!v) return null;
  if (v?.toDate) return v.toDate(); // Timestamp de Firestore
  if (v?.seconds) return new Date(v.seconds * 1000);
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
 * Usa el campo `created_by` de cada publicación.
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
        console.error("[emprendimientos] error sub de", email, e);
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

export default function Emprendimientos() {
  const queryClient = useQueryClient();

  // ===== Auth + Favoritos =====
  const [user, setUser] = useState(null);
  const [favIds, setFavIds] = useState(new Set());
  const [favBusy, setFavBusy] = useState({});
  const [userRatings, setUserRatings] = useState({}); // { [publicationId]: number }
  // ===== Suscripción del usuario =====
  const [hasActiveSub, setHasActiveSub] = useState(false);
  const [subChecked, setSubChecked] = useState(false);

  // ===== Reportes =====
  const [reportBusiness, setReportBusiness] = useState(null);
  const [reportComment, setReportComment] = useState("");
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      setFavIds(new Set());
      setUserRatings({});
      setHasActiveSub(false);
      setSubChecked(false);

      if (!u) {
        setSubChecked(true);
        return;
      }

      try {
        // favoritos
        const snap = await getDocs(collection(db, "users", u.uid, "favorites"));
        setFavIds(new Set(snap.docs.map((d) => d.id)));

        // ratings previos
        const ratingsSnap = await getDocs(
          collection(db, "users", u.uid, "business_ratings")
        );
        const map = {};
        ratingsSnap.docs.forEach((d) => {
          const data = d.data();
          if (typeof data.value === "number") map[d.id] = data.value;
        });
        setUserRatings(map);
      } catch (e) {
        console.error("Error cargando favoritos:", e);
      }

      // ===== Cargar suscripción =====
      try {
        const qSub = fsQuery(
          collection(db, "subscriptions"),
          where("user_email", "==", u.email),
          where("product_type", "==", "publications")
        );

        const snapSub = await getDocs(qSub);

        if (snapSub.empty) {
          setHasActiveSub(false);
        } else {
          const subs = snapSub.docs.map((d) => d.data());
          const active = subs.some((s) => {
            const end = toJsDate(s.end_date);
            const expired = !end || end.getTime() < Date.now();
            return s.status === "active" && !expired;
          });
          setHasActiveSub(active);
        }
      } catch (e) {
        console.error("[emprendimientos] error suscripción", e);
        setHasActiveSub(false);
      } finally {
        setSubChecked(true);
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
          category: pub.category || "emprendimiento",
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

  const handleRate = async (business, value) => {
    if (!user) {
      toast.error("Iniciá sesión para calificar el emprendimiento");
      return;
    }
    if (value < 1 || value > 5) return;

    const pubId = business.id;
    const pubRef = doc(db, "publications", pubId);
    const userRatingRef = doc(db, "users", user.uid, "business_ratings", pubId);

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

      // refrescar lista de emprendimientos
      queryClient.invalidateQueries({ queryKey: ["emprendimientos"] });
    } catch (e) {
      console.error(e);
      toast.error("No se pudo guardar tu voto");
    }
  };

  // ===== Reportes =====
  const openReportModal = (business) => {
    if (!user) {
      toast.error("Tenés que iniciar sesión para reportar.");
      return;
    }
    setReportBusiness(business);
    setReportComment("");
  };

  const submitReport = async () => {
    if (!reportBusiness || !reportComment.trim()) {
      toast.error("Escribí un comentario antes de enviar.");
      return;
    }

    try {
      setReportLoading(true);

      await addDoc(collection(db, "reports"), {
        publication_id: reportBusiness.id,
        publication_title: reportBusiness.title || "",
        owner_email:
          reportBusiness.created_by || reportBusiness.owner_email || null,
        reporter_uid: user.uid,
        reporter_email: user.email,
        comment: reportComment.trim(),
        category: reportBusiness.category || "emprendimiento",
        status: "open",
        created_at: serverTimestamp(),
      });

      toast.success("Reporte enviado. Gracias por avisar 🙌");
      setReportBusiness(null);
      setReportComment("");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo enviar el reporte.");
    } finally {
      setReportLoading(false);
    }
  };

  // ===== Filtros / estado =====
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest"); // "newest" | "nameAsc" | "topRated"
  const [showFavOnly, setShowFavOnly] = useState(false);

  // filtros extra
  const [typeFilter, setTypeFilter] = useState("all"); // productos | servicios | comida
  const [contactFilter, setContactFilter] = useState("all"); // all | whatsapp | instagram

  // Paginación
  const [page, setPage] = useState(1);
  const pageSize = 9;

  useEffect(() => {
    setPage(1);
  }, [
    searchTerm,
    locationFilter,
    sortBy,
    showFavOnly,
    favIds,
    typeFilter,
    contactFilter,
  ]);

  // ===== Query Firestore =====
  const {
    data: publications = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["emprendimientos", user?.uid || "guest"],
    queryFn: async () => {
      const col = collection(db, "publications");

      try {
        const q1 = fsQuery(
          col,
          where("category", "==", "emprendimiento"),
          where("status", "==", "active"),
          orderBy("created_date", "desc")
        );
        const s1 = await getDocs(q1);
        const rows1 = s1.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (rows1.length > 0) {
          const filtered = await filterByActiveSubscription(rows1);
          return filtered;
        }
      } catch (e) {
        console.warn(
          "[emprendimientos q1] Necesita índice o falló created_date/orderBy:",
          e?.code,
          e?.message
        );
      }

      try {
        const q2 = fsQuery(
          col,
          where("category", "==", "emprendimiento"),
          where("status", "==", "active")
        );
        const s2 = await getDocs(q2);
        const rows2 = s2.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (rows2.length > 0) {
          const sorted = rows2.sort(
            (a, b) =>
              new Date(b.created_date || 0) - new Date(a.created_date || 0)
          );
          const filtered = await filterByActiveSubscription(sorted);
          return filtered;
        }
      } catch (e) {
        console.warn(
          "[emprendimientos q2] Falla en where/lectura:",
          e?.code,
          e?.message
        );
      }

      // si nada funcionó → lista vacía
      return [];
    },
    enabled: !!user, // ✅ solo carga si hay usuario logueado
  });

  // Opciones de ubicación (ciudades)
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
      const matchesSearch =
        !term ||
        p?.title?.toLowerCase().includes(term) ||
        p?.description?.toLowerCase().includes(term) ||
        p?.location?.toLowerCase().includes(term);

      const city = getCityFromLocation(p?.location);
      const matchesLocation =
        locationFilter === "all" || city === locationFilter;

      const matchesFav = !showFavOnly || favIds.has(p.id);

      // filtro por rubro / tipo de negocio
      const matchesType =
        typeFilter === "all" ||
        (p.business_type || "").toLowerCase() === typeFilter;

      // filtro por tipo de contacto
      const hasWhatsapp = !!p.whatsapp || !!p.contact_whatsapp;
      const hasInstagram = !!p.instagram || !!p.contact_instagram;

      let matchesContact = true;
      if (contactFilter === "whatsapp") matchesContact = hasWhatsapp;
      if (contactFilter === "instagram") matchesContact = hasInstagram;

      return (
        matchesSearch &&
        matchesLocation &&
        matchesFav &&
        matchesType &&
        matchesContact
      );
    });

    // Orden principal
    list.sort((a, b) => {
      if (sortBy === "nameAsc") {
        return (a.title || "").localeCompare(b.title || "");
      }

      if (sortBy === "topRated") {
        const aCount = typeof a.rating_count === "number" ? a.rating_count : 0;
        const bCount = typeof b.rating_count === "number" ? b.rating_count : 0;

        const aHasVotes = aCount > 0;
        const bHasVotes = bCount > 0;

        // 1) Siempre primero los que tienen votos
        if (aHasVotes && !bHasVotes) return -1;
        if (!aHasVotes && bHasVotes) return 1;

        const aCreated = new Date(a.created_date || 0);
        const bCreated = new Date(b.created_date || 0);

        // 2) Ambos SIN votos -> ordenar solo por fecha (más nuevo primero)
        if (!aHasVotes && !bHasVotes) {
          return bCreated - aCreated;
        }

        // 3) Ambos CON votos -> ordenar por rating desc, luego cantidad de votos, luego fecha
        const aRating =
          typeof a.rating === "number" && !isNaN(a.rating) ? a.rating : 0;
        const bRating =
          typeof b.rating === "number" && !isNaN(b.rating) ? b.rating : 0;

        if (bRating !== aRating) return bRating - aRating;

        if (bCount !== aCount) return bCount - aCount;

        return bCreated - aCreated;
      }

      // default: más recientes
      return new Date(b.created_date || 0) - new Date(a.created_date || 0);
    });

    // luego favoritos primero (respetando el orden interno de la lista)
    list.sort(
      (a, b) => (favIds.has(b.id) ? 1 : 0) - (favIds.has(a.id) ? 1 : 0)
    );

    return list;
  }, [
    publications,
    searchTerm,
    locationFilter,
    sortBy,
    favIds,
    showFavOnly,
    typeFilter,
    contactFilter,
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
    setSortBy("newest");
    setShowFavOnly(false);
    setTypeFilter("all");
    setContactFilter("all");
    setPage(1);
  };
  // ===== Si no hay usuario logueado, mostrar mensaje =====
  if (subChecked && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-slate-100 flex items-center justify-center px-4">
        <Card className="max-w-md w-full shadow-lg border border-slate-200 bg-white/95">
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-orange-100 flex items-center justify-center">
              <Store className="w-6 h-6 text-orange-700" />
            </div>

            <h2 className="text-xl font-semibold text-slate-900">
              Iniciá sesión para ver los emprendimientos
            </h2>

            <p className="text-sm text-slate-600">
              Necesitás tener una cuenta en ConectCity para ver negocios,
              guardar favoritos y dejar valoraciones.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-2">
              <Link to="/login">
                <Button className="w-full sm:w-auto">
                  Ir a iniciar sesión
                </Button>
              </Link>
              <Link to="/registro">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto border-slate-300"
                >
                  Crear cuenta
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-orange-50 via-white to-slate-100">
      {/* Blob decorativo */}
      <div className="pointer-events-none absolute inset-x-0 -top-24 flex justify-center opacity-60">
        <div className="h-56 w-[820px] bg-gradient-to-r from-orange-300 via-amber-200 to-rose-200 blur-3xl rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-600 to-amber-500 rounded-2xl grid place-items-center shadow-lg shadow-orange-200/50">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
                Emprendimientos
              </h1>
              <p className="text-slate-600">
                Descubrí negocios y servicios locales en Iguazú y alrededores
              </p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Buscador */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <Input
                  placeholder="Buscar por nombre, servicio o zona..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Ubicación */}
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

            {/* Rubro / tipo de negocio */}
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="bg-white">
                <Store className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Tipo de negocio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los rubros</SelectItem>
                <SelectItem value="productos">Productos</SelectItem>
                <SelectItem value="servicios">Servicios</SelectItem>
                <SelectItem value="comida">Comida / Gastronomía</SelectItem>
              </SelectContent>
            </Select>

            {/* Orden */}
            <Select
              value={sortBy}
              onValueChange={(v) => {
                setSortBy(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="bg-white">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Orden" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Más recientes</SelectItem>
                <SelectItem value="nameAsc">Nombre (A-Z)</SelectItem>
                <SelectItem value="topRated">Mejor valorados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fila 2 de filtros: contacto + toggles */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-3 items-center">
              {/* tipo de contacto */}
              <Select
                value={contactFilter}
                onValueChange={(v) => {
                  setContactFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-52 bg-white">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Contacto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Cualquier contacto</SelectItem>
                  <SelectItem value="whatsapp">Con WhatsApp</SelectItem>
                  <SelectItem value="instagram">Con Instagram</SelectItem>
                </SelectContent>
              </Select>

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
                {typeFilter !== "all" && (
                  <span className="px-2.5 py-1 text-xs rounded-full bg-slate-100 border text-slate-700">
                    Rubro: <b>{typeFilter}</b>
                  </span>
                )}
                {contactFilter !== "all" && (
                  <span className="px-2.5 py-1 text-xs rounded-full bg-slate-100 border text-slate-700">
                    Contacto: <b>{contactFilter}</b>
                  </span>
                )}
                {sortBy !== "newest" && (
                  <span className="px-2.5 py-1 text-xs rounded-full bg-slate-100 border text-slate-700">
                    Orden:{" "}
                    <b>
                      {sortBy === "nameAsc"
                        ? "Nombre (A-Z)"
                        : sortBy === "topRated"
                        ? "Mejor valorados"
                        : "Recientes"}
                    </b>
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Botón para ordenar por mejor valorados */}
              <button
                onClick={() =>
                  setSortBy((prev) =>
                    prev === "topRated" ? "newest" : "topRated"
                  )
                }
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border text-sm transition-colors ${
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
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border text-sm transition-colors ${
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
                searchTerm ||
                sortBy !== "newest" ||
                showFavOnly ||
                typeFilter !== "all" ||
                contactFilter !== "all") && (
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  Limpiar todo
                </Button>
              )}

              {/* Publicar emprendimiento */}
              <Link
                to={
                  !user
                    ? "/login"
                    : hasActiveSub
                    ? "/admin?new=1&category=emprendimiento"
                    : "/planes-publicar"
                }
              >
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Publicar negocio
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
              {pageItems.map((business) => {
                const cover = business.images && business.images[0];
                const isFav = favIds.has(business.id);

                return (
                  <Card
                    key={business.id}
                    className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm hover:shadow-xl hover:border-orange-200 transition-all"
                  >
                    {/* Botón Favorito */}
                    <button
                      onClick={() => toggleFavorite(business)}
                      disabled={!!favBusy[business.id]}
                      title={
                        isFav ? "Quitar de favoritos" : "Agregar a favoritos"
                      }
                      className={`absolute right-3 top-3 z-10 rounded-full p-2 border bg-white/95 backdrop-blur shadow-sm transition-all
                        ${
                          isFav
                            ? "border-rose-300 ring-2 ring-rose-200"
                            : "border-slate-200 hover:bg-orange-50"
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
                          alt={business.title}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          onError={(e) => {
                            e.currentTarget.classList.add("hidden");
                            const fallback = e.currentTarget.nextElementSibling;
                            if (fallback) fallback.classList.remove("hidden");
                          }}
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/15 to-transparent opacity-80" />
                        <div className="hidden absolute inset-0 items-center justify-center text-slate-400 bg-slate-50">
                          <ImageOff className="w-10 h-10" />
                        </div>
                      </div>
                    ) : (
                      <div className="h-48 bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center">
                        <Store className="w-16 h-16 text-white/80" />
                      </div>
                    )}

                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <Badge className="bg-orange-100 text-orange-700">
                          Negocio
                        </Badge>
                        {business.featured && (
                          <Badge
                            variant="outline"
                            className="text-xs border-amber-300 text-amber-700 bg-amber-50 flex items-center gap-1"
                          >
                            <Star className="w-3 h-3" /> Destacado
                          </Badge>
                        )}
                      </div>

                      <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-orange-700 transition-colors line-clamp-1">
                        {business.title}
                      </h3>

                      {/* Rating con estrellas clickeables */}
                      <div className="mb-2">
                        {(() => {
                          const ratingCount =
                            typeof business.rating_count === "number"
                              ? business.rating_count
                              : 0;
                          const hasVotes = ratingCount > 0;

                          // si NO hay votos, ignoramos business.rating y lo tratamos como 0
                          const avgRating =
                            hasVotes &&
                            typeof business.rating === "number" &&
                            !isNaN(business.rating)
                              ? business.rating
                              : 0;

                          const userRating = userRatings[business.id] || null;
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
                                        handleRate(business, starValue)
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

                      <p className="text-slate-600 text-sm mb-4 line-clamp-3">
                        {business.description}
                      </p>

                      <div className="space-y-2 text-sm text-slate-600 mb-5">
                        {business.location && (
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                            {business.location}
                          </div>
                        )}

                        {business.contact_phone && (
                          <div className="flex items-center">
                            <Phone className="w-4 h-4 mr-2 text-slate-400" />
                            {business.contact_phone}
                          </div>
                        )}

                        {business.open_hours && (
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-2 text-slate-400" />
                            {business.open_hours}
                          </div>
                        )}

                        {/* rubro */}
                        {business.business_type && (
                          <div className="flex items-center text-xs uppercase tracking-wide text-orange-700/90">
                            <span className="px-2 py-0.5 rounded-full bg-orange-50 border border-orange-100">
                              {business.business_type}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
                        <Button
                          className="w-full bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 shadow-sm"
                          asChild
                        >
                          <Link to={`/emprendimientos/${business.id}`}>
                            Ver más info
                          </Link>
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:bg-red-50 shrink-0"
                          onClick={() => openReportModal(business)}
                        >
                          <Flag className="w-4 h-4 mr-1" />
                          Reportar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {filtered.length === 0 && (
                <div className="col-span-full text-center py-16 rounded-2xl border bg-white/70 backdrop-blur-sm">
                  <Store className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-700 text-lg">
                    No se encontraron emprendimientos
                  </p>
                  <p className="text-slate-500 text-sm">
                    Probá limpiando filtros o cambiando los términos de
                    búsqueda.
                  </p>
                  <div className="mt-6">
                    <Link
                      to={
                        !user
                          ? "/login"
                          : hasActiveSub
                          ? "/admin?new=1&category=emprendimiento"
                          : "/planes-publicar"
                      }
                    >
                      <Button className="gap-2">
                        <Plus className="w-4 h-4" />
                        Publicar emprendimiento
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
                          ? "bg-orange-600 text-white border-orange-600"
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
      <Dialog
        open={!!reportBusiness}
        onOpenChange={(open) => {
          if (!open) {
            setReportBusiness(null);
            setReportComment("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar negocio</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-slate-600 mb-2">
            Estás reportando:{" "}
            <span className="font-semibold">
              {reportBusiness?.title || "Sin título"}
            </span>
          </p>

          <Textarea
            placeholder="Contanos qué está mal en este emprendimiento…"
            rows={4}
            value={reportComment}
            onChange={(e) => setReportComment(e.target.value)}
          />

          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setReportBusiness(null);
                setReportComment("");
              }}
              disabled={reportLoading}
            >
              Cancelar
            </Button>

            <Button
              onClick={submitReport}
              disabled={reportLoading || !reportComment.trim()}
            >
              {reportLoading ? "Enviando…" : "Enviar reporte"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
