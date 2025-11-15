// src/pages/AdminPanel.jsx
import React, { useEffect, useState, useMemo } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { useSearchParams } from "react-router-dom";

import { db, auth } from "@/firebase";
import {
  Crown,
  Plus,
  Edit,
  Trash2,
  Upload,
  AlertCircle,
  MapPin,
  Search,
  LocateFixed,
  Wifi,
  Car,
  PawPrint,
  Wind,
  Flame,
  X,
  Check,
} from "lucide-react";
import { Card, CardContent } from "@/ui/card";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Textarea } from "@/ui/textarea";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { toast } from "sonner";
import { uploadToCloudinary } from "@/lib/uploadImage";

// helpers
const hasPriceCategory = (cat) => ["alquiler", "venta"].includes(String(cat));
const isEmpleo = (cat) => String(cat) === "empleo";

// === Fechas seguras: convierte Timestamp / string / Date a Date ===
const toJsDate = (v) => {
  if (!v) return null;
  if (v?.toDate) return v.toDate();
  if (v?.seconds) return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d) ? null : d;
};
const isExpired = (end) => {
  const d = toJsDate(end);
  return d ? d.getTime() < Date.now() : true; // si no hay fecha, tratamos como vencida
};

// fecha segura
const fmtDate = (v) => {
  if (!v) return "—";
  if (v?.toDate) return v.toDate().toLocaleDateString();
  if (v?.seconds) return new Date(v.seconds * 1000).toLocaleDateString();
  const d = new Date(v);
  return isNaN(d) ? "—" : d.toLocaleDateString();
};

// precio con sufijo
const prettyPrice = (p) => {
  if (typeof p?.price !== "number") return null;
  const formatted = p.price.toLocaleString("es-AR");
  if (p.category === "alquiler") {
    const modo = p.rent_type === "diario" ? "/día" : "/mes";
    return `$ ${formatted}${modo}`;
  }
  return `$ ${formatted}`;
};

// ==== Helpers de sincronización publicaciones <-> suscripción ====
async function bulkUpdateUserPublications(db, email, predicate, patchFn) {
  const q = query(
    collection(db, "publications"),
    where("created_by", "==", email)
  );
  const snap = await getDocs(q);
  const updates = [];
  snap.forEach((d) => {
    const data = d.data();
    if (predicate(data)) {
      updates.push(updateDoc(doc(db, "publications", d.id), patchFn(data)));
    }
  });
  await Promise.allSettled(updates);
}

// Pone inactivas las activas y guarda su estado previo para poder restaurar
async function deactivateAllActivePublications(db, email) {
  await bulkUpdateUserPublications(
    db,
    email,
    // antes: (p) => p.status === "active"
    // ahora: todo lo que NO esté "inactive" se apaga (incluye empleo sin status)
    (p) => (p.status ?? "active") !== "inactive",
    (p) => ({
      status: "inactive",
      // guardamos el previo solo si no estaba ya inactive
      prev_status: p.status ?? "active",
      deactivated_reason: "subscription_expired",
      deactivated_at: serverTimestamp(),
    })
  );
}

// Restaura a "active" solo las que estaban activas antes de expirar
async function reactivatePreviousActivePublications(db, email) {
  await bulkUpdateUserPublications(
    db,
    email,
    // solo los que quedaron inactive por vencimiento y antes eran "active"/sin status
    (p) =>
      (p.status ?? "inactive") === "inactive" &&
      p.deactivated_reason === "subscription_expired" &&
      (p.prev_status ?? "active") === "active",
    () => ({
      status: "active",
      prev_status: null,
      deactivated_reason: null,
      deactivated_at: null,
      updated_date: serverTimestamp(),
    })
  );
}

