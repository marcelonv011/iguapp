import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/firebase";
import { onAuthStateChanged } from "firebase/auth";

import {
  Shield, Users, FileText, Calendar, Eye,
  CheckCircle, XCircle, Search, Home as HomeIcon
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";
import { toast } from "sonner";

// =================== Helpers visuales ===================
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

// =================== Página ===================
export default function SuperAdminPanel() {
  const navigate = useNavigate();

  const [authProfile, setAuthProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [publications, setPublications] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  // filtros
  const [pubQuery, setPubQuery] = useState("");
  const [userQuery, setUserQuery] = useState("");

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
      setAuthProfile(current);
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

  // --- Acciones ---
  const updatePublicationStatus = async (id, status) => {
    await updateDoc(doc(db, "publications", id), { status });
    toast.success(status === "active" ? "Publicación aprobada" : "Publicación rechazada");
    loadAll();
  };

  const changeUserRole = async (id, role_type) => {
    await updateDoc(doc(db, "users", id), { role_type });
    toast.success(`Rol actualizado a ${role_type}`);
    loadAll();
  };

  // --- Derivados (contadores + filtros) ---
  const stats = useMemo(() => ({
    totalUsers: users.length,
    admins: users.filter((u) => u.role_type === "admin").length,
    activeSubscriptions: subscriptions.filter((s) => s.status === "active").length,
    pendingPublications: publications.filter((p) => p.status === "pending").length,
  }), [users, publications, subscriptions]);

  const filteredPublications = useMemo(() => {
    const q = pubQuery.toLowerCase().trim();
    if (!q) return publications;
    return publications.filter(p =>
      (p.title || "").toLowerCase().includes(q) ||
      (p.category || "").toLowerCase().includes(q) ||
      (p.user_email || "").toLowerCase().includes(q) ||
      (p.status || "").toLowerCase().includes(q)
    );
  }, [publications, pubQuery]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.toLowerCase().trim();
    if (!q) return users;
    return users.filter(u =>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <h1 className="text-2xl md:text-3xl font-bold">Panel SuperAdmin</h1>
              <p className="text-white/80 text-sm">Gestión completa de la plataforma</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 pb-10">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPI title="Usuarios" value={stats.totalUsers} icon={<Users className="w-5 h-5 text-blue-600" />} />
          <KPI title="Admins" value={stats.admins} icon={<Shield className="w-5 h-5 text-purple-600" />} />
          <KPI title="Suscripciones" value={stats.activeSubscriptions} icon={<Calendar className="w-5 h-5 text-emerald-600" />} />
          <KPI title="Pendientes" value={stats.pendingPublications} icon={<FileText className="w-5 h-5 text-amber-600" />} />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="publications" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="publications">
              Publicaciones
              <span className="ml-2 text-xs rounded-full px-2 py-0.5 bg-slate-100">{publications.length}</span>
            </TabsTrigger>
            <TabsTrigger value="users">
              Usuarios
              <span className="ml-2 text-xs rounded-full px-2 py-0.5 bg-slate-100">{users.length}</span>
            </TabsTrigger>
            <TabsTrigger value="subscriptions">
              Suscripciones
              <span className="ml-2 text-xs rounded-full px-2 py-0.5 bg-slate-100">{subscriptions.length}</span>
            </TabsTrigger>
          </TabsList>

          {/* === Publicaciones === */}
          <TabsContent value="publications">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Gestión de Publicaciones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    className="w-full pl-9 pr-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                            <TableHead className="w-36">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredPublications.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">{p.title}</TableCell>
                              <TableCell><Badge className="bg-slate-100 text-slate-700 border border-slate-200">{p.category || "—"}</Badge></TableCell>
                              <TableCell className="text-sm">{p.user_email || "—"}</TableCell>
                              <TableCell><StatusBadge status={p.status} /></TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {p.status === "pending" && (
                                    <>
                                      <Button size="sm" variant="outline" onClick={() => updatePublicationStatus(p.id, "active")}>
                                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={() => updatePublicationStatus(p.id, "inactive")}>
                                        <XCircle className="w-4 h-4 text-rose-600" />
                                      </Button>
                                    </>
                                  )}
                                  {p.images?.[0] && (
                                    <Button size="sm" variant="outline" onClick={() => window.open(p.images[0], "_blank")}>
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
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Gestión de Usuarios</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    className="w-full pl-9 pr-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                            <TableHead>Rol</TableHead>
                            <TableHead className="w-40">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredUsers.map((u) => (
                            <TableRow key={u.id}>
                              <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                              <TableCell>{u.email || "—"}</TableCell>
                              <TableCell><RoleBadge role={u.role_type} /></TableCell>
                              <TableCell>
                                {u.role_type !== "admin" && u.role_type !== "superadmin" && (
                                  <Button size="sm" variant="outline" onClick={() => changeUserRole(u.id, "admin")}>
                                    Hacer Admin
                                  </Button>
                                )}
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
            <Card>
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
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {subscriptions.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell>{s.user_email || "—"}</TableCell>
                              <TableCell className="font-medium">${s.amount ?? 0}</TableCell>
                              <TableCell className="text-sm">{s.start_date || "—"}</TableCell>
                              <TableCell className="text-sm">{s.end_date || "—"}</TableCell>
                              <TableCell><StatusBadge status={s.status} /></TableCell>
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
    </div>
  );
}

// =================== Subcomponentes ===================
function KPI({ title, value, icon }) {
  return (
    <Card className="bg-white/70 backdrop-blur border-slate-200">
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
