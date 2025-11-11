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
      : "bg-blue-100 text-blue-700 border border-blue-200";
  return <Badge className={`capitalize ${cls}`}>{r}</Badge>;
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

  // filtros
  const [pubQuery, setPubQuery] = useState("");
  const [userQuery, setUserQuery] = useState("");

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
  });

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
    });
    return () => unsub();
  }, []);

  // --- Cargar todo ---
  const loadAll = async () => {
    setLoading(true);
    const [usersSnap, pubsSnap, subsSnap] = await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(collection(db, "publications")),
      getDocs(collection(db, "subscriptions")),
    ]);
    setUsers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setPublications(pubsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setSubscriptions(subsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
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

  const openEdit = (p) => {
    setEditing(p);
    setEditForm({
      title: p.title || "",
      description: p.description || "",
      category: p.category || "empleo",
      price: p.price ?? "",
      status: p.status || "pending",
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
    };
    await updateDoc(doc(db, "publications", editing.id), payload);
    toast.success("Publicación actualizada");
    setEditOpen(false);
    setEditing(null);
    loadAll();
  };

  const deletePublication = async (id) => {
    if (!confirm("¿Eliminar esta publicación?")) return;
    await deleteDoc(doc(db, "publications", id));
    toast.success("Publicación eliminada");
    loadAll();
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

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-300 border-t-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 pb-12">
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
          <div className="text-sm text-slate-500">
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

        {/* Tabs */}
        <Tabs defaultValue="publications" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 rounded-xl bg-white/70 backdrop-blur border border-slate-200">
            <TabsTrigger value="publications">
              Publicaciones
              <span className="ml-2 text-xs rounded-full px-2 py-0.5 bg-slate-100">
                {publications.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="users">
              Usuarios
              <span className="ml-2 text-xs rounded-full px-2 py-0.5 bg-slate-100">
                {users.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="subscriptions">
              Suscripciones
              <span className="ml-2 text-xs rounded-full px-2 py-0.5 bg-slate-100">
                {subscriptions.length}
              </span>
            </TabsTrigger>
          </TabsList>

          {/* === Publicaciones === */}
          <TabsContent value="publications">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle>Gestión de Publicaciones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    className="w-full pl-9 pr-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
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
                      <Table>
                        <TableHeader className="sticky top-0 bg-white z-10">
                          <TableRow>
                            <TableHead>Título</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="w-48">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredPublications.map((p) => (
                            <TableRow
                              key={p.id}
                              className="hover:bg-slate-50/60"
                            >
                              <TableCell className="font-medium">
                                {p.title}
                              </TableCell>
                              <TableCell>
                                <Badge className="bg-slate-100 text-slate-700 border border-slate-200">
                                  {p.category || "—"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {p.user_email || p.created_by || "—"}
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={p.status} />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
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
                      <Table>
                        <TableHeader className="sticky top-0 bg-white z-10">
                          <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Teléfono</TableHead>{" "}
                            {/* 👈 nuevo campo */}
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
                                {u.full_name || "—"}
                              </TableCell>
                              <TableCell>{u.email || "—"}</TableCell>
                              <TableCell>
                                {u.phone_number || "—"}
                              </TableCell>{" "}
                              {/* 👈 nuevo campo */}
                              <TableCell>
                                <RoleBadge role={u.role_type} />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
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
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
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
                      <Table>
                        <TableHeader className="sticky top-0 bg-white z-10">
                          <TableRow>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Monto</TableHead>
                            <TableHead>Inicio</TableHead>
                            <TableHead>Vencimiento</TableHead>
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
                              <TableCell>{s.user_email || "—"}</TableCell>
                              <TableCell className="font-medium">
                                ${Number(s.amount || 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-sm">
                                {fmtDate(s.start_date)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {fmtDate(s.end_date)}
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={s.status} />
                              </TableCell>
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
                                        setSubscriptionStatus(s.id, "inactive")
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
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogo Editar Publicación */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar Publicación</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título</label>
              <Input
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
                rows={4}
                value={editForm.description}
                onChange={(e) =>
                  setEditForm({ ...editForm, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