/* ================= MapSearchDialog ================= */
function MapSearchDialog({ open, onOpenChange, defaultQuery = "", onSelect }) {
  const [q, setQ] = useState(defaultQuery);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState(null); // {display_name, lat, lon, place_id, address?}
  const [geoBusy, setGeoBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ(defaultQuery || "");
    setResults([]);
    setPicked(null);
  }, [open, defaultQuery]);

  // buscar con debounce
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      const qq = (q || "").trim();
      if (!qq) {
        setResults([]);
        setPicked(null);
        return;
      }
      try {
        setLoading(true);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          qq
        )}&addressdetails=1&limit=8`;
        const res = await fetch(url, {
          headers: { "Accept-Language": "es-AR,es;q=0.9" },
          signal: controller.signal,
        });
        const data = await res.json();
        const arr = Array.isArray(data) ? data : [];
        setResults(arr);
        if (!picked && arr[0]) setPicked(arr[0]);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q, open]); // eslint-disable-line

  // Reemplazá solo esta función dentro de MapSearchDialog
  const handleUseMyLocation = async () => {
    if (!navigator.geolocation) {
      toast.error("Tu navegador no permite geolocalización");
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords;
          const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
          const res = await fetch(url, {
            headers: { "Accept-Language": "es-AR,es;q=0.9" },
          });
          const data = await res.json();

          // Armar dirección corta (calle/altura, barrio, ciudad)
          const a = data?.address || {};
          const street = [
            a.road,
            a.pedestrian,
            a.footway,
            a.path,
            a.cycleway,
          ].find(Boolean);
          const number = a.house_number ? `${a.house_number} ` : "";
          const area =
            a.neighbourhood || a.suburb || a.quarter || a.city_district;
          const city = a.city || a.town || a.village || a.municipality;
          const pieces = [];
          if (street) pieces.push(`${number}${street}`);
          if (area && area !== city) pieces.push(area);
          if (city) pieces.push(city);
          const short = pieces.length
            ? pieces.join(", ")
            : (data?.display_name || "").split(",").slice(0, 3).join(", ");

          const full = data?.display_name || short;

          // Refrescar vista del diálogo
          setPicked({
            place_id: `me-${lat}-${lon}`,
            lat,
            lon,
            display_name: full,
            address: data?.address,
          });
          setQ(short);

          // >>> Auto-aplicar al formulario principal y cerrar <<<
          onSelect({
            address: short,
            full_address: full,
            lat: parseFloat(lat),
            lon: parseFloat(lon),
          });
          onOpenChange(false);
          toast.success("Ubicación seleccionada");
        } catch {
          toast.error("No se pudo obtener la dirección");
        } finally {
          setGeoBusy(false);
        }
      },
      () => {
        toast.error("No pudimos tomar tu ubicación");
        setGeoBusy(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // address corta
  const shortAddress = (item) => {
    const a = item?.address || {};
    const street = [a.road, a.pedestrian, a.footway, a.path, a.cycleway].find(
      Boolean
    );
    const number = a.house_number ? `${a.house_number} ` : "";
    const area = a.neighbourhood || a.suburb || a.quarter || a.city_district;
    const city = a.city || a.town || a.village || a.municipality;
    const pieces = [];
    if (street) pieces.push(`${number}${street}`);
    if (area && area !== city) pieces.push(area);
    if (city) pieces.push(city);
    return pieces.length
      ? pieces.join(", ")
      : (item.display_name || "").split(",").slice(0, 3).join(", ");
  };

  // iframe OSM + link grande
  const previewSrc = picked
    ? (() => {
        const lat = parseFloat(picked.lat);
        const lon = parseFloat(picked.lon);
        const d = 0.01;
        const bbox = [
          (lon - d).toFixed(6),
          (lat - d).toFixed(6),
          (lon + d).toFixed(6),
          (lat + d).toFixed(6),
        ].join("%2C");
        return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`;
      })()
    : null;

  const bigMapHref = picked
    ? `https://www.openstreetmap.org/?mlat=${parseFloat(
        picked.lat
      )}&mlon=${parseFloat(picked.lon)}#map=16/${parseFloat(
        picked.lat
      )}/${parseFloat(picked.lon)}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-2xl shadow-2xl">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4">
          <DialogHeader className="p-0">
            <DialogTitle className="text-lg font-semibold">
              Buscar ubicación
            </DialogTitle>
          </DialogHeader>
          <p className="text-white/80 text-xs mt-1">
            Escribí una dirección o usá tu ubicación actual
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Búsqueda */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Av. Misiones 123, Puerto Iguazú…"
                className="pl-10 rounded-full shadow-sm"
                autoFocus
              />
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQ(defaultQuery || "");
                setResults([]);
                setPicked(null);
              }}
              title="Limpiar"
              className="rounded-full"
            >
              <X className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleUseMyLocation}
              disabled={geoBusy}
              className="rounded-full"
            >
              {geoBusy ? (
                "Ubicando…"
              ) : (
                <span className="inline-flex items-center gap-2">
                  <LocateFixed className="w-4 h-4" /> Mi ubicación
                </span>
              )}
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Lista resultados */}
            <div className="max-h-72 overflow-auto rounded-2xl border bg-white/70 backdrop-blur">
              {loading ? (
                <div className="p-4 text-sm text-slate-500">Buscando…</div>
              ) : results.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">
                  Escribí una dirección o tocá{" "}
                  <span className="font-medium">“Mi ubicación”</span>.
                </div>
              ) : (
                <ul className="divide-y">
                  {results.map((r) => (
                    <li
                      key={r.place_id}
                      className={`p-3 cursor-pointer transition-colors hover:bg-purple-50/70 ${
                        picked?.place_id === r.place_id
                          ? "bg-purple-50 ring-1 ring-purple-200"
                          : ""
                      }`}
                      onClick={() => setPicked(r)}
                    >
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-0.5 text-purple-600 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium line-clamp-1">
                            {r.display_name?.split(",").slice(0, 3).join(", ")}
                          </div>
                          <div className="text-xs text-slate-500 line-clamp-2">
                            {r.display_name}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Preview */}
            <div className="rounded-2xl border overflow-hidden bg-white/70 backdrop-blur">
              {previewSrc ? (
                <div className="flex flex-col">
                  <iframe
                    title="Mapa"
                    src={previewSrc}
                    className="w-full aspect-[2/1] border-0"
                    loading="lazy"
                  />
                  <div className="px-3 py-2 text-right">
                    <a
                      href={bigMapHref}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-purple-700 hover:underline"
                    >
                      Abrir mapa grande
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-slate-600 text-sm leading-relaxed">
                  El mapa se mostrará acá cuando elijas una dirección o uses{" "}
                  <span className="font-medium">“Mi ubicación”</span>.
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              disabled={!picked}
              onClick={() => {
                if (!picked) return;
                onSelect({
                  address: shortAddress(picked),
                  full_address: picked.display_name || null,
                  lat: parseFloat(picked.lat),
                  lon: parseFloat(picked.lon),
                });
                onOpenChange(false);
              }}
              className="rounded-full"
            >
              <Check className="w-4 h-4 mr-1" /> Usar esta ubicación
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================= AdminPanel ================= */
export default function AdminPanel() {
  const [searchParams] = useSearchParams();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [publications, setPublications] = useState([]);
  const [subscription, setSubscription] = useState(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [imageFiles, setImageFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "empleo",
    price: "",
    location: "",
    location_full: "",
    contact_phone: "",
    contact_email: "",
    status: "pending",
    geo_lat: null,
    geo_lon: null,

    // Empleo
    employment_type: "full-time",
    work_mode: "onsite",
    salary_min: "",
    salary_max: "",
    company: "",

    // Alquiler
    rent_type: "mensual",
    rooms: "",
    bathrooms: "",
    furnished: "no",
    expenses_included: "no",

    // Comodidades
    wifi: "no",
    parking: "no",
    pets: "no",
    ac: "no",
    bbq: "no",
    balcon: "no",
    patio: "no",

    // Venta
    condition: "nuevo",
    stock: "",
    brand: "",
    model: "",
    sale_category: "",

    // Emprendimiento
    website: "",
    instagram: "",
    whatsapp: "",
    delivery: "no",
    business_type: "servicios", // productos | servicios | comida
    rating: "5", // string en el form, número al guardar
    open_hours: "", // 👈 NUEVO
  });

  const [mapOpen, setMapOpen] = useState(false);

  // abrir modal por query
  useEffect(() => {
    const newFlag = searchParams.get("new");
    const cat = (searchParams.get("category") || "").toLowerCase();
    if (newFlag === "1") {
      setEditing(null);
      setForm((prev) => ({
        ...prev,
        category: ["empleo", "alquiler", "venta", "emprendimiento"].includes(
          cat
        )
          ? cat
          : "empleo",
        price: hasPriceCategory(cat) ? prev.price : "",
      }));
      setDialogOpen(true);
    }
  }, [searchParams]);

  // forzar 1 imagen en empleo
  useEffect(() => {
    if (isEmpleo(form.category) && imageFiles.length > 1) {
      setImageFiles((prev) => (prev.length ? [prev[0]] : []));
    }
  }, [form.category, imageFiles.length]);

  // auth + carga
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        toast.error("Iniciá sesión para entrar al panel");
        window.location.href = "/login";
        return;
      }
      setUser(u);
      try {
        const snap = await getDocs(
          query(collection(db, "users"), where("email", "==", u.email))
        );
        const data = snap.docs[0]?.data() || null;
        setProfile(data);
        const role = data?.role_type || "usuario";
        if (role !== "admin" && role !== "superadmin") {
          toast.error("No tenés permisos de Admin");
          window.location.href = "/";
          return;
        }
        await Promise.all([
          loadPublications(u.email),
          loadSubscription(u.email),
        ]);
      } catch (e) {
        console.error(e);
        toast.error("No se pudo cargar tu perfil");
        window.location.href = "/";
      }
    });
    return () => unsub();
  }, []);

  const loadPublications = async (email) => {
    try {
      const qPub = query(
        collection(db, "publications"),
        where("created_by", "==", email),
        orderBy("created_date", "desc")
      );
      const snap = await getDocs(qPub);
      setPublications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      if (e.code === "failed-precondition") {
        const qFallback = query(
          collection(db, "publications"),
          where("created_by", "==", email)
        );
        const snap = await getDocs(qFallback);
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        arr.sort((a, b) => {
          const ta = a.created_date?.toMillis
            ? a.created_date.toMillis()
            : new Date(a.created_date || 0).getTime();
          const tb = b.created_date?.toMillis
            ? b.created_date.toMillis()
            : new Date(b.created_date || 0).getTime();
          return tb - ta;
        });
        setPublications(arr);
      } else {
        console.error(e);
        throw e;
      }
    }
  };

  const loadSubscription = async (email) => {
    const qSub = query(
      collection(db, "subscriptions"),
      where("user_email", "==", email)
    );
    const snap = await getDocs(qSub);

    if (snap.empty) {
      setSubscription(null);
      // Sin plan = aseguramos publicaciones inactivas
      await deactivateAllActivePublications(db, email);
      return;
    }

    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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

    let sub = pickBest(docs);
    if (!sub) {
      setSubscription(null);
      await deactivateAllActivePublications(db, email);
      return;
    }

    const expired = isExpired(sub.end_date);
    const shouldBeStatus = expired ? "inactive" : "active";

    if (sub.status !== shouldBeStatus) {
      try {
        const patch = { status: shouldBeStatus };
        if (shouldBeStatus === "active") patch.publications_used = 0; // reset de cupo al renovar
        await updateDoc(doc(db, "subscriptions", sub.id), patch);
        sub = { ...sub, ...patch };
      } catch (e) {
        console.error("No se pudo sincronizar status de la suscripción:", e);
      }
    }

    setSubscription(sub);

    // === Sincroniza visibilidad de publicaciones según el estado del plan ===
    try {
      if (shouldBeStatus === "inactive") {
        await deactivateAllActivePublications(db, email);
      } else {
        await reactivatePreviousActivePublications(db, email);
      }
    } catch (e) {
      console.error(
        "No se pudo sincronizar publicaciones con la suscripción:",
        e
      );
    }
    await loadPublications(email);
  };

  const thisMonthCount = useMemo(() => {
    const now = new Date();
    return publications.filter((p) => {
      const d = p.created_date?.toDate
        ? p.created_date.toDate()
        : p.created_date
        ? new Date(p.created_date)
        : null;
      return (
        d &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    }).length;
  }, [publications]);

  // Si el plan trae publications_used/limit los usamos; si no, caemos al conteo por mes existente
  const planLimit = useMemo(() => {
    return typeof subscription?.publications_limit === "number"
      ? subscription.publications_limit
      : 3; // fallback
  }, [subscription]);

  const planUsed = useMemo(() => {
    // preferimos publications_used del plan si existe; si no, usamos thisMonthCount
    if (typeof subscription?.publications_used === "number") {
      return subscription.publications_used;
    }
    return thisMonthCount;
  }, [subscription, thisMonthCount]);

  const reachedLimit = planUsed >= planLimit;

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      category: "empleo",
      price: "",
      location: "",
      location_full: "",
      contact_phone: "",
      contact_email: "",
      status: "pending",
      geo_lat: null,
      geo_lon: null,
      employment_type: "full-time",
      work_mode: "onsite",
      salary_min: "",
      salary_max: "",
      company: "",
      rent_type: "mensual",
      rooms: "",
      bathrooms: "",
      furnished: "no",
      expenses_included: "no",
      wifi: "no",
      parking: "no",
      pets: "no",
      ac: "no",
      bbq: "no",
      balcon: "no",
      patio: "no",
      condition: "nuevo",
      stock: "",
      brand: "",
      model: "",
      sale_category: "",
      website: "",
      instagram: "",
      whatsapp: "",
      delivery: "no",
      business_type: "servicios",
      rating: "5",
      open_hours: "", // 👈 NUEVO
    });
    setImageFiles([]);
    setEditing(null);
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const f of files) uploaded.push(await uploadToCloudinary(f));
      if (isEmpleo(form.category)) {
        setImageFiles(uploaded.length ? [uploaded[0]] : []);
      } else {
        setImageFiles((prev) => [...prev, ...uploaded]);
      }
      toast.success("Imágenes subidas");
    } catch (err) {
      console.error(err);
      toast.error("Error subiendo imágenes");
    } finally {
      setUploading(false);
    }
  };

  const handleAddImageByUrl = () => {
    const url = imageUrlInput.trim();
    if (!url) return;
    try {
      new URL(url);
      if (isEmpleo(form.category)) {
        setImageFiles([url]);
      } else {
        setImageFiles((prev) => [...prev, url]);
      }
      setImageUrlInput("");
    } catch {
      toast.error("URL inválida");
    }
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();

    if (
      !subscription ||
      subscription.status !== "active" ||
      isExpired(subscription?.end_date)
    ) {
      toast.error("Necesitás una suscripción activa para publicar");
      return;
    }
    if (!editing && reachedLimit) {
      toast.error(`Alcanzaste tu límite de ${planLimit} publicaciones.`);
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      price:
        hasPriceCategory(form.category) && form.price !== ""
          ? Number(form.price)
          : null,
      location: form.location || null, // corta
      location_full: form.location_full || null, // completa
      contact_phone: form.contact_phone || null,
      contact_email: form.contact_email || user.email,
      status: form.status ? String(form.status) : "pending",
      images: imageFiles,
      created_by: user.email,
      geo_lat: form.geo_lat ?? null,
      geo_lon: form.geo_lon ?? null,
      ...(editing ? {} : { created_date: serverTimestamp() }),
      updated_date: serverTimestamp(),
    };

    if (form.category === "empleo") {
      Object.assign(payload, {
        company: form.company || null,
        employment_type: form.employment_type,
        work_mode: form.work_mode,
        salary_min: form.salary_min ? Number(form.salary_min) : null,
        salary_max: form.salary_max ? Number(form.salary_max) : null,
      });
    }
    if (form.category === "alquiler") {
      Object.assign(payload, {
        rent_type: form.rent_type,
        rooms: form.rooms || null,
        bathrooms: form.bathrooms || null,
        furnished: form.furnished,
        expenses_included: form.expenses_included,
        wifi: form.wifi === "si",
        parking: form.parking === "si",
        pets: form.pets === "si",
        ac: form.ac === "si",
        bbq: form.bbq === "si",
        balcon: form.balcon === "si",
        patio: form.patio === "si",
      });
    }
    if (form.category === "venta") {
      Object.assign(payload, {
        condition: form.condition,
        stock: form.stock ? Number(form.stock) : null,
        brand: form.brand || null,
        model: form.model || null,
        sale_category: form.sale_category || null, // 👈 GUARDA SUBCATEGORÍA
      });
    }
    if (form.category === "emprendimiento") {
  Object.assign(payload, {
    website: form.website || null,
    instagram: form.instagram || null,
    whatsapp: form.whatsapp || null,
    delivery: form.delivery,
    business_type: form.business_type || null,
    rating: form.rating ? Number(form.rating) : null,
    open_hours: form.open_hours || null,
  });
}



    try {
      if (editing) {
        await updateDoc(doc(db, "publications", editing.id), payload);
        toast.success("Publicación actualizada");
      } else {
        await addDoc(collection(db, "publications"), payload);
        // incrementamos el contador del plan si el doc de suscripción existe
        if (subscription?.id) {
          await updateDoc(doc(db, "subscriptions", subscription.id), {
            publications_used: increment(1),
          });
        }
        toast.success("Publicación creada");
      }
      setDialogOpen(false);
      resetForm();
      await loadPublications(user.email);
      await loadSubscription(user.email); // refrescá el plan por si llegó al límite
    } catch (e) {
      console.error(e);
      toast.error("Error guardando la publicación");
    }
  };

  const handleEdit = (p) => {
    setEditing(p);
    setForm({
      title: p.title || "",
      description: p.description || "",
      category: p.category || "empleo",
      price: p.price ?? "",
      location: p.location || "",
      location_full: p.location_full || "",
      contact_phone: p.contact_phone || "",
      contact_email: p.contact_email || "",
      status: p.status || "pending",
      geo_lat: p.geo_lat ?? null,
      geo_lon: p.geo_lon ?? null,
      company: p.company || "",
      employment_type: p.employment_type || "full-time",
      work_mode: p.work_mode || "onsite",
      salary_min: p.salary_min ?? "",
      salary_max: p.salary_max ?? "",
      rent_type: p.rent_type || "mensual",
      rooms: p.rooms ?? "",
      bathrooms: p.bathrooms ?? "",
      furnished: p.furnished || "no",
      expenses_included: p.expenses_included || "no",
      wifi: p.wifi ? "si" : "no",
      parking: p.parking ? "si" : "no",
      pets: p.pets ? "si" : "no",
      ac: p.ac ? "si" : "no",
      bbq: p.bbq ? "si" : "no",
      balcon: p.balcon ? "si" : "no",
      patio: p.patio ? "si" : "no",
      condition: p.condition || "nuevo",
      stock: p.stock ?? "",
      brand: p.brand || "",
      model: p.model || "",
      sale_category: p.sale_category || "",
      website: p.website || "",
      instagram: p.instagram || "",
      whatsapp: p.whatsapp || "",
      delivery: p.delivery || "no",
      business_type: p.business_type || "servicios",
      rating:
        typeof p.rating === "number" && !isNaN(p.rating)
          ? String(p.rating)
          : "5",
      open_hours: p.open_hours || "",
    });
    setImageFiles(
      Array.isArray(p.images)
        ? isEmpleo(p.category)
          ? [p.images[0]]
          : p.images
        : []
    );
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar esta publicación?")) return;
    try {
      await deleteDoc(doc(db, "publications", id));
      toast.success("Publicación eliminada");
      await loadPublications(user.email);
    } catch (e) {
      console.error(e);
      toast.error("Error eliminando");
    }
  };

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  const ToggleChip = ({ value, onChange, icon: Icon, label }) => (
    <button
      type="button"
      onClick={() => onChange(value === "si" ? "no" : "si")}
      className={`px-3 py-1 rounded-full border text-sm inline-flex items-center gap-1.5 ${
        value === "si"
          ? "bg-purple-600 text-white border-purple-600 shadow-sm"
          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
      }`}
      title={label}
    >
      {Icon ? <Icon className="w-4 h-4" /> : null}
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-slate-100">
      {/* Banner */}
      <div className="bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 text-white shadow-md mb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur grid place-items-center">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-white/80">
                <span>Inicio</span>
                <span>›</span>
                <span className="text-white">Admin</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">Panel de Admin</h1>
              <p className="text-white/80 text-sm">
                Gestioná tus publicaciones y tu plan
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 pt-2">
        {/* Suscripción */}
        <Card className="mb-8 bg-white/80 backdrop-blur shadow-md rounded-2xl">
          <CardContent className="p-5 md:p-6">
            <div className="flex items-start md:items-center justify-between gap-4 flex-wrap">
              <div className="min-w-[240px]">
                <h3 className="font-semibold text-lg mb-2">
                  Estado de Suscripción
                </h3>
                {subscription?.status === "active" ? (
                  <div className="space-y-1">
                    <span className="inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full bg-green-600 text-white shadow">
                      🟢 Activa
                    </span>
                    <p className="text-sm text-slate-700 mt-1">
                      Publicaciones:{" "}
                      <strong>
                        {planUsed}/{planLimit}
                      </strong>
                    </p>
                    <p className="text-sm text-slate-700">
                      Vence: {fmtDate(subscription?.end_date)}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <span className="inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full bg-red-600 text-white shadow">
                      🔴 Inactiva
                    </span>
                    <p className="text-sm text-slate-700 mt-1">
                      Necesitás activar tu suscripción para publicar.
                    </p>
                  </div>
                )}
              </div>

              <div className="shrink-0">
                <Dialog
                  open={dialogOpen}
                  onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) resetForm();
                  }}
                >
                  <DialogTrigger asChild>
                    <div>
                      <Button
                        className={`rounded-full font-semibold px-5 py-2 text-white shadow-md hover:shadow-lg transition-all border-none focus:outline-none focus:ring-0 ${
                          subscription?.status === "active"
                            ? "bg-green-600 hover:bg-green-700"
                            : "bg-red-600 hover:bg-red-700 cursor-not-allowed opacity-90"
                        }`}
                        disabled={
                          !subscription ||
                          subscription.status !== "active" ||
                          isExpired(subscription?.end_date) ||
                          reachedLimit
                        }
                        onClick={(e) => {
                          if (subscription?.status !== "active") {
                            e.preventDefault();
                            toast.error(
                              "Tu suscripción está inactiva. Contactanos para activarla."
                            );
                            return;
                          }
                          if (reachedLimit) {
                            e.preventDefault();
                            toast.error(
                              `Llegaste al límite de ${planLimit} publicaciones.`
                            );
                          }
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {subscription?.status === "active"
                          ? "Nueva Publicación"
                          : "Suscripción Inactiva"}
                      </Button>
                    </div>
                  </DialogTrigger>

                  {/* Formulario */}
                  <DialogContent className="sm:max-w-2xl w-[92vw] sm:w-auto max-h-[90vh] overflow-y-auto overflow-x-hidden">
                    <DialogHeader>
                      <DialogTitle>
                        {editing ? "Editar Publicación" : "Nueva Publicación"}
                      </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="title">Título *</Label>
                        <Input
                          id="title"
                          value={form.title}
                          onChange={(e) =>
                            setForm({ ...form, title: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="description">Descripción *</Label>
                        <Textarea
                          id="description"
                          rows={4}
                          value={form.description}
                          onChange={(e) =>
                            setForm({ ...form, description: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Categoría *</Label>
                          <Select
                            value={form.category}
                            onValueChange={(v) =>
                              setForm((prev) => ({
                                ...prev,
                                category: v,
                                price: hasPriceCategory(v) ? prev.price : "",
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Elegí categoría" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="empleo">Empleo</SelectItem>
                              <SelectItem value="alquiler">Alquiler</SelectItem>
                              <SelectItem value="venta">Venta</SelectItem>
                              <SelectItem value="emprendimiento">
                                Negocio
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {hasPriceCategory(form.category) && (
                          <div>
                            <Label htmlFor="price">Precio (opcional)</Label>
                            <Input
                              id="price"
                              type="number"
                              value={form.price}
                              onChange={(e) =>
                                setForm({ ...form, price: e.target.value })
                              }
                              placeholder={
                                form.category === "alquiler"
                                  ? "Ej: 250000 (AR$ por mes/día)"
                                  : "Ej: 450000"
                              }
                              min={0}
                            />
                          </div>
                        )}
                      </div>              

                      {/* Ubicación */}
                      <div>
                        <Label htmlFor="location">Ubicación</Label>
                        <div className="flex flex-wrap gap-2 items-center">
                          <Input
                            id="location"
                            value={form.location}
                            onChange={(e) =>
                              setForm({ ...form, location: e.target.value })
                            }
                            placeholder="Dirección, barrio o ciudad"
                            className="truncate flex-1 min-w-0"
                            title={form.location_full || form.location}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="inline-flex items-center gap-2 rounded-full shrink-0"
                            onClick={() => setMapOpen(true)}
                            title="Buscar en mapa"
                          >
                            <LocateFixed className="w-4 h-4" /> Mapa
                          </Button>
                        </div>

                        {form.geo_lat != null && form.geo_lon != null && (
                          <div className="mt-1 text-xs text-slate-600">
                            Coordenadas: {form.geo_lat.toFixed(6)},{" "}
                            {form.geo_lon.toFixed(6)} ·{" "}
                            <a
                              className="underline"
                              href={`https://www.google.com/maps/search/?api=1&query=${form.geo_lat},${form.geo_lon}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Ver en Maps
                            </a>
                          </div>
                        )}
                      </div>
                      {/* Datos de contacto */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="contact_phone">
                            Teléfono / WhatsApp *
                          </Label>
                          <Input
                            id="contact_phone"
                            type="tel"
                            placeholder="+54 9 3757 123456"
                            value={form.contact_phone}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                contact_phone: e.target.value,
                              })
                            }
                            required
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            Número que se mostrará en la publicación para
                            llamadas o WhatsApp.
                          </p>
                        </div>

                        <div>
                          <Label htmlFor="contact_email">
                            Email de contacto (opcional)
                          </Label>
                          <Input
                            id="contact_email"
                            type="email"
                            placeholder={user?.email || "tu-email@ejemplo.com"}
                            value={form.contact_email}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                contact_email: e.target.value,
                              })
                            }
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            Si lo dejás vacío se usará tu email de cuenta:{" "}
                            {user?.email}
                          </p>
                        </div>
                      </div>

                      {/* Por categoría */}
                      {form.category === "empleo" && (
                        <div className="rounded-lg border p-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>Empresa</Label>
                              <Input
                                value={form.company}
                                onChange={(e) =>
                                  setForm({ ...form, company: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <Label>Modalidad</Label>
                              <Select
                                value={form.work_mode}
                                onValueChange={(v) =>
                                  setForm({ ...form, work_mode: v })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="onsite">
                                    Presencial
                                  </SelectItem>
                                  <SelectItem value="hybrid">
                                    Híbrido
                                  </SelectItem>
                                  <SelectItem value="remote">Remoto</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Tipo de puesto</Label>
                              <Select
                                value={form.employment_type}
                                onValueChange={(v) =>
                                  setForm({ ...form, employment_type: v })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="full-time">
                                    Full-time
                                  </SelectItem>
                                  <SelectItem value="part-time">
                                    Part-time
                                  </SelectItem>
                                  <SelectItem value="temp">Temporal</SelectItem>
                                  <SelectItem value="freelance">
                                    Freelance
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Salario mínimo</Label>
                                <Input
                                  type="number"
                                  value={form.salary_min}
                                  onChange={(e) =>
                                    setForm({
                                      ...form,
                                      salary_min: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label>Salario máximo</Label>
                                <Input
                                  type="number"
                                  value={form.salary_max}
                                  onChange={(e) =>
                                    setForm({
                                      ...form,
                                      salary_max: e.target.value,
                                    })
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {form.category === "alquiler" && (
                        <div className="rounded-lg border p-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>Tipo de alquiler</Label>
                              <Select
                                value={form.rent_type}
                                onValueChange={(v) =>
                                  setForm({ ...form, rent_type: v })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="diario">
                                    Por día
                                  </SelectItem>
                                  <SelectItem value="mensual">
                                    Por mes
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Ambientes/Dormitorios</Label>
                              <Input
                                value={form.rooms}
                                onChange={(e) =>
                                  setForm({ ...form, rooms: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <Label>Baños</Label>
                              <Input
                                value={form.bathrooms}
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    bathrooms: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Amoblado</Label>
                                <Select
                                  value={form.furnished}
                                  onValueChange={(v) =>
                                    setForm({ ...form, furnished: v })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="no">No</SelectItem>
                                    <SelectItem value="si">Sí</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>Servicios incluidos</Label>
                                <Select
                                  value={form.expenses_included}
                                  onValueChange={(v) =>
                                    setForm({ ...form, expenses_included: v })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="no">No</SelectItem>
                                    <SelectItem value="si">Sí</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>

                          <div className="pt-2">
                            <Label className="mb-2 block">Comodidades</Label>
                            <div className="flex flex-wrap gap-2">
                              <ToggleChip
                                value={form.wifi}
                                onChange={(v) => setForm({ ...form, wifi: v })}
                                icon={Wifi}
                                label="Wi-Fi"
                              />
                              <ToggleChip
                                value={form.parking}
                                onChange={(v) =>
                                  setForm({ ...form, parking: v })
                                }
                                icon={Car}
                                label="Cochera"
                              />
                              <ToggleChip
                                value={form.pets}
                                onChange={(v) => setForm({ ...form, pets: v })}
                                icon={PawPrint}
                                label="Mascotas"
                              />
                              <ToggleChip
                                value={form.ac}
                                onChange={(v) => setForm({ ...form, ac: v })}
                                icon={Wind}
                                label="Aire acondicionado"
                              />
                              <ToggleChip
                                value={form.bbq}
                                onChange={(v) => setForm({ ...form, bbq: v })}
                                icon={Flame}
                                label="Parrilla"
                              />
                              <ToggleChip
                                value={form.balcon}
                                onChange={(v) =>
                                  setForm({ ...form, balcon: v })
                                }
                                label="Balcón"
                              />
                              <ToggleChip
                                value={form.patio}
                                onChange={(v) => setForm({ ...form, patio: v })}
                                label="Patio"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {form.category === "venta" && (
                        <div className="rounded-lg border p-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>Condición</Label>
                              <Select
                                value={form.condition}
                                onValueChange={(v) =>
                                  setForm({ ...form, condition: v })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="nuevo">Nuevo</SelectItem>
                                  <SelectItem value="usado">Usado</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Stock</Label>
                              <Input
                                type="number"
                                value={form.stock}
                                onChange={(e) =>
                                  setForm({ ...form, stock: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <Label>Marca</Label>
                              <Input
                                value={form.brand}
                                onChange={(e) =>
                                  setForm({ ...form, brand: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <Label>Modelo</Label>
                              <Input
                                value={form.model}
                                onChange={(e) =>
                                  setForm({ ...form, model: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <Label>Categoría del producto</Label>
                              <Select
                                value={form.sale_category}
                                onValueChange={(v) =>
                                  setForm({ ...form, sale_category: v })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Elegí una categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="tecnologia">
                                    Tecnología
                                  </SelectItem>
                                  <SelectItem value="autos">
                                    Autos / Motos
                                  </SelectItem>
                                  <SelectItem value="hogar">Hogar</SelectItem>
                                  <SelectItem value="electrodomesticos">
                                    Electrodomésticos
                                  </SelectItem>
                                  <SelectItem value="muebles">
                                    Muebles
                                  </SelectItem>
                                  <SelectItem value="ropa">
                                    Ropa y accesorios
                                  </SelectItem>
                                  <SelectItem value="deportes">
                                    Deportes
                                  </SelectItem>
                                  <SelectItem value="otros">Otros</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}

                      {form.category === "emprendimiento" && (
                        <div className="rounded-lg border p-4 space-y-4">
                          {/* fila 1: links/contacto + horarios */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>Horarios de atención</Label>
                              <Input
                                placeholder="Ej: Lun a Vie 9 a 20 hs · Sáb 9 a 13 hs"
                                value={form.open_hours}
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    open_hours: e.target.value,
                                  })
                                }
                              />
                              <p className="text-xs text-slate-500 mt-1">
                                Podés escribir un texto libre con días y
                                horarios.
                              </p>
                            </div>

                            <div>
                              <Label>Sitio web</Label>
                              <Input
                                type="url"
                                placeholder="https://..."
                                value={form.website}
                                onChange={(e) =>
                                  setForm({ ...form, website: e.target.value })
                                }
                              />
                            </div>

                            <div>
                              <Label>Instagram</Label>
                              <Input
                                placeholder="@usuario"
                                value={form.instagram}
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    instagram: e.target.value,
                                  })
                                }
                              />
                            </div>

                            <div>
                              <Label>WhatsApp</Label>
                              <Input
                                placeholder="+54 9 ..."
                                value={form.whatsapp}
                                onChange={(e) =>
                                  setForm({ ...form, whatsapp: e.target.value })
                                }
                              />
                            </div>

                            <div>
                              <Label>Delivery</Label>
                              <Select
                                value={form.delivery}
                                onValueChange={(v) =>
                                  setForm({ ...form, delivery: v })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="no">No</SelectItem>
                                  <SelectItem value="si">Sí</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* fila 2: tipo, rating, destacado */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* lo que ya tenías: business_type, rating, featured */}
                            {/* ... */}
                          </div>
                        </div>
                      )}

                      {/* Imágenes */}
                      <div>
                        <Label>
                          Imágenes{" "}
                          {isEmpleo(form.category) && (
                            <span className="text-xs text-slate-500">
                              (solo 1)
                            </span>
                          )}
                        </Label>
                        <div className="mt-2 flex flex-col gap-2">
                          <input
                            id="images"
                            type="file"
                            accept="image/*"
                            multiple={!isEmpleo(form.category)}
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                document.getElementById("images").click()
                              }
                              disabled={uploading}
                              className="shrink-0"
                            >
                              <Upload className="w-4 h-4 mr-2" />{" "}
                              {uploading ? "Subiendo..." : "Subir"}
                            </Button>

                            <input
                              type="url"
                              placeholder="Pegar URL de imagen (https://...)"
                              className="w-full min-w-0 border rounded-md px-3 py-2 text-sm"
                              value={imageUrlInput}
                              onChange={(e) => setImageUrlInput(e.target.value)}
                            />

                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleAddImageByUrl}
                              className="shrink-0"
                            >
                              Agregar URL
                            </Button>
                          </div>

                          {imageFiles.length > 0 && (
                            <div
                              className={`grid ${
                                isEmpleo(form.category)
                                  ? "grid-cols-1"
                                  : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
                              } gap-2 mt-3`}
                            >
                              {imageFiles.map((url, idx) => (
                                <div key={idx} className="relative group">
                                  <img
                                    src={url}
                                    alt={`Preview ${idx}`}
                                    className={`w-full ${
                                      isEmpleo(form.category) ? "h-48" : "h-20"
                                    } object-cover rounded-lg`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setImageFiles((prev) =>
                                        prev.filter((_, i) => i !== idx)
                                      )
                                    }
                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Quitar imagen"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setDialogOpen(false);
                            resetForm();
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button type="submit">
                          {editing ? "Actualizar" : "Publicar"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grilla */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {publications.map((p) => (
            <Card
              key={p.id}
              className="hover:shadow-lg transition-all overflow-hidden"
            >
              {p.images?.[0] ? (
                <img
                  src={p.images[0]}
                  alt={p.title}
                  className="w-full h-48 object-cover"
                />
              ) : (
                <div className="w-full h-48 bg-slate-100 grid place-items-center text-slate-400">
                  <Upload className="w-8 h-8" />
                </div>
              )}
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <Badge
                    className={
                      p.status === "active"
                        ? "bg-green-600"
                        : p.status === "pending"
                        ? "bg-amber-500"
                        : "bg-slate-500"
                    }
                  >
                    {p.status === "active"
                      ? "Activa"
                      : p.status === "pending"
                      ? "Pendiente"
                      : "Inactiva"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-purple-200 text-purple-700 bg-purple-50"
                  >
                    {p.category === "empleo"
                      ? "Empleo"
                      : p.category === "alquiler"
                      ? "Alquiler"
                      : p.category === "venta"
                      ? "Venta"
                      : "Emprendimiento"}
                  </Badge>
                </div>

                <h3 className="font-bold text-lg mb-2">{p.title}</h3>

                {/* Ubicación pill truncada */}
                {p.location && (
                  <div className="mt-1 mb-3 inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 px-2 py-1 text-xs max-w-full">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span
                      className="truncate max-w-[520px]"
                      title={p.location_full || p.location}
                    >
                      {p.location}
                    </span>
                  </div>
                )}

                {p.description && (
                  <p className="text-slate-600 text-sm mb-3 line-clamp-2">
                    {p.description}
                  </p>
                )}

                {prettyPrice(p) && (
                  <p className="text-xl font-extrabold text-purple-700 mb-3">
                    {prettyPrice(p)}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleEdit(p)}
                  >
                    <Edit className="w-4 h-4 mr-1" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(p.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {publications.length === 0 && (
            <div className="col-span-full text-center py-12">
              <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">No tenés publicaciones todavía</p>
            </div>
          )}
        </div>
      </div>

      {/* Diálogo de mapa */}
      <MapSearchDialog
        open={mapOpen}
        onOpenChange={setMapOpen}
        defaultQuery={form.location}
        onSelect={({ address, full_address, lat, lon }) => {
          setForm((prev) => ({
            ...prev,
            location: address,
            location_full: full_address || address,
            geo_lat: lat,
            geo_lon: lon,
          }));
          toast.success("Ubicación seleccionada");
        }}
      />
    </div>
  );
}
