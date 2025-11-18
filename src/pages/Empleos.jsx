// src/pages/Empleos.jsx
import React, { useMemo, useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  MapPin,
  DollarSign,
  Clock,
  Search,
  SlidersHorizontal,
  RefreshCw,
  Building2,
  BadgeDollarSign,
  Globe,
  Heart,
  Plus,
  Flag,
} from "lucide-react";
import { Card, CardContent } from "@/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Textarea } from "@/ui/textarea";

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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ===== Firebase =====
import { db, auth } from "@/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query as fsQuery,
  where,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  addDoc,
} from "firebase/firestore";

// Helpers
const toNumber = (v) =>
  v === undefined || v === null || v === "" ? undefined : Number(v);

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
  // si no hay fecha, lo consideramos vencido
  return d ? d.getTime() < Date.now() : true;
};

// Filtra una lista de publicaciones según la suscripción del dueño
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

        // elijo la suscripción con end_date más lejana (igual que en AdminPanel)
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
        console.error("[empleos] error cargando sub de", email, e);
      }
    })
  );

  // Mantengo solo las publicaciones de usuarios con plan activo y no vencido
  return list.filter((p) => {
    const info = resultByEmail[p.created_by];
    if (!info) return false; // sin suscripción => no muestra
    if (info.sub.status !== "active") return false;
    if (info.expired) return false;
    return true;
  });
}

// ¿La publicación está vencida por suscripción?
const isPublicationExpired = (pub) => {
  const d = toJsDate(pub.subscription_end_date);
  if (!d) return false; // si no tiene fecha, la dejamos pasar (por ahora)
  return d.getTime() < Date.now();
};

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

// ===== Data fetch =====
async function fetchEmpleos() {
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
      title: r?.title || "(Sin título)",
      description: r?.description || "",
      location: r?.location || "",
      price: r?.price ?? r?.salary ?? null,
      company: r?.company || r?.business_name || r?.employer || "",
      employment_type: (r?.employment_type || r?.type || "")
        .toString()
        .toLowerCase(),
      work_mode: (r?.work_mode || r?.mode || "").toString().toLowerCase(),
      contact_phone: r?.contact_phone || r?.phone || "",
      contact_email: r?.contact_email || r?.email || "",
      category: (r?.category || r?.tipo || "").toString().toLowerCase(),
      status: (r?.status || r?.estado || "").toString().toLowerCase(),
      slug: r?.slug || d.id,
    };
  };

  const isEmpleoCat = (cat) =>
    ["empleo", "empleos", "job", "jobs", "trabajo"].includes(
      String(cat || "").toLowerCase()
    );

  const isActivoStatus = (st) =>
    ["active", "activo", "activa"].includes(String(st || "").toLowerCase());

  const tryQuery = async (q) => {
    const snap = await getDocs(q);
    return snap.docs.map(normalize);
  };

  // 1) Ideal
  try {
    const q1 = fsQuery(
      col,
      where("category", "==", "empleo"),
      where("status", "==", "active"),
      orderBy("created_date", "desc")
    );
    const r1 = await tryQuery(q1);
    return await filterByActiveSubscription(r1);
  } catch (e) {
    console.warn("[empleos] q1 falló:", e?.code || e);
  }

  // 2) Solo category=empleo
  try {
    const q2 = fsQuery(col, where("category", "==", "empleo"));
    const r2 = await tryQuery(q2);
    const activos = r2.filter((x) => isActivoStatus(x.status));
    const final = activos.sort((a, b) => b.created_date - a.created_date);
    return await filterByActiveSubscription(final);
  } catch (e) {
    console.warn("[empleos] q2 falló:", e?.code || e);
  }

  // 3) Fallback general
  try {
    const snap = await getDocs(col);
    const all = snap.docs.map(normalize);

    const empleoLike = all.filter((x) => isEmpleoCat(x.category));
    const activos = empleoLike.filter((x) => isActivoStatus(x.status));
    const final = activos.sort((a, b) => b.created_date - a.created_date);
    return await filterByActiveSubscription(final);
  } catch (e) {
    console.error("[empleos] fallo general:", e?.code || e);
    return [];
  }
}

