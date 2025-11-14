// src/pages/VentaDetails.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ShoppingBag,
  MapPin,
  DollarSign,
  Tag,
  ArrowLeft,
  Heart,
  ImageOff,
  Phone,
  Mail,
  Calendar,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
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

export default function VentaDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Favoritos
  const [user, setUser] = useState(null);
  const [favIds, setFavIds] = useState(new Set());
  const [favBusy, setFavBusy] = useState({});

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
        return;
      }
      try {
        const snap = await getDocs(collection(db, "users", u.uid, "favorites"));
        setFavIds(new Set(snap.docs.map((d) => d.id)));
      } catch (e) {
        console.error("[venta details] error leyendo favoritos:", e);
      }
    });
    return () => unsub();
  }, []);

  const isFav = product && favIds.has(product.id);

  const toggleFavorite = async () => {
    if (!product) return;
    if (!user) {
      toast.error("Iniciá sesión para guardar favoritos");
      return;
    }
    const pid = product.id;
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
          category: product.category || "venta",
          title: product.title || "",
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
      console.error("[venta details] toggle fav error:", e);
      toast.error("No se pudo actualizar el favorito");
    } finally {
      setFavBusy((m) => ({ ...m, [pid]: false }));
    }
  };

  // Cargar producto por ID
  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const ref = doc(db, "publications", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setLoadError("No se encontró esta publicación.");
          setProduct(null);
          return;
        }
        const r = snap.data();
        const created =
          r?.created_date?.toDate?.() ??
          (r?.created_date ? new Date(r.created_date) : new Date(0));

        setProduct({
          id: snap.id,
          ...r,
          created_date: created,
          images: Array.isArray(r?.images) ? r.images : [],
          saleCategory:
            (
              r?.sale_category ||
              r?.saleCategory ||
              r?.subcategory ||
              r?.rubro ||
              ""
            )
              .toString()
              .toLowerCase() || null,
          category: (r?.category || r?.tipo || "").toString().toLowerCase(),
          status: (r?.status || r?.estado || "").toString().toLowerCase(),
        });
        setCurrentImageIndex(0); // reset carrusel al cargar
      } catch (e) {
        console.error("[venta details] error cargando doc:", e);
        setLoadError("Ocurrió un error al cargar la publicación.");
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  const images = product && product.images ? product.images : [];
  const mainImage =
    images && images.length > 0 ? images[currentImageIndex] : null;

  const city = product ? getCityFromLocation(product.location) : null;

  const createdLabel =
    product && product.created_date
      ? new Date(product.created_date).toLocaleDateString()
      : null;

  const goPrevImage = () => {
    if (!images.length) return;
    setCurrentImageIndex((idx) => (idx === 0 ? images.length - 1 : idx - 1));
  };

  const goNextImage = () => {
    if (!images.length) return;
    setCurrentImageIndex((idx) => (idx === images.length - 1 ? 0 : idx + 1));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-slate-100 py-8">
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
              <div className="hidden sm:block h-4 w-px bg-slate-200" />
              <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500">
                <ShoppingBag className="w-4 h-4 text-green-500" />
                <span>Detalle de publicación</span>
              </div>
            </div>

            {product && (
              <button
                onClick={toggleFavorite}
                disabled={!!favBusy[product.id]}
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
                Puede que esta publicación haya sido eliminada o desactivada.
              </p>
              <Button asChild>
                <Link to="/ventas">Volver a ventas</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && !loadError && product && (
          <>
            {/* Header con título + precio + chips */}
            <div className="mb-7">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <Badge className="bg-green-100 text-green-700" tone="green">
                  Venta
                </Badge>
                {product.saleCategory && (
                  <Badge
                    variant="outline"
                    className="border-green-200 text-green-700 bg-green-50/40"
                  >
                    <Tag className="w-3 h-3 mr-1" />
                    {product.saleCategory.charAt(0).toUpperCase() +
                      product.saleCategory.slice(1)}
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
                {product.title}
              </h1>
              {product.description && (
                <p className="text-sm md:text-base text-slate-600 max-w-2xl mb-3">
                  {product.description.slice(0, 140)}
                  {product.description.length > 140 && "…"}
                </p>
              )}

              {product.price && (
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10 border border-green-200 text-green-700 font-bold text-xl shadow-sm">
                  <DollarSign className="w-5 h-5 mr-1" />
                  {formatter.format(Number(product.price))}
                </div>
              )}
            </div>

            {/* Layout principal */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {/* Imagen grande + carrusel */}
              <Card className="overflow-hidden rounded-2xl bg-white/90 border border-slate-200 shadow-sm">
                {mainImage ? (
                  <div className="relative h-72 md:h-80 bg-slate-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-100/60 via-white to-slate-50 pointer-events-none" />
                    <img
                      src={mainImage}
                      alt={product.title}
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

                    {/* Flechas carrusel */}
                    {images.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={goPrevImage}
                          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/85 border border-slate-200 p-2 shadow-sm hover:bg-green-50"
                        >
                          <ChevronLeft className="w-5 h-5 text-slate-700" />
                        </button>
                        <button
                          type="button"
                          onClick={goNextImage}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/85 border border-slate-200 p-2 shadow-sm hover:bg-green-50"
                        >
                          <ChevronRight className="w-5 h-5 text-slate-700" />
                        </button>
                      </>
                    )}

                    {/* Dots inferiores */}
                    {images.length > 1 && (
                      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                        {images.map((_, idx) => (
                          <span
                            key={idx}
                            className={`h-1.5 rounded-full transition-all ${
                              idx === currentImageIndex
                                ? "w-5 bg-green-500"
                                : "w-2 bg-slate-300"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-72 md:h-80 bg-gradient-to-br from-green-400 to-green-500 flex flex-col items-center justify-center text-white">
                    <ShoppingBag className="w-16 h-16 mb-2 opacity-80" />
                    <p className="font-semibold opacity-90">
                      Sin imagen disponible
                    </p>
                  </div>
                )}

                {/* Thumbnails */}
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
                              ? "border-green-500 ring-2 ring-green-200"
                              : "border-slate-200 hover:border-green-300"
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

                {/* Info rápida debajo de la imagen */}
                <CardContent className="px-4 pb-4 pt-2 space-y-2">
                  {(city || product.location) && (
                    <div className="flex items-start text-sm text-slate-700">
                      <MapPin className="w-4 h-4 mr-2 mt-0.5 text-slate-400" />
                      <div className="font-medium">
                        {city || product.location}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Detalles y contacto */}
              <div className="space-y-4">
                <Card className="rounded-2xl bg-white/95 border border-slate-200 shadow-sm">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-7 w-7 rounded-xl bg-green-100 text-green-700 flex items-center justify-center">
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                      <h2 className="text-base font-semibold text-slate-900">
                        Descripción
                      </h2>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                      {product.description || "Sin descripción detallada."}
                    </p>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl bg-white/95 border border-slate-200 shadow-sm">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-7 w-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <Phone className="w-4 h-4" />
                      </div>
                      <h2 className="text-base font-semibold text-slate-900">
                        Contacto
                      </h2>
                    </div>

                    {!product.contact_phone &&
                      !product.contact_email &&
                      !product.whatsapp && (
                        <p className="text-sm text-slate-500">
                          El vendedor no agregó datos de contacto. Podés
                          intentar buscarlo en la publicación original.
                        </p>
                      )}

                    <div className="space-y-2 text-sm text-slate-700">
                      {product.contact_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-slate-500" />
                          <span>{product.contact_phone}</span>
                        </div>
                      )}

                      {product.contact_email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-500" />
                          <a
                            href={`mailto:${product.contact_email}`}
                            className="underline decoration-dotted hover:text-green-700"
                          >
                            {product.contact_email}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Botones de acción rápidos */}
                    <div className="flex flex-wrap gap-3 pt-2">
                      {product.contact_phone && (
                        <>
                          <Button
                            asChild
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <a
                              href={`https://wa.me/${product.contact_phone.replace(
                                /\D/g,
                                ""
                              )}`}
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
                            <a href={`tel:${product.contact_phone}`}>Llamar</a>
                          </Button>
                        </>
                      )}

                      {product.contact_email && (
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="border-slate-300"
                        >
                          <a href={`mailto:${product.contact_email}`}>
                            Enviar email
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
