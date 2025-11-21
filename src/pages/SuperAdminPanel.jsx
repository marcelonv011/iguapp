// src/pages/SuperAdminPanel.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
  addDoc,
} from "firebase/firestore";
import { db, auth } from "@/firebase";
import { onAuthStateChanged } from "firebase/auth";

import {
  Shield,
  Users,
  FileText,
  Calendar,
  Eye,
  DollarSign,
  CheckCircle,
  XCircle,
  Search,
  Home as HomeIcon,
  Pencil,
  Trash2,
  UtensilsCrossed,
  Check,
  X,
  Flag,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Textarea } from "@/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/ui/select";
import { toast } from "sonner";

/* =================== Helpers =================== */
const toDate = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);
const isSameMonthYear = (d, m, y) =>
  d && d.getMonth?.() === m && d.getFullYear?.() === y;

const fmtDate = (v) => {
  if (!v) return "—";
  const d = v?.toDate ? v.toDate() : new Date(v);
  return isNaN(d) ? "—" : d.toLocaleDateString();
};

const fmtMoneyShort = (n) => {
  const num = Number(n ?? 0);
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}k`;
  return `$${num}`;
};

const StatusBadge = ({ status }) => {
  const cls =
    status === "active"
      ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
      : status === "pending"
      ? "bg-amber-100 text-amber-700 border border-amber-200"
      : "bg-slate-100 text-slate-700 border border-slate-200";
  return <Badge className={`capitalize ${cls}`}>{status || "—"}</Badge>;
};

const RoleBadge = ({ role }) => {
  const r = role || "usuario";
  const cls =
    r === "superadmin"
      ? "bg-purple-100 text-purple-700 border border-purple-200"
      : r === "admin"
      ? "bg-amber-100 text-amber-700 border border-amber-200"
      : "bg-blue-100 text-blue-700 border-blue-200";
  return <Badge className={`capitalize ${cls}`}>{r}</Badge>;
};

const ProductTypeBadge = ({ type }) => {
  const t = type || "publications";

  let label = "Publicaciones";
  let cls = "bg-blue-100 text-blue-700 border border-blue-200";

  if (t === "restaurant" || t === "restaurants") {
    label = "Restaurante";
    cls = "bg-emerald-100 text-emerald-700 border border-emerald-200";
  }

  return <Badge className={`capitalize ${cls}`}>{label}</Badge>;
};

const EmptyState = ({ icon: Icon, title, subtitle, action }) => (
  <div className="flex flex-col items-center justify-center text-center py-14">
    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
      <Icon className="w-6 h-6 text-slate-500" />
    </div>
    <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
    <p className="text-slate-500 mt-1">{subtitle}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

/* =================== Página =================== */
export default function SuperAdminPanel() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [publications, setPublications] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingRestaurants, setPendingRestaurants] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [reports, setReports] = useState([]);

  // filtros
  const [pubQuery, setPubQuery] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [reportQuery, setReportQuery] = useState("");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportStatusFilter, setReportStatusFilter] = useState("all"); // "all" | "open" | "closed"

  // filtro ingresos (mes/año)
  const today = useMemo(() => new Date(), []);
  const [selMonth, setSelMonth] = useState(today.getMonth()); // 0-11
  const [selYear, setSelYear] = useState(today.getFullYear());

  // edición publicación
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    category: "empleo",
    price: "",
    status: "pending",
    featured: "no", // "si" | "no"
  });

  const [requireApproval, setRequireApproval] = useState(true);
  const [requireRestaurantApproval, setRequireRestaurantApproval] =
    useState(false); // 🔹 restaurantes

  // --- Validar SuperAdmin ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        navigate("/login");
        return;
      }
      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);
      const current = snap.exists() ? snap.data() : null;

      if (!current || current.role_type !== "superadmin") {
        toast.error("No tenés permisos de SuperAdmin");
        navigate("/");
        return;
      }

      loadAll();
      await Promise.all([
        loadConfigPublications(),
        loadConfigRestaurants(), // 🔹 también cargamos restaurantes
      ]);
    });
    return () => unsub();
  }, []);

  // Escuchar restaurantes pendientes de aprobación
  useEffect(() => {
    const qRef = query(
      collection(db, "restaurants"),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPendingRestaurants(arr);
      },
      (err) => {
        console.error("Error cargando restaurantes pendientes:", err);
        toast.error("Error cargando restaurantes pendientes");
      }
    );

    return () => unsub();
  }, []);

  // --- Config: aprobación de publicaciones ---
  const loadConfigPublications = async () => {
    try {
      const cfgRef = doc(db, "settings", "publications");
      const snap = await getDoc(cfgRef);
      if (snap.exists()) {
        const data = snap.data();
        setRequireApproval(
          data.require_approval !== undefined ? data.require_approval : true
        );
      } else {
        // Por defecto: AHORA dejamos modo automático (sin aprobación)
        setRequireApproval(false);
      }
    } catch (e) {
      console.error("Error cargando configuración de publicaciones:", e);
      // si falla, por seguridad dejamos que requiera aprobación
      setRequireApproval(true);
    }
  };

  const loadConfigRestaurants = async () => {
    try {
      const cfgRef = doc(db, "settings", "restaurants");
      const snap = await getDoc(cfgRef);
      if (snap.exists()) {
        const data = snap.data();
        setRequireRestaurantApproval(
          data.require_approval !== undefined ? data.require_approval : false
        );
      } else {
        // Por defecto: NO requiere aprobación manual
        setRequireRestaurantApproval(false);
      }
    } catch (e) {
      console.error("Error cargando configuración de restaurantes:", e);
      // si falla, por seguridad dejamos auto-aprobado
      setRequireRestaurantApproval(false);
    }
  };

  const toggleRequireApproval = async () => {
    try {
      const newValue = !requireApproval;
      setRequireApproval(newValue);

      const cfgRef = doc(db, "settings", "publications");
      await setDoc(
        cfgRef,
        {
          require_approval: newValue,
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );

      toast.success(
        newValue
          ? "Desde ahora las nuevas publicaciones quedarán pendientes hasta que el SuperAdmin las apruebe."
          : "Desde ahora las publicaciones de usuarios con suscripción activa se aprueban automáticamente."
      );
    } catch (e) {
      console.error(e);
      toast.error("No se pudo actualizar la configuración de publicaciones");
    }
  };

  const toggleRequireRestaurantApproval = async () => {
    try {
      const newValue = !requireRestaurantApproval;
      setRequireRestaurantApproval(newValue);

      const cfgRef = doc(db, "settings", "restaurants");
      await setDoc(
        cfgRef,
        {
          require_approval: newValue,
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );

      toast.success(
        newValue
          ? "Desde ahora los nuevos restaurantes quedarán en pendiente hasta que el SuperAdmin los apruebe."
          : "Desde ahora los nuevos restaurantes se aprueban automáticamente al crearse."
      );
    } catch (e) {
      console.error(e);
      toast.error("No se pudo actualizar la configuración de restaurantes");
    }
  };

  const loadAll = async () => {
    setLoading(true);
    const [usersSnap, pubsSnap, subsSnap, restaurantsSnap, reportsSnap] =
      await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "publications")),
        getDocs(collection(db, "subscriptions")),
        getDocs(collection(db, "restaurants")),
        getDocs(collection(db, "reports")),
      ]);

    setUsers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setPublications(pubsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setSubscriptions(subsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setRestaurants(
      restaurantsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    );
    setReports(reportsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

    setLoading(false);
  };

  // --- Acciones publicaciones ---
  const updatePublicationStatus = async (id, status) => {
    await updateDoc(doc(db, "publications", id), { status });
    toast.success(
      status === "active" ? "Publicación aprobada" : "Publicación rechazada"
    );
    loadAll();
  };

  // --- Acciones restaurantes ---
  const updateRestaurantStatus = async (id, status) => {
    try {
      await updateDoc(doc(db, "restaurants", id), {
        status,
        updatedAt: serverTimestamp(),
      });

      toast.success(
        status === "approved" ? "Restaurante aprobado" : "Restaurante rechazado"
      );

      // refrescamos la lista de restaurantes
      loadAll();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo actualizar el restaurante");
    }
  };

  const deleteRestaurant = async (id) => {
    if (
      !confirm(
        "¿Eliminar este restaurante? Esta acción eliminará el restaurante de la plataforma."
      )
    )
      return;

    try {
      await deleteDoc(doc(db, "restaurants", id));
      toast.success("Restaurante eliminado");
      // vuelve a cargar la lista
      loadAll();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo eliminar el restaurante");
    }
  };

  const openEdit = (p) => {
    setEditing(p);
    setEditForm({
      title: p.title || "",
      description: p.description || "",
      category: p.category || "empleo",
      price: p.price ?? "",
      status: p.status || "pending",
      featured: p.featured ? "si" : "no",
    });
    setEditOpen(true);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    const payload = {
      title: editForm.title.trim(),
      description: editForm.description.trim(),
      category: editForm.category,
      price: editForm.price === "" ? null : Number(editForm.price),
      status: editForm.status,
      featured: editForm.featured === "si",
    };

    await updateDoc(doc(db, "publications", editing.id), payload);
    toast.success("Publicación actualizada");
    setEditOpen(false);
    setEditing(null);
    loadAll();
  };

  const deletePublication = async (id) => {
    if (!confirm("¿Eliminar esta publicación?")) return;

    try {
      const pubRef = doc(db, "publications", id);
      const pubSnap = await getDoc(pubRef);

      if (!pubSnap.exists()) {
        toast.error("La publicación ya no existe");
        return;
      }

      const pubData = pubSnap.data();
      const ownerEmail = pubData.created_by || pubData.user_email;

      // 1) Borrar la publicación
      await deleteDoc(pubRef);
      toast.success("Publicación eliminada");

      // 2) Si sabemos quién es el dueño, devolvemos 1 cupo en su suscripción
      if (ownerEmail) {
        const qSub = query(
          collection(db, "subscriptions"),
          where("user_email", "==", ownerEmail)
        );
        const subSnap = await getDocs(qSub);

        if (!subSnap.empty) {
          const docs = subSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

          // misma lógica que usás en AdminPanel para elegir la "mejor" suscripción
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

          if (sub?.id) {
            await updateDoc(doc(db, "subscriptions", sub.id), {
              publications_used: increment(-1), // 👈 devolvemos un cupo
            });
          }
        }
      }

      // 3) Refrescar todo
      loadAll();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo eliminar la publicación");
    }
  };

  // --- Acciones suscripciones ---
  const setSubscriptionStatus = async (id, status) => {
    await updateDoc(doc(db, "subscriptions", id), { status });
    toast.success(
      status === "active" ? "Suscripción activada" : "Suscripción inactivada"
    );
    loadAll();
  };

  // --- Acciones usuarios ---
  const setRole = async (id, role_type) => {
    await updateDoc(doc(db, "users", id), { role_type });
    toast.success(role_type === "admin" ? "Hecho admin" : "Se quitó admin");
    loadAll();
  };

  // 👉 Dar 1 mes gratis de suscripción (plan básico)
  const giveFreeMonthToUser = async (userEmail) => {
    if (!userEmail) {
      toast.error("Este usuario no tiene email válido");
      return;
    }

    if (!confirm(`¿Dar 1 mes gratis del plan básico a ${userEmail}?`)) return;

    try {
      const start = new Date();
      const end = new Date();
      end.setMonth(end.getMonth() + 1); // +1 mes

      await addDoc(collection(db, "subscriptions"), {
        user_email: userEmail,
        product_type: "publications", // 👈 muy importante para que AdminPanel lo vea
        plan_tier: "basic",
        plan_type: "mensual",
        publications_limit: 3, // cambiá 3 por el límite que quieras
        publications_used: 0,
        start_date: start,
        end_date: end,
        status: "active",
        payment_id: "free_trial", // sabemos que es gratis
        billing_status: "trial", // opcional, para tu control
        created_at: serverTimestamp(),
      });

      toast.success("Se activó 1 mes gratis para este usuario");
      loadAll();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo crear la suscripción gratis");
    }
  };

  // --- Acciones reportes ---
  const setReportStatus = async (id, status) => {
    try {
      await updateDoc(doc(db, "reports", id), { status });
      toast.success(
        status === "closed"
          ? "Reporte marcado como resuelto"
          : "Estado de reporte actualizado"
      );
      loadAll();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo actualizar el reporte");
    }
  };

  // --- Derivados (KPIs + filtros) ---
  const kpis = useMemo(() => {
    const totalUsers = users.length;
    const activeSubs = subscriptions.filter((s) => s.status === "active");

    // ingresos del mes seleccionado (por start_date)
    const revenueSelected = activeSubs.reduce((acc, s) => {
      const sd = toDate(s.start_date);
      return isSameMonthYear(sd, selMonth, selYear)
        ? acc + (Number(s.amount) || 0)
        : acc;
    }, 0);

    const pendingPubs = publications.filter(
      (p) => p.status === "pending"
    ).length;

    return {
      totalUsers,
      activeSubscriptions: activeSubs.length,
      pendingPublications: pendingPubs,
      revenueMonth: revenueSelected,
    };
  }, [users, subscriptions, publications, selMonth, selYear]);

  // años disponibles en subs (para selector)
  const yearOptions = useMemo(() => {
    const set = new Set(
      subscriptions
        .map((s) => toDate(s.start_date)?.getFullYear())
        .filter(Boolean)
        .concat([today.getFullYear()])
    );
    return Array.from(set).sort((a, b) => a - b);
  }, [subscriptions, today]);

  const filteredPublications = useMemo(() => {
    const q = pubQuery.toLowerCase().trim();
    if (!q) return publications;
    return publications.filter(
      (p) =>
        (p.title || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q) ||
        (p.user_email || p.created_by || "").toLowerCase().includes(q) ||
        (p.status || "").toLowerCase().includes(q)
    );
  }, [publications, pubQuery]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.toLowerCase().trim();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.full_name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.role_type || "usuario").toLowerCase().includes(q)
    );
  }, [users, userQuery]);

  const filteredReports = useMemo(() => {
    const q = reportQuery.toLowerCase().trim();
    const fromDate = reportFrom ? new Date(reportFrom + "T00:00:00") : null;
    const toDateLimit = reportTo ? new Date(reportTo + "T23:59:59") : null;

    return reports.filter((r) => {
      const title = (r.publication_title || "").toLowerCase();
      const owner = (r.owner_email || "").toLowerCase();
      const reporter = (r.reporter_email || "").toLowerCase();
      const comment = (r.comment || "").toLowerCase();
      const status = (r.status || "open").toLowerCase();

      const matchesSearch =
        !q ||
        title.includes(q) ||
        owner.includes(q) ||
        reporter.includes(q) ||
        comment.includes(q) ||
        status.includes(q);

      const d = toDate(r.created_at);
      const matchesFrom = !fromDate || (d && d >= fromDate);
      const matchesTo = !toDateLimit || (d && d <= toDateLimit);

      const matchesStatusFilter =
        reportStatusFilter === "all" || status === reportStatusFilter; // 👈 filtro por estado

      return matchesSearch && matchesFrom && matchesTo && matchesStatusFilter;
    });
  }, [reports, reportQuery, reportFrom, reportTo, reportStatusFilter]);
  //                                    👆 agregamos reportStatusFilter a deps

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-300 border-t-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      {/* Banner */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-12">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-white/80">
                <HomeIcon className="w-4 h-4" />
                <span>Inicio</span>
                <span>›</span>
                <span className="text-white">SuperAdmin</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">
                Panel SuperAdmin
              </h1>
              <p className="text-white/80 text-sm">
                Gestión completa de la plataforma
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mt-4 pb-20">
        {/* Filtro Mes/Año para ingresos */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="text-sm text-slate-600">Filtrar ingresos por:</div>
          <select
            className="border rounded-md px-3 py-2 bg-white"
            value={selMonth}
            onChange={(e) => setSelMonth(Number(e.target.value))}
          >
            {[
              "Enero",
              "Febrero",
              "Marzo",
              "Abril",
              "Mayo",
              "Junio",
              "Julio",
              "Agosto",
              "Septiembre",
              "Octubre",
              "Noviembre",
              "Diciembre",
            ].map((m, i) => (
              <option key={i} value={i}>
                {m}
              </option>
            ))}
          </select>
          <select
            className="border rounded-md px-3 py-2 bg-white"
            value={selYear}
            onChange={(e) => setSelYear(Number(e.target.value))}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <div className="text-sm text-slate-500 w-full sm:w-auto">
            Total:{" "}
            <span className="font-semibold text-emerald-700">
              ${Number(kpis.revenueMonth || 0).toLocaleString()}
            </span>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPI
            title="Usuarios"
            value={kpis.totalUsers}
            icon={<Users className="w-5 h-5 text-blue-600" />}
          />
          <KPI
            title="Suscripciones activas"
            value={kpis.activeSubscriptions}
            icon={<Calendar className="w-5 h-5 text-emerald-600" />}
          />
          <KPI
            title="Pendientes"
            value={kpis.pendingPublications}
            icon={<FileText className="w-5 h-5 text-amber-600" />}
          />
          <KPI
            title="Ingresos (mes)"
            value={fmtMoneyShort(kpis.revenueMonth)}
            icon={<DollarSign className="w-5 h-5 text-green-600" />}
            accent="text-green-700"
          />
        </div>

        {/* Config aprobación de restaurantes */}
        <Card className="mb-4 rounded-2xl shadow-sm border border-slate-200 bg-slate-50/80">
          <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Aprobación de restaurantes
              </p>
              <p className="text-xs text-slate-600">
                {requireRestaurantApproval
                  ? "Los nuevos restaurantes se crean en estado pending hasta que el SuperAdmin los apruebe."
                  : "Los nuevos restaurantes se crean directamente en estado approved."}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleRequireRestaurantApproval}
            >
              {requireRestaurantApproval
                ? "Pasar a aprobación automática"
                : "Requerir aprobación manual"}
            </Button>
          </CardContent>
        </Card>

        {/* Restaurantes pendientes de aprobación */}
        <Card className="mb-8 rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5" />
              Restaurantes pendientes de aprobación
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingRestaurants.length === 0 ? (
              <p className="text-slate-600 text-sm">
                No hay restaurantes pendientes.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingRestaurants.map((r) => (
                  <Card key={r.id} className="border-2">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h3 className="font-bold text-lg">
                            {r.name || "Sin nombre"}
                          </h3>
                          <p className="text-sm text-slate-600">
                            {r.address || "Sin dirección"}
                          </p>
                          {r.owner_email && (
                            <p className="text-xs text-slate-500 mt-1">
                              Propietario: {r.owner_email}
                            </p>
                          )}
                        </div>
                        <Badge className="bg-amber-500">Pendiente</Badge>
                      </div>

                      {r.description && (
                        <p className="text-sm text-slate-700 line-clamp-3">
                          {r.description}
                        </p>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 flex-1"
                          onClick={() =>
                            updateRestaurantStatus(r.id, "approved")
                          }
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 flex-1"
                          onClick={() =>
                            updateRestaurantStatus(r.id, "rejected")
                          }
                        >
                          <X className="w-4 h-4 mr-1" />
                          Rechazar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Restaurantes aprobados (con opción de borrar) */}
        <Card className="mb-8 rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5" />
              Restaurantes aprobados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {restaurants.filter((r) => r.status === "approved").length === 0 ? (
              <p className="text-slate-600 text-sm">
                No hay restaurantes aprobados todavía.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {restaurants
                  .filter((r) => r.status === "approved")
                  .map((r) => (
                    <Card key={r.id} className="border">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <h3 className="font-bold text-lg">
                              {r.name || "Sin nombre"}
                            </h3>
                            <p className="text-sm text-slate-600">
                              {r.address || "Sin dirección"}
                            </p>
                            {r.owner_email && (
                              <p className="text-xs text-slate-500 mt-1">
                                Propietario: {r.owner_email}
                              </p>
                            )}
                          </div>
                          <Badge className="bg-emerald-500">Aprobado</Badge>
                        </div>

                        {r.description && (
                          <p className="text-sm text-slate-700 line-clamp-3">
                            {r.description}
                          </p>
                        )}

                        <div className="flex gap-2 pt-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => deleteRestaurant(r.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Eliminar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="publications" className="space-y-6">
          <div className="w-full overflow-x-auto -mx-3 sm:mx-0 pb-2">
            <TabsList className="inline-grid min-w-max grid-cols-4 sm:grid-cols-4 gap-2 rounded-xl bg-white/70 backdrop-blur border border-slate-200 px-1">
              <TabsTrigger
                value="publications"
                className="text-xs sm:text-sm px-2 py-2"
              >
                Publicaciones
                <span className="ml-2 text-[10px] sm:text-xs rounded-full px-2 py-0.5 bg-slate-100">
                  {publications.length}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="users"
                className="text-xs sm:text-sm px-2 py-2"
              >
                Usuarios
                <span className="ml-2 text-[10px] sm:text-xs rounded-full px-2 py-0.5 bg-slate-100">
                  {users.length}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="subscriptions"
                className="text-xs sm:text-sm px-2 py-2"
              >
                Suscripciones
                <span className="ml-2 text-[10px] sm:text-xs rounded-full px-2 py-0.5 bg-slate-100">
                  {subscriptions.length}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="reports"
                className="text-xs sm:text-sm px-2 py-2"
              >
                Reportes
                <span className="ml-2 text-[10px] sm:text-xs rounded-full px-2 py-0.5 bg-slate-100">
                  {reports.length}
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* === Publicaciones === */}
          <TabsContent value="publications">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle>Gestión de Publicaciones</CardTitle>
              </CardHeader>
              <CardContent>
                {/* 🔧 Config aprobación automática / manual */}
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Aprobación de publicaciones
                    </p>
                    <p className="text-xs text-slate-600">
                      {requireApproval
                        ? "Las nuevas publicaciones quedan en estado pending hasta que el SuperAdmin las apruebe."
                        : "Las publicaciones de usuarios con suscripción activa se crean directamente en estado active."}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleRequireApproval}
                  >
                    {requireApproval
                      ? "Pasar a aprobación automática"
                      : "Requerir aprobación manual"}
                  </Button>
                </div>

                {/* Buscador simple de publicaciones */}
                <div className="mb-4 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    className="w-full pl-9 pr-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-sm"
                    placeholder="Buscar por título, categoría, usuario o estado…"
                    value={pubQuery}
                    onChange={(e) => setPubQuery(e.target.value)}
                  />
                </div>

                {filteredPublications.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="No hay publicaciones"
                    subtitle="Cuando existan publicaciones, aparecerán aquí."
                  />
                ) : (
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="max-h-[60vh] overflow-auto">
                      <div className="overflow-x-auto scrollbar-thin scrollbar-track-slate-50 scrollbar-thumb-slate-300/70">
                        <Table className="min-w-[720px] sm:min-w-0 text-xs sm:text-sm">
                          <TableHeader className="sticky top-0 bg-white z-10">
                            <TableRow>
                              <TableHead className="w-[40%]">Título</TableHead>
                              <TableHead className="hidden sm:table-cell">
                                Categoría
                              </TableHead>
                              <TableHead className="hidden md:table-cell">
                                Usuario
                              </TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead className="w-40 sm:w-48">
                                Acciones
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredPublications.map((p) => (
                              <TableRow
                                key={p.id}
                                className="hover:bg-slate-50/60"
                              >
                                <TableCell className="font-medium max-w-[280px] sm:max-w-none">
                                  <div className="truncate" title={p.title}>
                                    {p.title}
                                  </div>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">
                                  <Badge className="bg-slate-100 text-slate-700 border border-slate-200 capitalize">
                                    {p.category || "—"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-sm">
                                  <span
                                    className="truncate block max-w-[220px]"
                                    title={p.user_email || p.created_by || "—"}
                                  >
                                    {p.user_email || p.created_by || "—"}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <StatusBadge status={p.status} />
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-2">
                                    {p.status === "pending" && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            updatePublicationStatus(
                                              p.id,
                                              "active"
                                            )
                                          }
                                        >
                                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            updatePublicationStatus(
                                              p.id,
                                              "inactive"
                                            )
                                          }
                                        >
                                          <XCircle className="w-4 h-4 text-rose-600" />
                                        </Button>
                                      </>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openEdit(p)}
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => deletePublication(p.id)}
                                    >
                                      <Trash2 className="w-4 h-4 text-rose-600" />
                                    </Button>
                                    {p.images?.[0] && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          window.open(p.images[0], "_blank")
                                        }
                                      >
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === Usuarios === */}
          <TabsContent value="users">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle>Gestión de Usuarios</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    className="w-full pl-9 pr-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    placeholder="Buscar por nombre, email o rol…"
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                  />
                </div>

                {filteredUsers.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No hay usuarios que coincidan"
                    subtitle="Probá con otro término de búsqueda."
                  />
                ) : (
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="max-h-[60vh] overflow-auto">
                      <div className="overflow-x-auto">
                        <Table className="min-w-[720px] sm:min-w-0">
                          <TableHeader className="sticky top-0 bg-white z-10">
                            <TableRow>
                              <TableHead>Nombre</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead className="hidden sm:table-cell">
                                Teléfono
                              </TableHead>
                              <TableHead>Rol</TableHead>
                              <TableHead className="w-48">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>

                          <TableBody>
                            {filteredUsers.map((u) => (
                              <TableRow
                                key={u.id}
                                className="hover:bg-slate-50/60"
                              >
                                <TableCell className="font-medium">
                                  <span
                                    className="truncate block max-w-[220px]"
                                    title={u.full_name || "—"}
                                  >
                                    {u.full_name || "—"}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span
                                    className="truncate block max-w-[260px]"
                                    title={u.email || "—"}
                                  >
                                    {u.email || "—"}
                                  </span>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">
                                  {u.phone_number || "—"}
                                </TableCell>
                                <TableCell>
                                  <RoleBadge role={u.role_type} />
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-2">
                                    {u.role_type === "admin" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setRole(u.id, "usuario")}
                                      >
                                        Quitar Admin
                                      </Button>
                                    )}

                                    {(!u.role_type ||
                                      u.role_type === "usuario") && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setRole(u.id, "admin")}
                                      >
                                        Hacer Admin
                                      </Button>
                                    )}

                                    {u.role_type === "superadmin" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled
                                        title="No se puede modificar a superadmin"
                                      >
                                        SuperAdmin
                                      </Button>
                                    )}

                                    {/* 👉 Nuevo botón: 1 mes gratis */}
                                    {u.email && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          giveFreeMonthToUser(u.email)
                                        }
                                      >
                                        1 mes gratis
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === Suscripciones === */}
          <TabsContent value="subscriptions">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle>Suscripciones</CardTitle>
              </CardHeader>
              <CardContent>
                {subscriptions.length === 0 ? (
                  <EmptyState
                    icon={Calendar}
                    title="Sin suscripciones"
                    subtitle="Cuando se creen suscripciones aparecerán aquí."
                  />
                ) : (
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="max-h-[60vh] overflow-auto">
                      <div className="overflow-x-auto">
                        <Table className="min-w-[720px] sm:min-w-0">
                          <TableHeader className="sticky top-0 bg-white z-10">
                            <TableRow>
                              <TableHead>Usuario</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Monto</TableHead>
                              <TableHead className="hidden sm:table-cell">
                                Inicio
                              </TableHead>
                              <TableHead className="hidden sm:table-cell">
                                Vencimiento
                              </TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead className="w-40">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>

                          <TableBody>
                            {subscriptions.map((s) => (
                              <TableRow
                                key={s.id}
                                className="hover:bg-slate-50/60"
                              >
                                {/* Usuario */}
                                <TableCell>{s.user_email || "—"}</TableCell>

                                {/* Tipo (publicaciones / restaurante) */}
                                <TableCell>
                                  <ProductTypeBadge
                                    type={
                                      s.product_type ||
                                      (s.plan_type?.includes("restaurant")
                                        ? "restaurant"
                                        : "publications")
                                    }
                                  />
                                </TableCell>

                                {/* Monto */}
                                <TableCell className="font-medium">
                                  ${Number(s.amount || 0).toLocaleString()}
                                </TableCell>

                                {/* Fechas */}
                                <TableCell className="hidden sm:table-cell text-sm">
                                  {fmtDate(s.start_date)}
                                </TableCell>
                                <TableCell className="hidden sm:table-cell text-sm">
                                  {fmtDate(s.end_date)}
                                </TableCell>

                                {/* Estado */}
                                <TableCell>
                                  <StatusBadge status={s.status} />
                                </TableCell>

                                {/* Acciones */}
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {s.status !== "active" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          setSubscriptionStatus(s.id, "active")
                                        }
                                      >
                                        Activar
                                      </Button>
                                    )}
                                    {s.status === "active" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          setSubscriptionStatus(
                                            s.id,
                                            "inactive"
                                          )
                                        }
                                      >
                                        Inactivar
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {/* === Reportes === */}
          <TabsContent value="reports">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle>Reportes de publicaciones</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Filtros por fecha + buscador para reportes */}
                <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Desde
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 rounded-md border border-slate-200 bg-white text-sm"
                      value={reportFrom}
                      onChange={(e) => setReportFrom(e.target.value)}
                    />
                  </div>

                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Hasta
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 rounded-md border border-slate-200 bg-white text-sm"
                      value={reportTo}
                      onChange={(e) => setReportTo(e.target.value)}
                    />
                  </div>

                  {/* 👇 Nuevo filtro de estado */}
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Estado
                    </label>
                    <Select
                      value={reportStatusFilter}
                      onValueChange={(v) => setReportStatusFilter(v)}
                    >
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="open">Abiertos</SelectItem>
                        <SelectItem value="closed">Cerrados</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex-[2] relative">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Buscar
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        className="w-full pl-9 pr-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-sm"
                        placeholder="Publicación, email, estado o comentario…"
                        value={reportQuery}
                        onChange={(e) => setReportQuery(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {filteredReports.length === 0 ? (
                  <EmptyState
                    icon={Flag}
                    title="Sin reportes"
                    subtitle="Cuando los usuarios reporten publicaciones, aparecerán aquí."
                  />
                ) : (
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="max-h-[60vh] overflow-auto">
                      <div className="overflow-x-auto">
                        <Table className="min-w-[720px] sm:min-w-0">
                          <TableHeader className="sticky top-0 bg-white z-10">
                            <TableRow>
                              <TableHead>Publicación</TableHead>
                              <TableHead className="hidden sm:table-cell">
                                Propietario
                              </TableHead>
                              <TableHead>Reportado por</TableHead>
                              <TableHead className="hidden sm:table-cell">
                                Fecha
                              </TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead className="w-[30%]">
                                Comentario
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredReports.map((r) => (
                              <TableRow
                                key={r.id}
                                className="hover:bg-slate-50/60"
                              >
                                <TableCell className="font-medium">
                                  <div
                                    className="truncate max-w-[220px]"
                                    title={r.publication_title || "—"}
                                  >
                                    {r.publication_title || "—"}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-0.5">
                                    ID: {r.publication_id || "—"}
                                  </div>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell text-sm">
                                  {r.owner_email || "—"}
                                </TableCell>
                                <TableCell className="text-sm">
                                  <div className="truncate max-w-[220px]">
                                    {r.reporter_email || "—"}
                                  </div>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell text-sm">
                                  {fmtDate(r.created_at)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <StatusBadge status={r.status || "open"} />
                                    {(r.status || "open") !== "closed" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2 text-xs"
                                        onClick={() =>
                                          setReportStatus(r.id, "closed")
                                        }
                                      >
                                        Cerrar
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>

                                <TableCell className="text-sm">
                                  <p
                                    className="line-clamp-3"
                                    title={r.comment || ""}
                                  >
                                    {r.comment || "—"}
                                  </p>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogo Editar Publicación */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-xl w-[94vw] sm:w-auto overflow-x-hidden px-4 sm:px-6">
          <DialogHeader>
            <DialogTitle>Editar Publicación</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título</label>
              <Input
                className="min-w-0"
                value={editForm.title}
                onChange={(e) =>
                  setEditForm({ ...editForm, title: e.target.value })
                }
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Textarea
                className="min-w-0"
                rows={4}
                value={editForm.description}
                onChange={(e) =>
                  setEditForm({ ...editForm, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-1">
                <label className="text-sm font-medium">Categoría</label>
                <Select
                  value={editForm.category}
                  onValueChange={(v) =>
                    setEditForm({ ...editForm, category: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="empleo">Empleo</SelectItem>
                    <SelectItem value="alquiler">Alquiler</SelectItem>
                    <SelectItem value="venta">Venta</SelectItem>
                    <SelectItem value="emprendimiento">
                      Emprendimiento
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-1">
                <label className="text-sm font-medium">Precio</label>
                <Input
                  className="min-w-0"
                  type="number"
                  value={editForm.price ?? ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, price: e.target.value })
                  }
                />
              </div>

              <div className="md:col-span-1">
                <label className="text-sm font-medium">Estado</label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => setEditForm({ ...editForm, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">pending</SelectItem>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="inactive">inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-1">
                <label className="text-sm font-medium">Destacada en Home</label>
                <Select
                  value={editForm.featured}
                  onValueChange={(v) =>
                    setEditForm({ ...editForm, featured: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="si">Sí, destacar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =================== Subcomponentes =================== */
function KPI({ title, value, icon, accent }) {
  return (
    <Card className="bg-white/80 backdrop-blur border-slate-200 rounded-2xl shadow-sm">
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className={`text-2xl font-bold ${accent || "text-slate-900"}`}>
            {value}
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
