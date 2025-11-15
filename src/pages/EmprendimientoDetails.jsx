// src/pages/EmprendimientoDetails.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Store,
  MapPin,
  Tag,
  ArrowLeft,
  Heart,
  ImageOff,
  Phone,
  Mail,
  Clock,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Star,
  Calendar,
} from "lucide-react";
import { Card, CardContent } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { toast } from "sonner";

import { db, auth } from "@/firebase";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// ========= Helper: obtiene ciudad desde location =========
function getCityFromLocation(location) {
  if (!location) return null;
  let loc = location.toString().trim();

  const commaParts = loc
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (commaParts.length > 0) {
    loc = commaParts[commaParts.length - 1];
  }

  const dashParts = loc
    .split("-")
    .map((p) => p.trim())
    .filter(Boolean);
  if (dashParts.length > 0) {
    loc = dashParts[0];
  }

  return loc || null;
}

export default function EmprendimientoDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Favoritos / auth
  const [user, setUser] = useState(null);
  const [favIds, setFavIds] = useState(new Set());
  const [favBusy, setFavBusy] = useState({});

  // Rating del usuario para ESTE emprendimiento
  const [userRating, setUserRating] = useState(null);

  // Carrusel
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0,
      }),
    []
  );

  // Auth + favoritos
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      if (!u) {
        setFavIds(new Set());
        setUserRating(null);
        return;
      }

      try {
        const snap = await getDocs(collection(db, "users", u.uid, "favorites"));
        setFavIds(new Set(snap.docs.map((d) => d.id)));
      } catch (e) {
        console.error("[emprendimiento details] error leyendo favoritos:", e);
      }
    });
    return () => unsub();
  }, []);

  // Cargar emprendimiento por ID
  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const ref = doc(db, "publications", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setLoadError("No se encontró este emprendimiento.");
          setBusiness(null);
          return;
        }
        const r = snap.data();
        const created =
          r?.created_date?.toDate?.() ??
          (r?.created_date ? new Date(r.created_date) : new Date(0));

        const businessType =
          (
            r?.business_type ||
            r?.rubro ||
            r?.tipo_negocio ||
            ""
          )
            .toString()
            .toLowerCase() || null;

        setBusiness({
          id: snap.id,
          ...r,
          created_date: created,
          images: Array.isArray(r?.images) ? r.images : [],
          businessType,
          category: (r?.category || "").toString().toLowerCase(),
          status: (r?.status || "").toString().toLowerCase(),
        });
        setCurrentImageIndex(0);
      } catch (e) {
        console.error("[emprendimiento details] error cargando doc:", e);
        setLoadError("Ocurrió un error al cargar el emprendimiento.");
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  // Cargar rating previo del usuario para este emprendimiento
  useEffect(() => {
    async function loadUserRating() {
      if (!user || !business) return;
      try {
        const ratingRef = doc(
          db,
          "users",
          user.uid,
          "business_ratings",
          business.id
        );
        const snap = await getDoc(ratingRef);
        if (snap.exists() && typeof snap.data().value === "number") {
          setUserRating(snap.data().value);
        } else {
          setUserRating(null);
        }
      } catch (e) {
        console.error(
          "[emprendimiento details] error leyendo rating usuario:",
          e
        );
      }
    }
    loadUserRating();
  }, [user, business]);

  const isFav = business && favIds.has(business.id);

  const toggleFavorite = async () => {
    if (!business) return;
    if (!user) {
      toast.error("Iniciá sesión para guardar favoritos");
      return;
    }
    const pid = business.id;
    setFavBusy((m) => ({ ...m, [pid]: true }));
    try {
      const favRef = doc(db, "users", user.uid, "favorites", pid);
      const currentlyFav = favIds.has(pid);

      if (currentlyFav) {
        await deleteDoc(favRef);
        setFavIds((prev) => {
          const next = new Set(prev);
          next.delete(pid);
          return next;
        });
        toast("Quitado de favoritos");
      } else {
        await setDoc(favRef, {
          publication_id: pid,
          category: business.category || "emprendimiento",
          title: business.title || "",
          created_at: serverTimestamp(),
        });
        setFavIds((prev) => {
          const next = new Set(prev);
          next.add(pid);
          return next;
        });
        toast.success("Guardado en favoritos");
      }
    } catch (e) {
      console.error("[emprendimiento details] toggle fav error:", e);
      toast.error("No se pudo actualizar el favorito");
    } finally {
      setFavBusy((m) => ({ ...m, [pid]: false }));
    }
  };

  const handleRate = async (value) => {
    if (!business) return;
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
          count += 1;
          sum += value;
        } else {
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

        setBusiness((prev) =>
          prev
            ? {
                ...prev,
                rating: avg,
                rating_count: count,
                rating_sum: sum,
              }
            : prev
        );
      });

      setUserRating(value);
      toast.success(`Calificación enviada: ${value}★`);
    } catch (e) {
      console.error("[emprendimiento details] error guardando voto:", e);
      toast.error("No se pudo guardar tu voto");
    }
  };

  const images = business && business.images ? business.images : [];
  const mainImage =
    images && images.length > 0 ? images[currentImageIndex] : null;

  const city = business ? getCityFromLocation(business.location) : null;

  const createdLabel =
    business && business.created_date
      ? new Date(business.created_date).toLocaleDateString()
      : null;

  const goPrevImage = () => {
    if (!images.length) return;
    setCurrentImageIndex((idx) => (idx === 0 ? images.length - 1 : idx - 1));
  };

  const goNextImage = () => {
    if (!images.length) return;
    setCurrentImageIndex((idx) => (idx === images.length - 1 ? 0 : idx + 1));
  };

  // Contactos
  const phone =
    business?.contact_phone ||
    business?.whatsapp ||
    business?.contact_whatsapp ||
    "";
  const instagram = business?.instagram || business?.contact_instagram || "";
  const email = business?.contact_email || "";
  const openHours = business?.open_hours || "";

  const normalizedInstagram = instagram.replace(/^@/, "");
  const instagramUrl =
    normalizedInstagram && !normalizedInstagram.startsWith("http")
      ? `https://instagram.com/${normalizedInstagram}`
      : normalizedInstagram || "";

  const avgRating =
    business && typeof business.rating === "number" && !isNaN(business.rating)
      ? business.rating
      : 0;
  const ratingCount =
    business && typeof business.rating_count === "number"
      ? business.rating_count
      : 0;
  const roundedAvg = Math.round(avgRating);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-slate-100 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Barra superior: volver + favorito */}
        <div className="mb-6">
          <div className="flex items-center justify-between rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200 px-3 sm:px-4 py-2.5 shadow-sm">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="ghost"
                className="gap-2 px-2 sm:px-3"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Volver</span>
              </Button>
            </div>

            {business && (
              <button
                onClick={toggleFavorite}
                disabled={!!favBusy[business.id]}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs sm:text-sm transition-colors shadow-sm ${
                  isFav
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Heart
                  className={`w-4 h-4 ${
                    isFav ? "text-rose-600" : "text-slate-500"
                  }`}
                  fill={isFav ? "currentColor" : "none"}
                />
                {isFav ? "Quitar de favoritos" : "Guardar favorito"}
              </button>
            )}
          </div>
        </div>

        {/* Loading / error */}
        {loading && (
          <Card className="rounded-2xl bg-white/85 backdrop-blur-md border border-slate-200 shadow-sm">
            <CardContent className="p-6 animate-pulse">
              <div className="h-6 bg-slate-200 rounded w-1/3 mb-4" />
              <div className="h-4 bg-slate-200 rounded w-1/4 mb-2" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="h-64 bg-slate-200 rounded-2xl" />
                <div className="space-y-3">
                  <div className="h-4 bg-slate-200 rounded w-2/3" />
                  <div className="h-4 bg-slate-200 rounded w-5/6" />
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && loadError && (
          <Card className="rounded-2xl bg-white/90 backdrop-blur-md border border-red-200 shadow-sm">
            <CardContent className="p-6 text-center">
              <p className="text-red-600 font-medium mb-2">{loadError}</p>
              <p className="text-slate-500 text-sm mb-4">
                Puede que este negocio haya sido eliminado o
                desactivado.
              </p>
              <Button asChild>
                <Link to="/emprendimientos">Volver a negocios</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && !loadError && business && (
          <>
            {/* Header con título + chips + rating */}
            <div className="mb-7">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                {business.businessType && (
                  <Badge
                    variant="outline"
                    className="border-amber-200 text-amber-700 bg-amber-50/60"
                  >
                    <Tag className="w-3 h-3 mr-1" />
                    {business.businessType.charAt(0).toUpperCase() +
                      business.businessType.slice(1)}
                  </Badge>
                )}

                {city && (
                  <Badge
                    variant="outline"
                    className="text-slate-700 bg-white/70"
                  >
                    <MapPin className="w-3 h-3 mr-1" />
                    {city}
                  </Badge>
                )}

                {createdLabel && (
                  <span className="inline-flex items-center text-xs text-slate-500 bg-white/70 px-2 py-1 rounded-full border border-slate-100">
                    <Calendar className="w-3 h-3 mr-1" />
                    Publicado el {createdLabel}
                  </span>
                )}
              </div>

              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
                {business.title}
              </h1>

              {business.description && (
                <p className="text-sm md:text-base text-slate-600 max-w-2xl mb-3">
                  {business.description.slice(0, 160)}
                  {business.description.length > 160 && "…"}
                </p>
              )}

              {/* Rating principal */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const starValue = i + 1;
                    const filled = starValue <= roundedAvg;
                    const isUserStar = userRating === starValue;

                    return (
                      <button
                        key={starValue}
                        type="button"
                        onClick={() => handleRate(starValue)}
                        className="focus:outline-none"
                        title={
                          user
                            ? `Calificar con ${starValue} estrellas`
                            : "Iniciá sesión para calificar"
                        }
                      >
                        <Star
                          className={`w-5 h-5 transition-transform ${
                            filled
                              ? "text-amber-400 fill-amber-400"
                              : "text-slate-300"
                          } ${isUserStar ? "scale-110" : ""}`}
                        />
                      </button>
                    );
                  })}

                  <span className="ml-1 text-xs text-slate-500">
                    {avgRating > 0
                      ? `${avgRating.toFixed(1)}/5`
                      : "Sin valoraciones"}
                    {ratingCount > 0 && <> ({ratingCount})</>}
                  </span>
                </div>

                {user ? (
                  userRating ? (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Tu voto: {userRating}★
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-0.5 italic">
                      Aún no votaste
                    </p>
                  )
                ) : (
                  <p className="text-[11px] text-slate-400 mt-0.5 italic">
                    Iniciá sesión para calificar
                  </p>
                )}
              </div>
            </div>

            {/* Layout principal */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {/* Imagen grande + carrusel */}
              <Card className="overflow-hidden rounded-2xl bg-white/90 border border-slate-200 shadow-sm">
                {mainImage ? (
                  <div className="relative h-72 md:h-80 bg-slate-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-100/60 via-white to-slate-50 pointer-events-none" />
                    <img
                      src={mainImage}
                      alt={business.title}
                      className="relative w-full h-full object-contain p-4 md:p-6 transition-transform duration-500 hover:scale-[1.02]"
                      onError={(e) => {
                        e.currentTarget.classList.add("hidden");
                        const fallback = e.currentTarget.nextElementSibling;
                        if (fallback) fallback.classList.remove("hidden");
                      }}
                    />
                    <div className="hidden absolute inset-0 items-center justify-center text-slate-400 bg-slate-50">
                      <ImageOff className="w-12 h-12" />
                    </div>

                    {images.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={goPrevImage}
                          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/85 border border-slate-200 p-2 shadow-sm hover:bg-orange-50"
                        >
                          <ChevronLeft className="w-5 h-5 text-slate-700" />
                        </button>
                        <button
                          type="button"
                          onClick={goNextImage}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/85 border border-slate-200 p-2 shadow-sm hover:bg-orange-50"
                        >
                          <ChevronRight className="w-5 h-5 text-slate-700" />
                        </button>
                      </>
                    )}

                    {images.length > 1 && (
                      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                        {images.map((_, idx) => (
                          <span
                            key={idx}
                            className={`h-1.5 rounded-full transition-all ${
                              idx === currentImageIndex
                                ? "w-5 bg-orange-500"
                                : "w-2 bg-slate-300"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-72 md:h-80 bg-gradient-to-br from-orange-400 to-amber-500 flex flex-col items-center justify-center text-white">
                    <Store className="w-16 h-16 mb-2 opacity-80" />
                    <p className="font-semibold opacity-90">
                      Sin imagen disponible
                    </p>
                  </div>
                )}

                {images.length > 1 && (
                  <CardContent className="px-4 pb-4 pt-3 border-t border-slate-100">
                    <div className="flex gap-2 overflow-x-auto">
                      {images.map((img, idx) => (
                        <button
                          type="button"
                          key={idx}
                          onClick={() => setCurrentImageIndex(idx)}
                          className={`relative h-16 w-16 flex-shrink-0 rounded-xl overflow-hidden border transition-all ${
                            idx === currentImageIndex
                              ? "border-orange-500 ring-2 ring-orange-200"
                              : "border-slate-200 hover:border-orange-300"
                          }`}
                        >
                          <img
                            src={img}
                            alt={`Foto ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </CardContent>
                )}

                <CardContent className="px-4 pb-4 pt-2 space-y-2">
                  {(city || business.location) && (
                    <div className="flex items-start text-sm text-slate-700">
                      <MapPin className="w-4 h-4 mr-2 mt-0.5 text-slate-400" />
                      <div className="font-medium">
                        {city || business.location}
                      </div>
                    </div>
                  )}

                  {openHours && (
                    <div className="flex items-start text-sm text-slate-700">
                      <Clock className="w-4 h-4 mr-2 mt-0.5 text-slate-400" />
                      <div>{openHours}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Detalles y contacto */}
              <div className="space-y-4">
                <Card className="rounded-2xl bg-white/95 border border-slate-200 shadow-sm">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-7 w-7 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center">
                        <Store className="w-4 h-4" />
                      </div>
                      <h2 className="text-base font-semibold text-slate-900">
                        Sobre el negocio
                      </h2>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                      {business.description || "Sin descripción detallada."}
                    </p>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl bg-white/95 border border-slate-200 shadow-sm">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-7 w-7 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                        <Phone className="w-4 h-4" />
                      </div>
                      <h2 className="text-base font-semibold text-slate-900">
                        Contacto
                      </h2>
                    </div>

                    {!phone && !email && !instagram && (
                      <p className="text-sm text-slate-500">
                        El emprendimiento no agregó datos de contacto. Podés
                        intentar buscarlo en la publicación original.
                      </p>
                    )}

                    <div className="space-y-2 text-sm text-slate-700">
                      {phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-slate-500" />
                          <span>{phone}</span>
                        </div>
                      )}

                      {email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-500" />
                          <a
                            href={`mailto:${email}`}
                            className="underline decoration-dotted hover:text-orange-700"
                          >
                            {email}
                          </a>
                        </div>
                      )}

                      {instagram && (
                        <div className="flex items-center gap-2">
                          <MessageCircle className="w-4 h-4 text-slate-500" />
                          {instagramUrl ? (
                            <a
                              href={instagramUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline decoration-dotted hover:text-orange-700"
                            >
                              @{normalizedInstagram || instagram}
                            </a>
                          ) : (
                            <span>@{normalizedInstagram || instagram}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Botones de acción rápidos */}
                    <div className="flex flex-wrap gap-3 pt-2">
                      {phone && (
                        <>
                          <Button
                            asChild
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            <a
                              href={`https://wa.me/${phone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <span className="inline-flex items-center gap-2">
                                <MessageCircle className="w-4 h-4" />
                                WhatsApp
                              </span>
                            </a>
                          </Button>

                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="border-slate-300"
                          >
                            <a href={`tel:${phone}`}>Llamar</a>
                          </Button>
                        </>
                      )}

                      {email && (
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="border-slate-300"
                        >
                          <a href={`mailto:${email}`}>Enviar email</a>
                        </Button>
                      )}

                      {instagramUrl && (
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="border-slate-300"
                        >
                          <a
                            href={instagramUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Ver en Instagram
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
