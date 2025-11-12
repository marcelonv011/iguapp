// src/pages/AlquilerDetalle.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query as fsQuery,
  where,
  orderBy,
  limit,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/firebase";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  DollarSign,
  Calendar,
  Share2,
  Heart,
  ImageOff,
  Phone,
  Mail,
  Building2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Wifi,
  Car,
  PawPrint,
  Wind,
  Flame,
} from "lucide-react";
import { Card, CardContent } from "@/ui/card";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";

/* ================= Helpers ================= */
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
  if (/(^|\b)(dia|diario|por dia|daily|per day|day)(\b|$)/.test(raw)) return "dia";
  if (/(^|\b)(mes|mensual|monthly|per month|month)(\b|$)/.test(raw)) return "mes";
  return "mes";
};

const formatARS = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(n || 0));

const onlyDigits = (s) => (s || "").replace(/\D+/g, "");

// chips visuales para comodidades con ícono
const yesNo = (v) =>
  v === true || String(v).toLowerCase() === "si" || String(v).toLowerCase() === "sí";

const getAmenities = (p = {}) => {
  const chips = [];

  if (p.wifi !== undefined || p.internet !== undefined) {
    const v = p.wifi ?? p.internet;
    if (v !== undefined) chips.push({ label: "Wi-Fi", ok: yesNo(v), icon: Wifi });
  }
  if (p.parking !== undefined || p.cochera !== undefined) {
    const v = p.parking ?? p.cochera;
    if (v !== undefined) chips.push({ label: "Cochera", ok: yesNo(v), icon: Car });
  }
  if (p.pets !== undefined || p.pets_allowed !== undefined || p.mascotas !== undefined) {
    const v = p.pets ?? p.pets_allowed ?? p.mascotas;
    if (v !== undefined) chips.push({ label: "Mascotas", ok: yesNo(v), icon: PawPrint });
  }
  if (p.ac !== undefined || p.aire !== undefined || p.aire_acondicionado !== undefined) {
    const v = p.ac ?? p.aire ?? p.aire_acondicionado;
    if (v !== undefined) chips.push({ label: "Aire acondicionado", ok: yesNo(v), icon: Wind });
  }
  if (p.bbq !== undefined || p.parrilla !== undefined) {
    const v = p.bbq ?? p.parrilla;
    if (v !== undefined) chips.push({ label: "Parrilla", ok: yesNo(v), icon: Flame });
  }
  if (p.balcon !== undefined) chips.push({ label: "Balcón", ok: yesNo(p.balcon) });
  if (p.patio !== undefined) chips.push({ label: "Patio", ok: yesNo(p.patio) });
  if (p.furnished !== undefined || p.amoblado !== undefined) {
    const v = p.furnished ?? p.amoblado;
    chips.push({ label: "Amoblado", ok: yesNo(v) });
  }

  return chips.filter((c) => c.ok !== undefined);
};

