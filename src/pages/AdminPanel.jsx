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
} from "firebase/firestore";
import { useSearchParams /*, useNavigate */ } from "react-router-dom";

import { db, auth } from "@/firebase";
import { Crown, Plus, Edit, Trash2, Upload, AlertCircle } from "lucide-react";
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

// === helpers
const hasPriceCategory = (cat) => ["alquiler", "venta"].includes(String(cat));
const isEmpleo = (cat) => String(cat) === "empleo";

// === util fecha (evita Invalid Date)
const fmtDate = (v) => {
  if (!v) return "—";
  if (v?.toDate) return v.toDate().toLocaleDateString();
  if (v?.seconds) return new Date(v.seconds * 1000).toLocaleDateString();
  const d = new Date(v);
  return isNaN(d) ? "—" : d.toLocaleDateString();
};

export default function AdminPanel() {
  // const navigate = useNavigate();
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
    contact_phone: "",
    contact_email: "",
    status: "pending",

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

    // Venta
    condition: "nuevo",
    stock: "",
    brand: "",
    model: "",

    // Emprendimiento
    website: "",
    instagram: "",
    whatsapp: "",
    delivery: "no",
  });

  // Abre el diálogo si llega ?new=1&category=...
  useEffect(() => {
    const newFlag = searchParams.get("new");
    const cat = (searchParams.get("category") || "").toLowerCase();

    if (newFlag === "1") {
      setEditing(null);
      setForm((prev) => ({
        ...prev,
        category: ["empleo", "alquiler", "venta", "emprendimiento"].includes(cat)
          ? cat
          : "empleo",
        price: hasPriceCategory(cat) ? prev.price : "",
      }));
      setDialogOpen(true);
    }
  }, [searchParams]);

  // Si cambia a empleo, recortar imágenes a 1
  useEffect(() => {
    if (isEmpleo(form.category) && imageFiles.length > 1) {
      setImageFiles((prev) => (prev.length ? [prev[0]] : []));
    }
  }, [form.category, imageFiles.length]);

  // Auth + rol + cargas iniciales
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

        await Promise.all([loadPublications(u.email), loadSubscription(u.email)]);
      } catch (e) {
        console.error(e);
        toast.error("No se pudo cargar tu perfil");
        window.location.href = "/";
      }
    });
    return () => unsub();
  }, []);

  // Lista del usuario (con fallback sin índice)
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

  // Suscripción vigente
  const loadSubscription = async (email) => {
    const qSub = query(
      collection(db, "subscriptions"),
      where("user_email", "==", email),
      where("status", "==", "active")
    );
    const snap = await getDocs(qSub);
    setSubscription(
      snap.docs[0] ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null
    );
  };

  // Conteo del mes
  const thisMonthCount = useMemo(() => {
    const now = new Date();
    return publications.filter((p) => {
      const d = p.created_date?.toDate
        ? p.created_date.toDate()
        : p.created_date
        ? new Date(p.created_date)
        : null;
      return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [publications]);

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      category: "empleo",
      price: "",
      location: "",
      contact_phone: "",
      contact_email: "",
      status: "pending",

      // empleo
      employment_type: "full-time",
      work_mode: "onsite",
      salary_min: "",
      salary_max: "",
      company: "",

      // alquiler
      rent_type: "mensual",
      rooms: "",
      bathrooms: "",
      furnished: "no",
      expenses_included: "no",

      // venta
      condition: "nuevo",
      stock: "",
      brand: "",
      model: "",

      // emprendimiento
      website: "",
      instagram: "",
      whatsapp: "",
      delivery: "no",
    });
    setImageFiles([]);
    setEditing(null);
  };

  // Subida de imágenes
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      // subir todas las seleccionadas
      const uploaded = [];
      for (const f of files) uploaded.push(await uploadToCloudinary(f));

      if (isEmpleo(form.category)) {
        // empleo: tomar solo la primera y reemplazar
        setImageFiles(uploaded.length ? [uploaded[0]] : []);
      } else {
        // otras categorías: agregar
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
        // empleo: solo 1 (reemplazar si ya existe)
        setImageFiles([url]);
      } else {
        setImageFiles((prev) => [...prev, url]);
      }
      setImageUrlInput("");
    } catch {
      toast.error("URL inválida");
    }
  };

  // Crear / actualizar
  const handleSubmit = async (ev) => {
    ev.preventDefault();

    if (!subscription || subscription.status !== "active") {
      toast.error("Necesitás una suscripción activa para publicar");
      return;
    }
    if (!editing && thisMonthCount >= 3) {
      toast.error("Ya usaste tus 3 publicaciones de este mes");
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      price: hasPriceCategory(form.category) && form.price !== "" ? Number(form.price) : null,
      location: form.location || null,
      contact_phone: form.contact_phone || null,
      contact_email: form.contact_email || user.email,
      status: form.status || "pending",
      images: imageFiles,
      created_by: user.email,
      ...(editing ? {} : { created_date: serverTimestamp() }),
      updated_date: serverTimestamp(),
    };

    // Campos por categoría
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
      });
    }
    if (form.category === "venta") {
      Object.assign(payload, {
        condition: form.condition,
        stock: form.stock ? Number(form.stock) : null,
        brand: form.brand || null,
        model: form.model || null,
      });
    }
    if (form.category === "emprendimiento") {
      Object.assign(payload, {
        website: form.website || null,
        instagram: form.instagram || null,
        whatsapp: form.whatsapp || null,
        delivery: form.delivery,
      });
    }

    try {
      if (editing) {
        await updateDoc(doc(db, "publications", editing.id), payload);
        toast.success("Publicación actualizada");
      } else {
        await addDoc(collection(db, "publications"), payload);
        toast.success("Publicación creada");
      }
      setDialogOpen(false);
      resetForm();
      await loadPublications(user.email);
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
      contact_phone: p.contact_phone || "",
      contact_email: p.contact_email || "",
      status: p.status || "pending",

      // empleo
      company: p.company || "",
      employment_type: p.employment_type || "full-time",
      work_mode: p.work_mode || "onsite",
      salary_min: p.salary_min ?? "",
      salary_max: p.salary_max ?? "",

      // alquiler
      rent_type: p.rent_type || "mensual",
      rooms: p.rooms ?? "",
      bathrooms: p.bathrooms ?? "",
      furnished: p.furnished || "no",
      expenses_included: p.expenses_included || "no",

      // venta
      condition: p.condition || "nuevo",
      stock: p.stock ?? "",
      brand: p.brand || "",
      model: p.model || "",

      // emprendimiento
      website: p.website || "",
      instagram: p.instagram || "",
      whatsapp: p.whatsapp || "",
      delivery: p.delivery || "no",
    });
    // Si empleo y traía varias imágenes, recortamos a 1 en el editor
    setImageFiles(Array.isArray(p.images) ? (isEmpleo(p.category) ? [p.images[0]] : p.images) : []);
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
              <p className="text-white/80 text-sm">Gestioná tus publicaciones y tu plan</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        {/* Estado de suscripción */}
        <Card className="mb-8 bg-white/80 backdrop-blur shadow-md rounded-2xl">
          <CardContent className="p-5 md:p-6">
            <div className="flex items-start md:items-center justify-between gap-4 flex-wrap">
              <div className="min-w-[240px]">
                <h3 className="font-semibold text-lg mb-2">Estado de Suscripción</h3>

                {subscription?.status === "active" ? (
                  <div className="space-y-1">
                    <span className="inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full bg-green-600 text-white shadow">
                      🟢 Activa
                    </span>
                    <p className="text-sm text-slate-700 mt-1">
                      Publicaciones este mes: <strong>{thisMonthCount}/3</strong>
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
                    if (!open) {
                      resetForm();
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <div>
                      <Button
                        className={`rounded-xl font-semibold px-5 py-2 text-white shadow-md hover:shadow-lg transition-all border-none focus:outline-none focus:ring-0
${subscription?.status === "active" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700 cursor-not-allowed opacity-90"}`}
                        disabled={
                          subscription?.status === "active" ? thisMonthCount >= 3 : true
                        }
                        onClick={(e) => {
                          if (subscription?.status !== "active") {
                            e.preventDefault();
                            toast.error("Tu suscripción está inactiva. Contactanos para activarla.");
                          }
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {subscription?.status === "active" ? "Nueva Publicación" : "Suscripción Inactiva"}
                      </Button>
                    </div>
                  </DialogTrigger>

                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editing ? "Editar Publicación" : "Nueva Publicación"}</DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="title">Título *</Label>
                        <Input
                          id="title"
                          value={form.title}
                          onChange={(e) => setForm({ ...form, title: e.target.value })}
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="description">Descripción *</Label>
                        <Textarea
                          id="description"
                          rows={4}
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
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
                              <SelectItem value="emprendimiento">Emprendimiento</SelectItem>
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
                              onChange={(e) => setForm({ ...form, price: e.target.value })}
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

                      <div>
                        <Label htmlFor="location">Ubicación</Label>
                        <Input
                          id="location"
                          value={form.location}
                          onChange={(e) => setForm({ ...form, location: e.target.value })}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="phone">Teléfono</Label>
                          <Input
                            id="phone"
                            value={form.contact_phone}
                            onChange={(e) =>
                              setForm({ ...form, contact_phone: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={form.contact_email}
                            onChange={(e) =>
                              setForm({ ...form, contact_email: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      {/* ===== Campos dinámicos por categoría ===== */}
                      {form.category === "empleo" && (
                        <div className="rounded-lg border p-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>Empresa</Label>
                              <Input
                                value={form.company}
                                onChange={(e) => setForm({ ...form, company: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label>Modalidad</Label>
                              <Select
                                value={form.work_mode}
                                onValueChange={(v) => setForm({ ...form, work_mode: v })}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="onsite">Presencial</SelectItem>
                                  <SelectItem value="hybrid">Híbrido</SelectItem>
                                  <SelectItem value="remote">Remoto</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Tipo de puesto</Label>
                              <Select
                                value={form.employment_type}
                                onValueChange={(v) => setForm({ ...form, employment_type: v })}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="full-time">Full-time</SelectItem>
                                  <SelectItem value="part-time">Part-time</SelectItem>
                                  <SelectItem value="temp">Temporal</SelectItem>
                                  <SelectItem value="freelance">Freelance</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Salario mínimo</Label>
                                <Input
                                  type="number"
                                  value={form.salary_min}
                                  onChange={(e) => setForm({ ...form, salary_min: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label>Salario máximo</Label>
                                <Input
                                  type="number"
                                  value={form.salary_max}
                                  onChange={(e) => setForm({ ...form, salary_max: e.target.value })}
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
                                onValueChange={(v) => setForm({ ...form, rent_type: v })}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="diario">Por día</SelectItem>
                                  <SelectItem value="mensual">Por mes</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Ambientes/Dormitorios</Label>
                              <Input
                                value={form.rooms}
                                onChange={(e) => setForm({ ...form, rooms: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label>Baños</Label>
                              <Input
                                value={form.bathrooms}
                                onChange={(e) => setForm({ ...form, bathrooms: e.target.value })}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Amoblado</Label>
                                <Select
                                  value={form.furnished}
                                  onValueChange={(v) => setForm({ ...form, furnished: v })}
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                                  onValueChange={(v) => setForm({ ...form, expenses_included: v })}
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="no">No</SelectItem>
                                    <SelectItem value="si">Sí</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
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
                                onValueChange={(v) => setForm({ ...form, condition: v })}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
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
                                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label>Marca</Label>
                              <Input
                                value={form.brand}
                                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label>Modelo</Label>
                              <Input
                                value={form.model}
                                onChange={(e) => setForm({ ...form, model: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {form.category === "emprendimiento" && (
                        <div className="rounded-lg border p-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>Sitio web</Label>
                              <Input
                                type="url"
                                placeholder="https://..."
                                value={form.website}
                                onChange={(e) => setForm({ ...form, website: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label>Instagram</Label>
                              <Input
                                placeholder="@usuario"
                                value={form.instagram}
                                onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label>WhatsApp</Label>
                              <Input
                                placeholder="+54 9 ..."
                                value={form.whatsapp}
                                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label>Delivery</Label>
                              <Select
                                value={form.delivery}
                                onValueChange={(v) => setForm({ ...form, delivery: v })}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="no">No</SelectItem>
                                  <SelectItem value="si">Sí</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Imágenes */}
                      <div>
                        <Label>
                          Imágenes {isEmpleo(form.category) && <span className="text-xs text-slate-500">(solo 1 imagen)</span>}
                        </Label>
                        <div className="mt-2 flex flex-col gap-2">
                          <input
                            id="images"
                            type="file"
                            accept="image/*"
                            // empleo: no multiple
                            multiple={!isEmpleo(form.category)}
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => document.getElementById("images").click()}
                              disabled={uploading}
                            >
                              <Upload className="w-4 h-4 mr-2" />
                              {uploading ? "Subiendo..." : "Subir"}
                            </Button>

                            <input
                              type="url"
                              placeholder="Pegar URL de imagen (https://...)"
                              className="flex-1 border rounded-md px-3 py-2 text-sm"
                              value={imageUrlInput}
                              onChange={(e) => setImageUrlInput(e.target.value)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleAddImageByUrl}
                              // empleo: permitir siempre (reemplaza si ya existe)
                            >
                              Agregar URL
                            </Button>
                          </div>

                          {imageFiles.length > 0 && (
                            <div className={`grid ${isEmpleo(form.category) ? "grid-cols-1" : "grid-cols-4"} gap-2 mt-3`}>
                              {imageFiles.map((url, idx) => (
                                <div key={idx} className="relative group">
                                  <img
                                    src={url}
                                    alt={`Preview ${idx}`}
                                    className={`w-full ${isEmpleo(form.category) ? "h-48" : "h-20"} object-cover rounded-lg`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setImageFiles((prev) => prev.filter((_, i) => i !== idx))
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
                        <Button type="submit">{editing ? "Actualizar" : "Publicar"}</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grilla de publicaciones */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {publications.map((p) => (
            <Card key={p.id} className="hover:shadow-lg transition-all overflow-hidden">
              {p.images?.[0] ? (
                <img src={p.images[0]} alt={p.title} className="w-full h-48 object-cover" />
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
                        ? "bg-green-500"
                        : p.status === "pending"
                        ? "bg-yellow-500"
                        : "bg-slate-500"
                    }
                  >
                    {p.status === "active" ? "Activa" : p.status === "pending" ? "Pendiente" : "Inactiva"}
                  </Badge>
                  <Badge variant="outline">
                    {p.category === "empleo" ? "Empleo"
                      : p.category === "alquiler" ? "Alquiler"
                      : p.category === "venta" ? "Venta"
                      : p.category === "emprendimiento" ? "Emprendimiento"
                      : p.category}
                  </Badge>
                </div>

                <h3 className="font-bold text-lg mb-2">{p.title}</h3>
                {p.description && (
                  <p className="text-slate-600 text-sm mb-3 line-clamp-2">{p.description}</p>
                )}

                {hasPriceCategory(p.category) && typeof p.price === "number" && (
                  <p className="text-xl font-bold text-green-600 mb-3">
                    ${p.price.toLocaleString()}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEdit(p)}>
                    <Edit className="w-4 h-4 mr-1" />
                    Editar
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
    </div>
  );
}