export default function Empleos() {
  // ===== Auth + Favoritos =====
  const [user, setUser] = useState(null);
  const [favIds, setFavIds] = useState(new Set());
  const [favBusy, setFavBusy] = useState({}); // id -> boolean

  // ===== Reporte de publicaciones =====
  const [reportJob, setReportJob] = useState(null);
  const [reportComment, setReportComment] = useState("");
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      if (!u) return setFavIds(new Set());
      const snap = await getDocs(collection(db, "users", u.uid, "favorites"));
      setFavIds(new Set(snap.docs.map((d) => d.id)));
    });
    return () => unsub();
  }, []);

  const toggleFavorite = async (job) => {
    if (!user) {
      toast.error("Iniciá sesión para guardar favoritos");
      return;
    }
    const id = job.id;
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
          category: job.category || "empleo",
          title: job.title || "",
          created_at: serverTimestamp(),
        });
        setFavIds((prev) => new Set(prev).add(id));
        toast.success("Guardado en favoritos");
      }
    } catch (e) {
      console.error(e);
      toast.error("No se pudo actualizar el favorito");
    } finally {
      setFavBusy((m) => ({ ...m, [id]: false }));
    }
  };

  // ===== Reportes =====
  // ===== Reportes =====
  const openReportModal = (job) => {
    if (!user) {
      toast.error("Tenés que iniciar sesión para reportar.");
      return;
    }
    setReportJob(job);
    setReportComment("");
  };

  const submitReport = async () => {
    if (!reportJob || !reportComment.trim()) {
      toast.error("Escribí un comentario antes de enviar.");
      return;
    }

    try {
      setReportLoading(true);

      await addDoc(collection(db, "reports"), {
        publication_id: reportJob.id,
        publication_title: reportJob.title || "",
        owner_email: reportJob.created_by || reportJob.owner_email || null,
        reporter_uid: user.uid,
        reporter_email: user.email,
        comment: reportComment.trim(),
        category: reportJob.category || "empleo",
        status: "open",
        created_at: serverTimestamp(),
      });

      toast.success("Reporte enviado. Gracias por avisar 🙌");
      setReportJob(null);
      setReportComment("");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo enviar el reporte.");
    } finally {
      setReportLoading(false);
    }
  };

  // ===== URL params =====
  const [params, setParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(params.get("q") || "");
  const [locationFilter, setLocationFilter] = useState(
    params.get("loc") || "all"
  );
  const [typeFilter, setTypeFilter] = useState(params.get("type") || "all");
  const [remoteFilter, setRemoteFilter] = useState(
    params.get("remote") || "all"
  );
  const [minSalary, setMinSalary] = useState(params.get("min") || "");
  const [sortBy, setSortBy] = useState(params.get("sort") || "newest");
  const [page, setPage] = useState(Number(params.get("page")) || 1);
  const pageSize = 8;

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (searchTerm) next.set("q", searchTerm);
    else next.delete("q");
    if (locationFilter && locationFilter !== "all")
      next.set("loc", locationFilter);
    else next.delete("loc");
    if (typeFilter && typeFilter !== "all") next.set("type", typeFilter);
    else next.delete("type");
    if (remoteFilter && remoteFilter !== "all")
      next.set("remote", remoteFilter);
    else next.delete("remote");
    if (minSalary) next.set("min", String(minSalary));
    else next.delete("min");
    if (sortBy && sortBy !== "newest") next.set("sort", sortBy);
    else next.delete("sort");
    if (page > 1) next.set("page", String(page));
    else next.delete("page");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchTerm,
    locationFilter,
    typeFilter,
    remoteFilter,
    minSalary,
    sortBy,
    page,
  ]);

  // ===== Query =====
  const {
    data: publications = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["empleos"],
    queryFn: fetchEmpleos,
  });

  // ===== Opciones de ubicación (SOLO CIUDADES) =====
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

  // ===== Filtrado + orden + favoritos primero =====
  const filteredSorted = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const min = toNumber(minSalary) || 0;

    let list = (publications || []).filter((pub) => {
      // 👇 Si la suscripción del dueño está vencida, NO la mostramos
      if (isPublicationExpired(pub)) return false;

      const matchesSearch =
        !q ||
        pub.title?.toLowerCase().includes(q) ||
        pub.description?.toLowerCase().includes(q) ||
        pub.company?.toLowerCase().includes(q);

      const jobCity = getCityFromLocation(pub.location);
      const matchesLocation =
        locationFilter === "all" || jobCity === locationFilter;

      const matchesType =
        typeFilter === "all" ||
        (pub.employment_type || "").toLowerCase() === typeFilter;

      const matchesRemote =
        remoteFilter === "all" ||
        (pub.work_mode || "all").toLowerCase() === remoteFilter;

      const salary = Number(pub.price || pub.salary_min || 0);
      const matchesSalary = salary >= min;

      return (
        matchesSearch &&
        matchesLocation &&
        matchesType &&
        matchesRemote &&
        matchesSalary
      );
    });

    if (sortBy === "salary-desc")
      list.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    else if (sortBy === "salary-asc")
      list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    else if (sortBy === "A-Z")
      list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    else
      list.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

    // favoritos primero
    list.sort((a, b) => {
      const af = favIds.has(a.id) ? 1 : 0;
      const bf = favIds.has(b.id) ? 1 : 0;
      if (af !== bf) return bf - af;
      return 0;
    });

    return list;
  }, [
    publications,
    searchTerm,
    locationFilter,
    typeFilter,
    remoteFilter,
    minSalary,
    sortBy,
    favIds,
  ]);

  // ===== Paginación en memoria =====
  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredSorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  useEffect(() => {
    setPage(1);
  }, [searchTerm, locationFilter, typeFilter, remoteFilter, minSalary, sortBy]);

  const clearFilters = () => {
    setSearchTerm("");
    setLocationFilter("all");
    setTypeFilter("all");
    setRemoteFilter("all");
    setMinSalary("");
    setSortBy("newest");
    setPage(1);
  };

  // ===== UI =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
                Empleos
              </h1>
              <p className="text-slate-600">
                Encontrá tu próxima oportunidad laboral
              </p>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-md border border-slate-200 p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
              <div className="lg:col-span-5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <Input
                    placeholder="Buscar por título, empresa o descripción…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 shadow-sm"
                  />
                </div>
              </div>

              <div className="lg:col-span-3">
                <Select
                  value={locationFilter}
                  onValueChange={setLocationFilter}
                >
                  <SelectTrigger className="shadow-sm">
                    <MapPin className="w-4 h-4 mr-2" />
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

              <div className="lg:col-span-2">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="shadow-sm">
                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                    <SelectItem value="temp">Temporal</SelectItem>
                    <SelectItem value="freelance">Freelance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="lg:col-span-2">
                <Select value={remoteFilter} onValueChange={setRemoteFilter}>
                  <SelectTrigger className="shadow-sm">
                    <Globe className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Modalidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Cualquier modalidad</SelectItem>
                    <SelectItem value="onsite">Presencial</SelectItem>
                    <SelectItem value="hybrid">Híbrido</SelectItem>
                    <SelectItem value="remote">Remoto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="lg:col-span-12 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <BadgeDollarSign className="w-4 h-4 text-slate-500" />
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder="Salario mínimo (AR$)"
                    value={minSalary}
                    onChange={(e) => setMinSalary(e.target.value)}
                    className="shadow-sm"
                  />
                </div>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="shadow-sm">
                    <Clock className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Ordenar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Más recientes</SelectItem>
                    <SelectItem value="salary-desc">
                      Salario: mayor a menor
                    </SelectItem>
                    <SelectItem value="salary-asc">
                      Salario: menor a mayor
                    </SelectItem>
                    <SelectItem value="A-Z">A → Z</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={clearFilters}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" /> Limpiar filtros
                  </Button>
                  {/* Publicar empleo */}
                  <Link to="/admin?new=1&category=empleo" className="w-full">
                    <Button className="gap-2">
                      <Plus className="w-4 h-4" />
                      Publicar empleo
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="mb-6 flex items-center justify-between text-slate-600">
          <p>
            {filteredSorted.length}{" "}
            {filteredSorted.length === 1 ? "empleo" : "empleos"} encontrados
          </p>
          {filteredSorted.length > 0 && (
            <p className="text-sm">
              Página {currentPage} de {totalPages}
            </p>
          )}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse rounded-2xl bg-white/70">
                <CardContent className="p-6">
                  <div className="h-6 bg-slate-200 rounded mb-4"></div>
                  <div className="h-4 bg-slate-200 rounded mb-2"></div>
                  <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-12">
            <p className="text-slate-600">
              No pudimos cargar los empleos. Intentá nuevamente.
            </p>
            <div className="mt-4">
              <Button onClick={() => refetch()}>Reintentar</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pageItems.map((job) => {
                const isFav = favIds.has(job.id);
                return (
                  <Card
                    key={job.id}
                    className={cn(
                      "relative overflow-hidden border border-slate-200/70 rounded-2xl",
                      "bg-white/90 backdrop-blur-sm shadow-sm hover:shadow-xl hover:border-blue-200 transition-all group"
                    )}
                  >
                    {/* Ribbon si es favorito */}
                    {isFav && (
                      <div className="absolute -right-10 top-5 rotate-45 z-[5]">
                        <div className="bg-red-600 text-white text-xs font-semibold px-12 py-1 shadow-sm">
                          FAVORITO
                        </div>
                      </div>
                    )}

                    {/* Botón Favorito (corazón) */}
                    <button
                      onClick={() => toggleFavorite(job)}
                      disabled={!!favBusy[job.id]}
                      title={
                        isFav ? "Quitar de favoritos" : "Agregar a favoritos"
                      }
                      className={cn(
                        "absolute right-3 top-3 z-10 rounded-full p-2 border bg-white/95 backdrop-blur",
                        "hover:bg-blue-50 transition-colors shadow-sm",
                        isFav ? "border-blue-500" : "border-slate-200"
                      )}
                      aria-label={
                        isFav ? "Quitar de favoritos" : "Agregar a favoritos"
                      }
                    >
                      <Heart
                        className={cn(
                          "w-5 h-5 transition-colors",
                          isFav ? "text-red-600" : "text-slate-500"
                        )}
                        fill={isFav ? "currentColor" : "none"}
                      />
                    </button>

                    <CardContent className="p-6">
                      {/* Header con avatar y espacio al ícono */}
                      <div className="flex items-start justify-between mb-4 pr-16">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 grid place-items-center shadow-sm">
                            <Briefcase className="w-6 h-6 text-white" />
                          </div>
                          <div className="min-w-0">
                            <h3
                              className="text-lg md:text-xl font-extrabold tracking-tight text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-1"
                              title={job.title}
                            >
                              {job.title}
                            </h3>

                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs md:text-sm text-slate-600">
                              {job.company && (
                                <span className="inline-flex items-center gap-1">
                                  <Building2 className="w-4 h-4" />{" "}
                                  {job.company}
                                </span>
                              )}
                              {job.employment_type && (
                                <Badge
                                  variant="secondary"
                                  className="rounded-full bg-slate-100 text-slate-700 border"
                                >
                                  {(job.employment_type || "").replace(
                                    /\b\w/g,
                                    (m) => m.toUpperCase()
                                  )}
                                </Badge>
                              )}
                              {job.work_mode && (
                                <Badge
                                  variant="outline"
                                  className="rounded-full"
                                >
                                  {job.work_mode === "remote"
                                    ? "Remoto"
                                    : job.work_mode === "hybrid"
                                    ? "Híbrido"
                                    : "Presencial"}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <p className="text-slate-600/95 mb-4 leading-relaxed line-clamp-3">
                        {job.description}
                      </p>

                      <div className="flex flex-col gap-2 mb-4 text-sm">
                        {job.location && (
                          <div className="inline-flex items-center text-slate-700">
                            <MapPin className="w-4 h-4 mr-2 text-slate-400" />{" "}
                            {/* Solo ciudad en el card */}
                            {getCityFromLocation(job.location)}
                          </div>
                        )}

                        {(job.price || job.salary_min || job.salary_max) && (
                          <div className="inline-flex items-center">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">
                              <DollarSign className="w-4 h-4 mr-1" />
                              {job.salary_min && job.salary_max
                                ? `AR$ ${Number(
                                    job.salary_min
                                  ).toLocaleString()} – ${Number(
                                    job.salary_max
                                  ).toLocaleString()}`
                                : job.price
                                ? `AR$ ${Number(job.price).toLocaleString()}`
                                : job.salary_min
                                ? `Desde AR$ ${Number(
                                    job.salary_min
                                  ).toLocaleString()}`
                                : `Hasta AR$ ${Number(
                                    job.salary_max
                                  ).toLocaleString()}`}
                            </span>
                          </div>
                        )}

                        <div className="inline-flex items-center text-slate-500">
                          <Clock className="w-4 h-4 mr-2" />
                          Publicado{" "}
                          {new Date(job.created_date).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="pt-4 mt-2 border-t border-slate-200 flex items-center justify-between">
                        <div className="text-sm text-slate-600 space-x-3 truncate">
                          {job.contact_phone && (
                            <span className="truncate">
                              Tel: {job.contact_phone}
                            </span>
                          )}
                          {job.contact_email && (
                            <a
                              href={`mailto:${job.contact_email}`}
                              className="underline decoration-dotted hover:text-blue-700"
                            >
                              {job.contact_email}
                            </a>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Link to={`/empleos/${job.slug || job.id}`}>
                            <Button
                              size="sm"
                              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm"
                            >
                              Ver detalles
                            </Button>
                          </Link>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => openReportModal(job)}
                          >
                            <Flag className="w-4 h-4 mr-1" />
                            Reportar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Empty */}
            {filteredSorted.length === 0 && (
              <div className="col-span-full text-center py-14 rounded-2xl border bg-gradient-to-b from-white to-slate-50 mt-6">
                <Briefcase className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-700 text-lg mb-2">
                  No se encontraron empleos
                </p>
                <p className="text-slate-500 mb-6">
                  Probá ajustar los filtros o ampliar la búsqueda.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Button variant="secondary" onClick={clearFilters}>
                    Limpiar filtros
                  </Button>
                  <Link to="/admin?new=1&category=empleo">
                    <Button>Publicar empleo</Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Paginación */}
            {filteredSorted.length > 0 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <Button
                  variant="secondary"
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ← Anterior
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .slice(0, 6)
                  .map((n) => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={cn(
                        "px-3 py-2 rounded-md text-sm border",
                        n === currentPage
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white hover:bg-slate-50"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                <Button
                  variant="secondary"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Siguiente →
                </Button>
              </div>
            )}
          </>
        )}

        <Dialog
          open={!!reportJob}
          onOpenChange={(open) => {
            if (!open) {
              setReportJob(null);
              setReportComment("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reportar publicación</DialogTitle>
            </DialogHeader>

            <p className="text-sm text-slate-600 mb-2">
              Estás reportando:{" "}
              <span className="font-semibold">
                {reportJob?.title || "Sin título"}
              </span>
            </p>

            <Textarea
              placeholder="Contanos qué está mal en esta publicación…"
              rows={4}
              value={reportComment}
              onChange={(e) => setReportComment(e.target.value)}
            />

            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setReportJob(null);
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
    </div>
  );
}