/* ================= Data fetchers ================= */
async function fetchAlquiler(id) {
  const ref = doc(db, "publications", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const r = snap.data();
  return {
    id: snap.id,
    ...r,
    created_date: r?.created_date?.toDate
      ? r.created_date.toDate()
      : r?.created_date
      ? new Date(r.created_date)
      : new Date(0),
  };
}

async function fetchSimilares(base, max = 6) {
  if (!base) return [];
  const col = collection(db, "publications");

  let candidatos = [];
  try {
    if (base.location) {
      const q1 = fsQuery(
        col,
        where("category", "==", "alquiler"),
        where("status", "==", "active"),
        where("location", "==", base.location),
        orderBy("created_date", "desc"),
        limit(12)
      );
      const s1 = await getDocs(q1);
      candidatos = s1.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
  } catch {
    /* índice faltante → fallback abajo */
  }

  if (candidatos.length === 0) {
    try {
      const q2 = fsQuery(
        col,
        where("category", "==", "alquiler"),
        where("status", "==", "active"),
        orderBy("created_date", "desc"),
        limit(20)
      );
      const s2 = await getDocs(q2);
      candidatos = s2.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
      const sAll = await getDocs(col);
      candidatos = sAll.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((x) => (x.category || "").toLowerCase() === "alquiler");
    }
  }

  const periodoBase = getNormalizedPeriod(base);
  const filtrados = candidatos
    .filter((x) => x.id !== base.id)
    .filter((x) => getNormalizedPeriod(x) === periodoBase);

  let final = filtrados;
  if (base.price) {
    final = final.sort(
      (a, b) => Math.abs((a.price || 0) - base.price) - Math.abs((b.price || 0) - base.price)
    );
  } else {
    final = final.sort(
      (a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0)
    );
  }
  return final.slice(0, max);
}

/* ================= Component ================= */
export default function AlquilerDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Auth + Favoritos
  const [user, setUser] = useState(null);
  const [favIds, setFavIds] = useState(new Set());
  const [favBusy, setFavBusy] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      if (!u) return setFavIds(new Set());
      const snap = await getDocs(collection(db, "users", u.uid, "favorites"));
      setFavIds(new Set(snap.docs.map((d) => d.id)));
    });
    return () => unsub();
  }, []);

  const { data: alquiler, isLoading, isError } = useQuery({
    queryKey: ["alquiler", id],
    queryFn: () => fetchAlquiler(id),
  });

  const { data: similares = [], isLoading: loadingSimilares } = useQuery({
    queryKey: ["alquiler-similares", id, alquiler?.location],
    queryFn: () => fetchSimilares(alquiler, 6),
    enabled: !!alquiler,
  });

  const isFav = !!(alquiler && favIds.has(alquiler.id));

  const toggleFavorite = async () => {
    if (!user) {
      toast.error("Iniciá sesión para guardar favoritos");
      return;
    }
    if (!alquiler) return;
    setFavBusy(true);
    try {
      const favRef = doc(db, "users", user.uid, "favorites", alquiler.id);
      if (isFav) {
        await deleteDoc(favRef);
        setFavIds((prev) => {
          const next = new Set(prev);
          next.delete(alquiler.id);
          return next;
        });
        toast("Quitado de favoritos");
      } else {
        await setDoc(favRef, {
          publication_id: alquiler.id,
          category: "alquiler",
          title: alquiler.title || "",
          created_at: serverTimestamp(),
        });
        setFavIds((prev) => {
          const next = new Set(prev);
          next.add(alquiler.id);
          return next;
        });
        toast.success("Guardado en favoritos");
      }
    } catch (e) {
      console.error(e);
      toast.error("No se pudo actualizar el favorito");
    } finally {
      setFavBusy(false);
    }
  };

  const formatter = useMemo(
    () => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }),
    []
  );

  const periodLabel = alquiler ? (getNormalizedPeriod(alquiler) === "mes" ? "mes" : "día") : "mes";

  // Galería
  const images = alquiler?.images || [];
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [id]);
  const goPrev = () => setIdx((i) => (i > 0 ? i - 1 : i));
  const goNext = () => setIdx((i) => (i < images.length - 1 ? i + 1 : i));

  // Share + WhatsApp (Maps solo en Contacto)
  const handleShare = async () => {
    try {
      const url = window.location.href;
      if (navigator.share) {
        await navigator.share({
          title: alquiler?.title || "Alquiler",
          text: alquiler?.description?.slice(0, 120),
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Enlace copiado");
      }
    } catch {}
  };

  const mapsUrl = useMemo(() => {
    const q = alquiler?.address || alquiler?.location || "";
    return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
  }, [alquiler]);

  const whatsappHref = alquiler?.contact_phone
    ? `https://wa.me/${onlyDigits(alquiler.contact_phone)}?text=${encodeURIComponent(
        `Hola, vi tu alquiler "${alquiler?.title}" y me interesa. ¿Sigue disponible?`
      )}`
    : null;

  /* ================= Skeleton / Error ================= */
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="h-8 w-40 bg-slate-200 rounded mb-6 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7">
            <div className="h-80 bg-slate-200 rounded-xl animate-pulse" />
          </div>
          <div className="lg:col-span-5">
            <div className="h-64 bg-slate-200 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !alquiler) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-xl font-semibold text-slate-800">Alquiler no encontrado</h2>
        <p className="text-slate-500 mb-6">Puede que haya sido eliminado o no exista.</p>
        <Button asChild>
          <Link to="/alquileres">Volver a Alquileres</Link>
        </Button>
      </div>
    );
  }

  const amenities = getAmenities(alquiler);

  /* ================= UI ================= */
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-purple-50 via-white to-slate-100">
      {/* Glow decor */}
      <div className="pointer-events-none absolute inset-x-0 -top-24 flex justify-center opacity-60">
        <div className="h-56 w-[820px] bg-gradient-to-r from-purple-300 via-fuchsia-200 to-indigo-200 blur-3xl rounded-full" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top actions (sin Maps) */}
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Volver
          </Button>

          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={handleShare}
              title="Compartir"
              className="rounded-xl px-4 py-2 border bg-white hover:bg-slate-50 transition inline-flex items-center gap-2 shadow-sm hover:shadow-md"
            >
              <Share2 className="w-4 h-4" />
              Compartir
            </button>
          </div>
        </div>

        {/* Header “glass” */}
        <div className="mb-6 rounded-2xl border border-purple-100 bg-white/70 backdrop-blur p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge className="bg-purple-100 text-purple-700">Alquiler</Badge>
                <Badge variant="outline" className="border-purple-200 text-purple-700">
                  {periodLabel === "mes" ? "Mensual" : "Por día"}
                </Badge>
                {alquiler?.created_date && (
                  <Badge variant="outline" className="gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {alquiler.created_date.toLocaleDateString()}
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-snug line-clamp-2">
                {alquiler.title || "Alquiler"}
              </h1>
              {alquiler.location && (
                <div className="mt-2 inline-flex items-center text-slate-600">
                  <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                  <span className="truncate">{alquiler.location}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={toggleFavorite}
                disabled={favBusy}
                title={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
                className={`rounded-full p-2 border bg-white/95 backdrop-blur shadow-sm transition-all ${
                  isFav ? "border-rose-300 ring-2 ring-rose-200" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Heart className={`w-5 h-5 ${isFav ? "text-rose-600" : "text-slate-700"}`} fill={isFav ? "currentColor" : "none"} />
              </button>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href);
                    toast.success("Enlace copiado");
                  } catch {}
                }}
                className="rounded-full p-2 border bg-white/95 backdrop-blur shadow-sm hover:bg-slate-50"
                title="Copiar enlace"
              >
                <Copy className="w-5 h-5 text-slate-700" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Galería */}
          <div className="lg:col-span-7">
            <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 backdrop-blur">
              <div className="relative">
                {images.length > 0 ? (
                  <>
                    {/* contador de fotos */}
                    <div className="absolute top-3 right-3 z-10 px-2 py-1 text-xs rounded-full bg-black/60 text-white">
                      {idx + 1} / {images.length}
                    </div>

                    <img
                      src={images[idx]}
                      alt={alquiler.title}
                      className="w-full h-80 md:h-[420px] object-cover"
                      loading="eager"
                      onError={(e) => {
                        e.currentTarget.classList.add("hidden");
                        const fallback = e.currentTarget.nextElementSibling;
                        if (fallback) fallback.classList.remove("hidden");
                      }}
                    />
                    <div className="hidden absolute inset-0 items-center justify-center text-slate-400 bg-slate-50">
                      <ImageOff className="w-10 h-10" />
                    </div>

                    {images.length > 1 && (
                      <>
                        <button
                          onClick={goPrev}
                          className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 border shadow hover:bg-white"
                          aria-label="Anterior"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          onClick={goNext}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 border shadow hover:bg-white"
                          aria-label="Siguiente"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>

                        <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5">
                          {images.map((_, i) => (
                            <span
                              key={i}
                              className={`h-1.5 rounded-full transition-all ${
                                i === idx ? "w-6 bg-purple-600" : "w-2.5 bg-white/70"
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="h-80 md:h-[420px] bg-gradient-to-br from-purple-400 to-indigo-500 grid place-items-center">
                    <Building2 className="w-16 h-16 text-white/80" />
                  </div>
                )}
              </div>

              {images.length > 1 && (
                <div className="p-3 grid grid-cols-5 gap-2">
                  {images.slice(0, 10).map((src, i) => (
                    <button
                      key={i}
                      onClick={() => setIdx(i)}
                      className={`h-16 rounded-lg overflow-hidden border ${
                        i === idx ? "border-purple-600 ring-2 ring-purple-200" : "border-slate-200"
                      }`}
                      title={`Imagen ${i + 1}`}
                    >
                      <img src={src} alt={`thumb-${i}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Panel derecho */}
          <div className="lg:col-span-5">
            <Card className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur">
              <CardContent className="p-6 space-y-6">
                {(alquiler.price || alquiler.price === 0) && (
                  <div className="inline-flex items-center text-xl md:text-2xl font-extrabold text-purple-700 rounded-full bg-purple-50 border border-purple-100 px-3 py-1">
                    <DollarSign className="w-5 h-5 mr-1" />
                    {formatter.format(Number(alquiler.price))}/{periodLabel}
                  </div>
                )}

                {alquiler.description && (
                  <section>
                    <h3 className="font-semibold text-slate-900 mb-2">Descripción</h3>
                    <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                      {alquiler.description}
                    </p>
                  </section>
                )}

                {amenities.length > 0 && (
                  <section>
                    <h3 className="font-semibold text-slate-900 mb-2">Comodidades</h3>
                    <div className="flex flex-wrap gap-2">
                      {amenities.map((a, i) => {
                        const Icon = a.icon;
                        return (
                          <span
                            key={i}
                            className="text-xs px-3 py-1 rounded-full border bg-white text-slate-700 inline-flex items-center gap-1.5 shadow-sm"
                            title={a.label}
                          >
                            {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
                            {a.label}
                          </span>
                        );
                      })}
                    </div>
                  </section>
                )}

                {(alquiler.contact_phone || alquiler.contact_email || mapsUrl) && (
                  <section className="p-4 rounded-2xl border bg-gradient-to-br from-slate-50 to-white">
                    <h3 className="font-semibold text-slate-900 mb-3">Contacto</h3>
                    <div className="space-y-2 text-sm">
                      {alquiler.contact_phone && (
                        <div className="inline-flex items-center gap-2">
                          <Phone className="w-4 h-4 text-slate-500" />
                          <span>{alquiler.contact_phone}</span>
                        </div>
                      )}
                      {alquiler.contact_email && (
                        <div className="inline-flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-500" />
                          <a href={`mailto:${alquiler.contact_email}`} className="underline decoration-dotted">
                            {alquiler.contact_email}
                          </a>
                        </div>
                      )}
                      {alquiler.address && (
                        <div className="inline-flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-500" />
                          <span className="truncate">{alquiler.address}</span>
                        </div>
                      )}
                    </div>

                    {/* Botones más bonitos */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {whatsappHref && (
                        <a href={whatsappHref} target="_blank" rel="noreferrer">
                          <Button className="w-full rounded-xl shadow-md hover:shadow-lg transition
                            bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-0">
                            WhatsApp
                          </Button>
                        </a>
                      )}
                      {alquiler.contact_email && (
                        <a href={`mailto:${alquiler.contact_email}`}>
                          <Button
                            variant="secondary"
                            className="w-full rounded-xl shadow-sm hover:shadow-md transition bg-white border border-slate-200"
                          >
                            Correo
                          </Button>
                        </a>
                      )}
                      {mapsUrl && (
                        <a href={mapsUrl} target="_blank" rel="noreferrer">
                          <Button
                            variant="outline"
                            className="w-full rounded-xl border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 shadow-sm"
                          >
                            Ver en Maps
                          </Button>
                        </a>
                      )}
                    </div>
                  </section>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Similares */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900">Otros alquileres similares</h2>
            <Link to="/alquileres" className="text-sm text-purple-700 hover:underline">
              Ver todos
            </Link>
          </div>

          {loadingSimilares ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse rounded-2xl">
                  <div className="h-40 bg-slate-200" />
                  <CardContent className="p-4">
                    <div className="h-5 bg-slate-200 rounded mb-2" />
                    <div className="h-4 bg-slate-200 rounded w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : similares.length === 0 ? (
            <div className="rounded-2xl border bg-white/70 p-6 text-slate-600">
              No encontramos similares. Probá volver al listado.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {similares.map((p) => {
                const cover = p.images?.[0];
                const per = getNormalizedPeriod(p);
                const priceLabel =
                  p.price != null ? `${formatARS(p.price)}/${per === "mes" ? "mes" : "día"}` : null;

                return (
                  <Card
                    key={p.id}
                    className="group overflow-hidden rounded-2xl border border-slate-200 bg-white/90 hover:shadow-xl transition"
                  >
                    {cover ? (
                      <div className="h-40 overflow-hidden bg-slate-50">
                        <img
                          src={cover}
                          alt={p.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="h-40 bg-gradient-to-br from-purple-400 to-indigo-500 grid place-items-center">
                        <Building2 className="w-10 h-10 text-white/80" />
                      </div>
                    )}
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                          {per === "mes" ? "Mensual" : "Por día"}
                        </span>
                      </div>
                      <h3 className="font-semibold text-slate-900 line-clamp-1 mb-1">{p.title}</h3>
                      <p className="text-sm text-slate-600 line-clamp-2 mb-3">{p.description}</p>
                      {priceLabel && (
                        <div className="text-sm font-bold text-purple-700 mb-3 inline-flex items-center gap-1">
                          <DollarSign className="w-4 h-4" /> {priceLabel}
                        </div>
                      )}
                      <Button asChild className="w-full rounded-xl bg-white border border-slate-200 hover:bg-slate-50">
                        <Link to={`/alquileres/${p.id}`}>Ver detalles</Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Barra flotante (mobile) */}
      {(alquiler.price || alquiler.contact_phone || alquiler.contact_email) && (
        <div className="fixed bottom-0 inset-x-0 z-20 border-t bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-lg sm:hidden">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            {(alquiler.price || alquiler.price === 0) && (
              <div className="text-base font-extrabold text-purple-700 inline-flex items-center">
                <DollarSign className="w-4 h-4" />
                {formatARS(alquiler.price)}/{periodLabel}
              </div>
            )}
            <div className="flex items-center gap-2">
              {whatsappHref && (
                <a href={whatsappHref} target="_blank" rel="noreferrer">
                  <Button size="sm" className="rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-0 shadow">
                    WhatsApp
                  </Button>
                </a>
              )}
              {alquiler.contact_email && (
                <a href={`mailto:${alquiler.contact_email}`}>
                  <Button size="sm" variant="secondary" className="rounded-lg bg-white border border-slate-200">
                    Correo
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
