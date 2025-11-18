// src/pages/GestionarRestaurante.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import {
  UtensilsCrossed,
  Plus,
  Edit,
  Trash2,
  Upload,
  Package,
  AlertCircle,
  CheckCircle,
  Clock,
  Truck,
  XCircle,
  MapPin,
  ExternalLink,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Textarea } from "@/ui/textarea";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { Switch } from "@/ui/switch";
import { toast } from "sonner";

// ===== Firebase =====
import { db, auth } from "@/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// ===== Cloudinary helper (tu archivo) =====
import { uploadToCloudinary } from "@/lib/uploadImage";

export default function GestionarRestaurante() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [myRestaurant, setMyRestaurant] = useState(null);
  const [restaurantLoading, setRestaurantLoading] = useState(true);

  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  const [restaurantDialogOpen, setRestaurantDialogOpen] = useState(false);
  const [menuItemDialogOpen, setMenuItemDialogOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [savingRestaurant, setSavingRestaurant] = useState(false);
  const [savingMenuItem, setSavingMenuItem] = useState(false);
  const [updatingOrderStatusId, setUpdatingOrderStatusId] = useState(null);
  const [ordersFilter, setOrdersFilter] = useState("all");

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [orderIdFilter, setOrderIdFilter] = useState("");
  const [subscription, setSubscription] = useState(null);
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);
  const [subLoading, setSubLoading] = useState(true);

  // fecha para filtrar pedidos (por defecto: hoy)
  const [ordersDateFilter, setOrdersDateFilter] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
  });

  // ---- Helpers de fecha/suscripción ----
  const toJsDate = (v) => {
    if (!v) return null;
    if (v?.toDate) return v.toDate();
    if (v?.seconds) return new Date(v.seconds * 1000);
    const d = new Date(v);
    return isNaN(d) ? null : d;
  };

  const isExpired = (end) => {
    const d = toJsDate(end);
    return d ? d.getTime() < Date.now() : true;
  };

  // Restaurant form
  const [restaurantForm, setRestaurantForm] = useState({
    name: "",
    description: "",
    category: "comida_rapida",
    address: "", // calle
    address_number: "", // número
    city: "Puerto Iguazú",
    phone: "",
    delivery_time: "30-45 min",
    min_order: 0,
    delivery_fee: 0,
    is_open: true,
    logo_url: "",
    cover_image: "",
  });

  // Menu item form
  const [menuItemForm, setMenuItemForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    image_url: "",
    available: true,
  });

  // ==========================
  //  Auth (Firebase)
  // ==========================
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        navigate("/login");
      } else {
        setUser(firebaseUser);
      }
      setAuthLoading(false);
    });

    return () => unsub();
  }, [navigate]);

  // ==========================
  //  Cargar restaurante del usuario
  //  Doc: "restaurants/{user.uid}"
  // ==========================
  useEffect(() => {
    if (!user) return;

    const loadRestaurant = async () => {
      setRestaurantLoading(true);
      try {
        const ref = doc(db, "restaurants", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setMyRestaurant({ id: snap.id, ...snap.data() });
        } else {
          setMyRestaurant(null);
        }
      } catch (error) {
        console.error("Error cargando restaurante:", error);
        toast.error("Error cargando tu restaurante");
      } finally {
        setRestaurantLoading(false);
      }
    };

    loadRestaurant();
  }, [user]);

  // ===== Cargar suscripción del usuario =====
useEffect(() => {
  if (!user) return;

  const loadSubscription = async () => {
    setSubLoading(true);

    try {
      const qSub = query(
        collection(db, "subscriptions"),
        where("user_email", "==", user.email)
      );

      const snap = await getDocs(qSub);

      if (snap.empty) {
        setSubscription(null);
        setSubscriptionExpired(true);
        return;
      }

      const docs = snap.docs.map((d) => d.data());

      // 👇 elegir la suscripción con mayor end_date, manejando bien el "best"
      const best = docs.reduce((best, cur) => {
        if (!cur.end_date) return best;          // ignorar docs sin end_date
        if (!best || !best.end_date) return cur; // primera válida

        const ms = cur.end_date?.toDate?.()
          ? cur.end_date.toDate().getTime()
          : cur.end_date?.seconds
          ? cur.end_date.seconds * 1000
          : new Date(cur.end_date).getTime();

        const bestMs = best.end_date?.toDate?.()
          ? best.end_date.toDate().getTime()
          : best.end_date?.seconds
          ? best.end_date.seconds * 1000
          : new Date(best.end_date).getTime();

        return ms > bestMs ? cur : best;
      }, null);

      if (!best || !best.end_date) {
        setSubscription(null);
        setSubscriptionExpired(true);
        return;
      }

      const expired = isExpired(best.end_date);

      setSubscription(best);
      setSubscriptionExpired(expired);
    } catch (e) {
      console.error("Error cargando suscripción:", e);
      // si querés, podrías ponerla como activa por defecto en caso de error
      // setSubscriptionExpired(false);
    } finally {
      setSubLoading(false);
    }
  };

  loadSubscription();
}, [user]);


  // ==========================
  //  Cargar items del menú
  // ==========================
  useEffect(() => {
    if (!myRestaurant) {
      setMenuItems([]);
      return;
    }

    const qRef = query(
      collection(db, "menu_items"),
      where("restaurant_id", "==", myRestaurant.id),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      qRef,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMenuItems(data);
      },
      (error) => {
        console.error("Error cargando menú:", error);
        toast.error("Error cargando items del menú");
      }
    );

    return () => unsub();
  }, [myRestaurant]);

  // ==========================
  //  Cargar pedidos
  // ==========================
  useEffect(() => {
    if (!myRestaurant) {
      setOrders([]);
      setOrdersLoading(false);
      return;
    }

    setOrdersLoading(true);

    const qRef = query(
      collection(db, "orders"),
      where("restaurant_id", "==", myRestaurant.id),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      qRef,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setOrders(data);
        setOrdersLoading(false);
      },
      (error) => {
        console.error("Error cargando pedidos:", error);
        toast.error("Error cargando pedidos");
        setOrdersLoading(false);
      }
    );

    return () => unsub();
  }, [myRestaurant]);

  // ==========================
  //  Upload de imágenes (Cloudinary)
  // ==========================
  const handleImageUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const imageUrl = await uploadToCloudinary(file);

      if (field.startsWith("restaurant_")) {
        const key = field.replace("restaurant_", "");
        setRestaurantForm((prev) => ({
          ...prev,
          [key]: imageUrl,
        }));
      } else {
        // imagen del item del menú
        setMenuItemForm((prev) => ({
          ...prev,
          image_url: imageUrl,
        }));
      }

      toast.success("Imagen subida");
    } catch (error) {
      console.error("Error subiendo imagen:", error);
      toast.error("Error subiendo imagen");
    } finally {
      setUploading(false);
    }
  };

  // ==========================
  //  Crear / actualizar restaurante
  // ==========================
  const handleCreateOrUpdateRestaurant = async () => {
    if (!user) return;

    if (
      !restaurantForm.name ||
      !restaurantForm.address || // calle
      !restaurantForm.address_number || // número
      !restaurantForm.city || // ciudad
      !restaurantForm.phone
    ) {
      toast.error(
        "Completá todos los campos obligatorios: Nombre, Calle, Número, Ciudad y Teléfono"
      );
      return;
    }

    setSavingRestaurant(true);

    const data = {
      ...restaurantForm,
      min_order: parseFloat(restaurantForm.min_order) || 0,
      delivery_fee: parseFloat(restaurantForm.delivery_fee) || 0,
      owner_uid: user.uid,
      owner_email: user.email || "",
      rating: myRestaurant?.rating || 5,
      // 👇 si es nuevo => pending, si ya existe respeta el status actual
      status: myRestaurant?.status || "pending",
      updatedAt: serverTimestamp(),
      ...(myRestaurant ? {} : { createdAt: serverTimestamp() }),
    };

    try {
      const ref = doc(db, "restaurants", user.uid);
      await setDoc(ref, data, { merge: true });

      setMyRestaurant({ id: user.uid, ...data });
      toast.success(
        myRestaurant
          ? "Restaurante actualizado"
          : "Restaurante creado exitosamente"
      );
      setRestaurantDialogOpen(false);
    } catch (error) {
      console.error("Error guardando restaurante:", error);
      toast.error("Error guardando restaurante");
    } finally {
      setSavingRestaurant(false);
    }
  };

  const handleOpenRestaurantDialog = () => {
    if (subscriptionExpired) {
      toast.error("Tu suscripción está inactiva");
      return;
    }
    if (myRestaurant) {
      setRestaurantForm({
        name: myRestaurant.name || "",
        description: myRestaurant.description || "",
        category: myRestaurant.category || "comida_rapida",
        address: myRestaurant.address || "",
        address_number: myRestaurant.address_number || "",
        city: myRestaurant.city || "Puerto Iguazú",
        phone: myRestaurant.phone || "",
        delivery_time: myRestaurant.delivery_time || "30-45 min",
        min_order: myRestaurant.min_order || 0,
        delivery_fee: myRestaurant.delivery_fee || 0,
        is_open: myRestaurant.is_open !== false,
        logo_url: myRestaurant.logo_url || "",
        cover_image: myRestaurant.cover_image || "",
      });
    } else {
      setRestaurantForm({
        name: "",
        description: "",
        category: "comida_rapida",
        address: "",
        address_number: "",
        city: "Puerto Iguazú",
        phone: "",
        delivery_time: "30-45 min",
        min_order: 0,
        delivery_fee: 0,
        is_open: true,
        logo_url: "",
        cover_image: "",
      });
    }
    setRestaurantDialogOpen(true);
  };

  // ==========================
  //  Menú: crear / editar / borrar items
  // ==========================
  const resetMenuItemForm = () => {
    setMenuItemForm({
      name: "",
      description: "",
      price: "",
      category: "",
      image_url: "",
      available: true,
    });
    setEditingMenuItem(null);
  };

  const handleEditMenuItem = (item) => {
    if (subscriptionExpired) {
      toast.error("Tu suscripción está inactiva");
      return;
    }
    setEditingMenuItem(item);
    setMenuItemForm({
      name: item.name || "",
      description: item.description || "",
      price: item.price || "",
      category: item.category || "",
      image_url: item.image_url || "",
      available: item.available !== false,
    });
    setMenuItemDialogOpen(true);
  };

  const handleSaveMenuItem = async () => {
    if (!myRestaurant) {
      toast.error("Primero configurá tu restaurante");
      return;
    }

    if (!menuItemForm.name || !menuItemForm.price) {
      toast.error("Completá nombre y precio");
      return;
    }

    setSavingMenuItem(true);

    const data = {
      ...menuItemForm,
      price: parseFloat(menuItemForm.price),
      restaurant_id: myRestaurant.id,
      available: menuItemForm.available,
      updatedAt: serverTimestamp(),
      ...(editingMenuItem ? {} : { createdAt: serverTimestamp() }),
    };

    try {
      if (editingMenuItem) {
        const ref = doc(db, "menu_items", editingMenuItem.id);
        await updateDoc(ref, data);
        toast.success("Item actualizado");
      } else {
        await addDoc(collection(db, "menu_items"), data);
        toast.success("Item agregado al menú");
      }
      resetMenuItemForm();
      setMenuItemDialogOpen(false);
    } catch (error) {
      console.error("Error guardando item:", error);
      toast.error("Error guardando item");
    } finally {
      setSavingMenuItem(false);
    }
  };

  const handleDeleteMenuItem = async (id) => {
    if (!confirm("¿Eliminar este item?")) return;

    try {
      await deleteDoc(doc(db, "menu_items", id));
      toast.success("Item eliminado");
    } catch (error) {
      console.error("Error eliminando item:", error);
      toast.error("Error eliminando item");
    }
  };

  // ==========================
  //  Actualizar estado de pedido
  // ==========================
  const updateOrderStatus = async (orderId, status, extraData = {}) => {
    setUpdatingOrderStatusId(orderId);
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status,
        ...extraData, // 👈 acá se mete motivo, quién canceló, etc.
        updatedAt: serverTimestamp(),
      });
      toast.success("Estado del pedido actualizado");
    } catch (error) {
      console.error("Error actualizando pedido:", error);
      toast.error("Error actualizando pedido");
    } finally {
      setUpdatingOrderStatusId(null);
    }
  };

  const getOrderStatusConfig = (status) => {
    const configs = {
      pending: {
        label: "Pendiente",
        icon: AlertCircle,
        color: "bg-yellow-500",
      },
      preparing: { label: "Preparando", icon: Clock, color: "bg-blue-500" },
      on_the_way: { label: "En camino", icon: Truck, color: "bg-purple-500" },
      delivered: {
        label: "Entregado",
        icon: CheckCircle,
        color: "bg-green-500",
      },
      cancelled: { label: "Cancelado", icon: XCircle, color: "bg-red-500" },
    };
    return configs[status] || configs.pending;
  };

  // ==========================
  //  Render
  // ==========================
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" />
          <p className="text-sm text-slate-600">Cargando tu panel...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Primero filtramos por fecha (por día)
  const baseOrders =
    ordersDateFilter && ordersDateFilter !== ""
      ? orders.filter((o) => {
          const ts = o.createdAt;
          if (!ts?.toDate) return false;
          const d = ts.toDate();
          const dateStr = d.toISOString().slice(0, 10); // "YYYY-MM-DD"
          return dateStr === ordersDateFilter;
        })
      : orders;

  // Contadores por estado usando solo los pedidos de esa fecha
  const pendingOrdersCount = baseOrders.filter(
    (o) => o.status === "pending"
  ).length;
  const preparingOrdersCount = baseOrders.filter(
    (o) => o.status === "preparing"
  ).length;
  const onTheWayOrdersCount = baseOrders.filter(
    (o) => o.status === "on_the_way"
  ).length;
  const deliveredOrdersCount = baseOrders.filter(
    (o) => o.status === "delivered"
  ).length;
  const cancelledOrdersCount = baseOrders.filter(
    (o) => o.status === "cancelled"
  ).length;

  const totalOrdersCount = baseOrders.length;
  const totalMenuItems = menuItems.length;

  // Filtro por estado (Todos / Pendientes / En camino, etc.)
  const filteredOrdersByStatus =
    ordersFilter === "all"
      ? baseOrders
      : baseOrders.filter((o) => o.status === ordersFilter);

  // Filtro adicional por ID de pedido
  const filteredOrders =
    orderIdFilter.trim() === ""
      ? filteredOrdersByStatus
      : filteredOrdersByStatus.filter((o) =>
          (o.id || "")
            .toLowerCase()
            .includes(orderIdFilter.trim().toLowerCase())
        );

  // ====== Mapa para el restaurante (en el form) ======
  const restaurantAddressForMap = (() => {
    const street = (restaurantForm.address || "").trim();
    const number = (restaurantForm.address_number || "").trim();
    const city = (restaurantForm.city || "").trim();

    const mainLine = [street, number].filter(Boolean).join(" ");
    if (!mainLine) return "";

    return city ? `${mainLine}, ${city}` : mainLine;
  })();

  const restaurantMapEmbedUrl = restaurantAddressForMap
    ? `https://www.google.com/maps?q=${encodeURIComponent(
        restaurantAddressForMap
      )}&z=16&output=embed`
    : "";

  const restaurantMapLink = restaurantAddressForMap
    ? `https://www.google.com/maps?q=${encodeURIComponent(
        restaurantAddressForMap
      )}`
    : "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-slate-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="mb-4">
          {!subLoading && subscriptionExpired && (
            <Card className="border-l-4 border-l-red-500 bg-red-50/80 shadow-sm mb-4">
              <CardContent className="p-4 flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-700">
                    Suscripción inactiva / vencida
                  </h3>
                  <p className="text-sm text-red-700 mt-1">
                    Tu restaurante NO aparece en la app de Delivery.
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    Renová tu suscripción para habilitar todas las funciones.
                  </p>

                  {/* 👇 ACÁ VA EL BOTÓN */}
                  <Button
                    className="mt-3 bg-red-600 hover:bg-red-700"
                    onClick={() => navigate("/suscripcion")}
                  >
                    Renovar suscripción
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!restaurantLoading && myRestaurant && (
            <Card
              className={`mb-4 border-l-4 ${
                myRestaurant.status === "approved"
                  ? "border-l-green-500 bg-green-50/80"
                  : myRestaurant.status === "rejected"
                  ? "border-l-red-500 bg-red-50/80"
                  : "border-l-amber-500 bg-amber-50/80"
              } shadow-sm`}
            >
              <CardContent className="p-4 flex items-start gap-3">
                {myRestaurant.status === "approved" ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                ) : myRestaurant.status === "rejected" ? (
                  <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                ) : (
                  <Clock className="w-5 h-5 text-amber-600 mt-0.5" />
                )}

                <div>
                  <h3 className="font-semibold text-sm">
                    {myRestaurant.status === "approved"
                      ? "Tu restaurante ya fue aprobado"
                      : myRestaurant.status === "rejected"
                      ? "Tu restaurante fue rechazado"
                      : "Tu restaurante está pendiente de aprobación"}
                  </h3>
                  <p className="text-xs mt-1 text-slate-700">
                    {myRestaurant.status === "approved"
                      ? "Tu restaurante ya aparece en la app de delivery para los clientes."
                      : myRestaurant.status === "rejected"
                      ? "Podés editar la información del restaurante y volver a guardar para que lo revisemos nuevamente."
                      : "Nuestro equipo va a revisar tu restaurante. Mientras esté pendiente, los clientes todavía no lo ven en la app."}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20">
                <UtensilsCrossed className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
                  {myRestaurant ? myRestaurant.name : "Mi Restaurante"}
                </h1>
                <p className="text-slate-600 text-sm md:text-base">
                  Panel para gestionar tu menú, tus pedidos y la información de
                  tu negocio.
                </p>
              </div>
            </div>
            <Button
              onClick={handleOpenRestaurantDialog}
              className="bg-red-600 hover:bg-red-700 shadow-md shadow-red-500/30"
              disabled={subscriptionExpired}
            >
              <Edit className="w-4 h-4 mr-2" />
              {myRestaurant ? "Editar Restaurante" : "Crear Restaurante"}
            </Button>
          </div>

          {!restaurantLoading && !myRestaurant && (
            <Card className="mt-6 border-dashed border-2 border-yellow-300 bg-yellow-50/70">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-yellow-900 mb-1">
                      Todavía no tenés un restaurante
                    </h3>
                    <p className="text-sm text-yellow-800">
                      Hacé clic en{" "}
                      <span className="font-semibold">"Crear Restaurante"</span>{" "}
                      para empezar a recibir pedidos.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Mini dashboard de stats */}
        {myRestaurant && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="shadow-sm border-none bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Productos en el menú
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {totalMenuItems}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                  <UtensilsCrossed className="w-5 h-5 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-none bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Pedidos pendientes
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {pendingOrdersCount}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-none bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Pedidos totales
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {totalOrdersCount}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                  <Package className="w-5 h-5 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {myRestaurant && (
          <Tabs defaultValue="menu" className="space-y-6">
            <TabsList className="w-full flex bg-slate-100/80 backdrop-blur-sm rounded-xl shadow-sm border p-1 gap-1">
              <TabsTrigger
                value="menu"
                className="flex-1 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-700
                 data-[state=active]:bg-white
                 data-[state=active]:shadow
                 data-[state=active]:border
                 data-[state=active]:border-red-500"
              >
                Menú
              </TabsTrigger>

              <TabsTrigger
                value="orders"
                className="flex-1 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-700
                 data-[state=active]:bg-white
                 data-[state=active]:shadow
                 data-[state=active]:border
                 data-[state=active]:border-red-500
                 flex items-center justify-center gap-2"
              >
                <span>Pedidos</span>

                {pendingOrdersCount > 0 && (
                  <Badge className="bg-red-500 text-[10px] px-2 py-0.5">
                    {pendingOrdersCount}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="info"
                className="flex-1 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-700
                 data-[state=active]:bg-white
                 data-[state=active]:shadow
                 data-[state=active]:border
                 data-[state=active]:border-red-500"
              >
                Info del Restaurante
              </TabsTrigger>
            </TabsList>

            {/* Menú */}
            <TabsContent value="menu">
              <Card className="shadow-md border-none bg-white/90 backdrop-blur-sm">
                <CardHeader className="border-b pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg font-semibold">
                      Menú del Restaurante
                    </CardTitle>
                    <p className="text-xs text-slate-500 mt-1">
                      Agregá, editá o desactivá productos del menú.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      if (subscriptionExpired) {
                        toast.error("Tu suscripción está inactiva");
                        return;
                      }
                      resetMenuItemForm();
                      setMenuItemDialogOpen(true);
                    }}
                    className="bg-red-600 hover:bg-red-700 shadow-sm"
                    disabled={subscriptionExpired} // 👈 ACÁ VA EL disabled
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Item
                  </Button>
                </CardHeader>
                <CardContent className="pt-4">
                  {menuItems.length === 0 ? (
                    <div className="text-center py-12">
                      <UtensilsCrossed className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-700 font-medium">
                        No hay items en el menú todavía
                      </p>
                      <p className="text-sm text-slate-500 mt-2">
                        Agregá productos para que los clientes puedan hacer
                        pedidos.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {menuItems.map((item) => (
                        <Card
                          key={item.id}
                          className="overflow-hidden border border-slate-100 shadow-sm hover:shadow-lg transition-shadow bg-white"
                        >
                          {item.image_url && (
                            <div className="h-40 overflow-hidden">
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-full h-full object-cover hover:scale-105 transition-transform"
                              />
                            </div>
                          )}
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <h3 className="font-bold text-lg text-slate-900">
                                  {item.name}
                                </h3>
                                {item.category && (
                                  <Badge
                                    variant="outline"
                                    className="mt-1 text-xs"
                                  >
                                    {item.category}
                                  </Badge>
                                )}
                              </div>
                              <Badge
                                className={
                                  item.available
                                    ? "bg-emerald-500"
                                    : "bg-slate-500"
                                }
                              >
                                {item.available
                                  ? "Disponible"
                                  : "No disponible"}
                              </Badge>
                            </div>

                            {item.description && (
                              <p className="text-sm text-slate-600 line-clamp-2">
                                {item.description}
                              </p>
                            )}

                            <p className="text-2xl font-bold text-red-600">
                              ${Number(item.price).toLocaleString()}
                            </p>

                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() => handleEditMenuItem(item)}
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => handleDeleteMenuItem(item.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Pedidos */}
            <TabsContent value="orders">
              <Card className="shadow-md border-none bg-white/90 backdrop-blur-sm">
                <CardHeader className="border-b pb-3">
                  <CardTitle className="text-lg font-semibold">
                    Pedidos Recibidos
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-1">
                    Actualizá el estado de los pedidos en tiempo real.
                  </p>
                </CardHeader>
                <CardContent className="pt-4">
                  {/* Filtro por fecha (por día) */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div className="text-xs text-slate-500">
                      <span className="font-semibold">Filtrar por día: </span>
                      <span>
                        {ordersDateFilter
                          ? new Date(
                              ordersDateFilter + "T00:00:00"
                            ).toLocaleDateString()
                          : "Todos los días"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={ordersDateFilter}
                        onChange={(e) => setOrdersDateFilter(e.target.value)}
                        className="h-8 w-40 text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const d = new Date();
                          setOrdersDateFilter(d.toISOString().slice(0, 10));
                        }}
                      >
                        Hoy
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setOrdersDateFilter("")}
                      >
                        Ver todos
                      </Button>
                    </div>
                  </div>

                  {/* Filtro por ID de pedido */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <p className="text-xs text-slate-500">
                      Buscar por{" "}
                      <span className="font-semibold">ID de pedido</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={orderIdFilter}
                        onChange={(e) => setOrderIdFilter(e.target.value)}
                        placeholder="Ej: abc123..."
                        className="h-8 w-48 text-xs"
                      />
                      {orderIdFilter && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setOrderIdFilter("")}
                        >
                          Limpiar
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Sub-menú de filtros por estado */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {[
                      { key: "all", label: "Todos", count: totalOrdersCount },
                      {
                        key: "pending",
                        label: "Pendientes",
                        count: pendingOrdersCount,
                      },
                      {
                        key: "preparing",
                        label: "Preparando",
                        count: preparingOrdersCount,
                      },
                      {
                        key: "on_the_way",
                        label: "En camino",
                        count: onTheWayOrdersCount,
                      },
                      {
                        key: "delivered",
                        label: "Entregados",
                        count: deliveredOrdersCount,
                      },
                      {
                        key: "cancelled",
                        label: "Cancelados",
                        count: cancelledOrdersCount,
                      },
                    ].map((status) => (
                      <button
                        key={status.key}
                        type="button"
                        onClick={() => setOrdersFilter(status.key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1 transition-colors ${
                          ordersFilter === status.key
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <span>{status.label}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/5">
                          {status.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  {ordersLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
                      <p className="text-sm text-slate-500">
                        Cargando pedidos...
                      </p>
                    </div>
                  ) : baseOrders.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-700 font-medium">
                        No hay pedidos todavía
                      </p>
                      <p className="text-sm text-slate-500 mt-2">
                        Cuando los clientes hagan pedidos, van a aparecer acá.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredOrders.map((order) => {
                        const statusConfig = getOrderStatusConfig(order.status);
                        const StatusIcon = statusConfig.icon;
                        const createdAt = order.createdAt?.toDate
                          ? order.createdAt.toDate()
                          : null;

                        const rawMapLink = order.map_link || "";
                        let mapEmbedUrl = "";
                        if (rawMapLink) {
                          mapEmbedUrl = rawMapLink.includes("output=embed")
                            ? rawMapLink
                            : `${rawMapLink}${
                                rawMapLink.includes("?") ? "&" : "?"
                              }output=embed`;
                        }
                        const isDelivered = order.status === "delivered";
                        const isCustomerConfirmed = !!order.customer_confirmed;

                        return (
                          <Card
                            key={order.id}
                            className="border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
                          >
                            <CardContent className="p-6 space-y-4">
                              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                  <h3 className="font-bold text-lg text-slate-900">
                                    {order.customer_name}
                                  </h3>
                                  <p className="text-sm text-slate-600">
                                    {order.customer_phone}
                                  </p>
                                  {createdAt && (
                                    <p className="text-xs text-slate-500 mt-1">
                                      {createdAt.toLocaleString()}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <Badge className={`${statusConfig.color}`}>
                                    <StatusIcon className="w-4 h-4 mr-1" />
                                    {statusConfig.label}
                                  </Badge>

                                  {isDelivered && isCustomerConfirmed && (
                                    <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                      Confirmado por el cliente ✅
                                    </span>
                                  )}

                                  <p className="text-2xl font-bold text-slate-900">
                                    ${Number(order.total).toLocaleString()}
                                  </p>
                                </div>
                              </div>

                              <div className="bg-slate-50 rounded-lg p-4">
                                <h4 className="font-semibold mb-2 text-sm">
                                  Items del pedido
                                </h4>
                                <div className="space-y-1 text-sm">
                                  {order.items?.map((item, idx) => (
                                    <div
                                      key={idx}
                                      className="flex justify-between"
                                    >
                                      <span>
                                        {item.name} x{item.quantity}
                                      </span>
                                      <span className="font-semibold">
                                        $
                                        {(
                                          Number(item.price) *
                                          Number(item.quantity)
                                        ).toLocaleString()}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-1 text-sm">
                                <p>
                                  <strong>Dirección:</strong>{" "}
                                  {order.delivery_address}
                                </p>
                                <p>
                                  <strong>Pago:</strong>{" "}
                                  {order.payment_method === "cash"
                                    ? "Efectivo"
                                    : order.payment_method === "card"
                                    ? "Tarjeta"
                                    : "Transferencia"}
                                </p>
                                {order.notes && (
                                  <p>
                                    <strong>Notas:</strong> {order.notes}
                                  </p>
                                )}
                                {order.status === "cancelled" &&
                                  order.cancel_reason && (
                                    <p className="text-xs text-red-600 mt-1">
                                      <strong>Motivo de cancelación:</strong>{" "}
                                      {order.cancel_reason}
                                    </p>
                                  )}
                              </div>

                              {rawMapLink && (
                                <div className="mt-2">
                                  <p className="text-xs text-slate-600 mb-1 flex items-center gap-1.5">
                                    <MapPin className="w-3 h-3" />
                                    <span>Mapa de la entrega</span>
                                  </p>
                                  <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50 h-48 mb-2">
                                    <iframe
                                      title={`Mapa pedido ${order.id}`}
                                      src={mapEmbedUrl}
                                      className="w-full h-full border-0"
                                      loading="lazy"
                                      referrerPolicy="no-referrer-when-downgrade"
                                    />
                                  </div>
                                  <a
                                    href={rawMapLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center text-xs text-blue-600 hover:underline"
                                  >
                                    Abrir en Google Maps
                                    <ExternalLink className="w-3 h-3 ml-1" />
                                  </a>
                                </div>
                              )}

                              {order.status !== "delivered" &&
                                order.status !== "cancelled" && (
                                  <div className="flex flex-wrap gap-2 pt-2">
                                    {order.status === "pending" && (
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          updateOrderStatus(
                                            order.id,
                                            "preparing"
                                          )
                                        }
                                        disabled={
                                          subscriptionExpired ||
                                          updatingOrderStatusId === order.id
                                        }
                                        className="bg-blue-600 hover:bg-blue-700"
                                      >
                                        Aceptar Pedido
                                      </Button>
                                    )}
                                    {order.status === "preparing" && (
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          updateOrderStatus(
                                            order.id,
                                            "on_the_way"
                                          )
                                        }
                                        disabled={
                                          updatingOrderStatusId === order.id
                                        }
                                        className="bg-purple-600 hover:bg-purple-700"
                                      >
                                        Marcar en Camino
                                      </Button>
                                    )}
                                    {order.status === "on_the_way" && (
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          updateOrderStatus(
                                            order.id,
                                            "delivered"
                                          )
                                        }
                                        disabled={
                                          updatingOrderStatusId === order.id
                                        }
                                        className="bg-green-600 hover:bg-green-700"
                                      >
                                        Marcar Entregado
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-red-600 hover:bg-red-50"
                                      onClick={() => {
                                        setOrderToCancel(order);
                                        setCancelReason("");
                                        setCancelDialogOpen(true);
                                      }}
                                      disabled={
                                        updatingOrderStatusId === order.id
                                      }
                                    >
                                      Cancelar
                                    </Button>
                                  </div>
                                )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Info restaurante */}
            <TabsContent value="info">
              <Card className="shadow-md border-none bg-white/90 backdrop-blur-sm">
                <CardHeader className="border-b pb-3">
                  <CardTitle>Información del Restaurante</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Nombre</p>
                      <p className="font-semibold text-slate-900">
                        {myRestaurant.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Categoría</p>
                      <p className="font-semibold text-slate-900">
                        {myRestaurant.category}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Teléfono</p>
                      <p className="font-semibold text-slate-900">
                        {myRestaurant.phone}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Dirección</p>
                      <p className="font-semibold text-slate-900">
                        {myRestaurant.address}
                        {myRestaurant.address_number &&
                          ` ${myRestaurant.address_number}`}
                        {myRestaurant.city && `, ${myRestaurant.city}`}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-600 mb-1">
                        Tiempo de entrega
                      </p>
                      <p className="font-semibold text-slate-900">
                        {myRestaurant.delivery_time}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 mb-1">
                        Pedido mínimo
                      </p>
                      <p className="font-semibold text-slate-900">
                        ${Number(myRestaurant.min_order || 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 mb-1">
                        Costo de envío
                      </p>
                      <p className="font-semibold text-slate-900">
                        $
                        {Number(
                          myRestaurant.delivery_fee || 0
                        ).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Estado</p>
                      <Badge
                        className={
                          myRestaurant.is_open ? "bg-green-500" : "bg-red-500"
                        }
                      >
                        {myRestaurant.is_open ? "Abierto" : "Cerrado"}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-slate-600 mb-1">
                      Estado de aprobación
                    </p>
                    <Badge
                      className={
                        myRestaurant.status === "approved"
                          ? "bg-green-500"
                          : myRestaurant.status === "rejected"
                          ? "bg-red-500"
                          : "bg-amber-500"
                      }
                    >
                      {myRestaurant.status === "approved"
                        ? "Aprobado"
                        : myRestaurant.status === "rejected"
                        ? "Rechazado"
                        : "Pendiente de aprobación"}
                    </Badge>
                  </div>

                  {myRestaurant.description && (
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Descripción</p>
                      <p className="text-slate-800 text-sm leading-relaxed">
                        {myRestaurant.description}
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleOpenRestaurantDialog}
                    className="mt-2 bg-red-600 hover:bg-red-700 shadow-sm"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar Información
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Dialog restaurante */}
      <Dialog
        open={restaurantDialogOpen}
        onOpenChange={setRestaurantDialogOpen}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {myRestaurant ? "Editar Restaurante" : "Crear Restaurante"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nombre del Restaurante *</Label>
                <Input
                  id="name"
                  value={restaurantForm.name}
                  onChange={(e) =>
                    setRestaurantForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="category">Categoría *</Label>
                <Select
                  value={restaurantForm.category}
                  onValueChange={(value) =>
                    setRestaurantForm((prev) => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pizza">Pizza</SelectItem>
                    <SelectItem value="hamburguesa">Hamburguesa</SelectItem>
                    <SelectItem value="empanadas">Empanadas</SelectItem>
                    <SelectItem value="sushi">Sushi</SelectItem>
                    <SelectItem value="parrilla">Parrilla</SelectItem>
                    <SelectItem value="comida_rapida">Comida Rápida</SelectItem>
                    <SelectItem value="saludable">Saludable</SelectItem>
                    <SelectItem value="postres">Postres</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={restaurantForm.description}
                onChange={(e) =>
                  setRestaurantForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Teléfono *</Label>
                <Input
                  id="phone"
                  value={restaurantForm.phone}
                  onChange={(e) =>
                    setRestaurantForm((prev) => ({
                      ...prev,
                      phone: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="address">Calle *</Label>
                <Input
                  id="address"
                  value={restaurantForm.address}
                  onChange={(e) =>
                    setRestaurantForm((prev) => ({
                      ...prev,
                      address: e.target.value,
                    }))
                  }
                  placeholder="Ej: Av. Misiones"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="address_number">Número *</Label>
                <Input
                  id="address_number"
                  value={restaurantForm.address_number}
                  onChange={(e) =>
                    setRestaurantForm((prev) => ({
                      ...prev,
                      address_number: e.target.value,
                    }))
                  }
                  placeholder="Ej: 234"
                />
              </div>
              <div>
                <Label htmlFor="city">Ciudad *</Label>
                <Input
                  id="city"
                  value={restaurantForm.city}
                  onChange={(e) =>
                    setRestaurantForm((prev) => ({
                      ...prev,
                      city: e.target.value,
                    }))
                  }
                  placeholder="Ej: Puerto Iguazú"
                />
              </div>
            </div>

            {restaurantAddressForMap && (
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  Mapa de la dirección
                </Label>

                <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50 h-48">
                  <iframe
                    title="Mapa del restaurante"
                    src={restaurantMapEmbedUrl}
                    className="w-full h-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>

                <a
                  href={restaurantMapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-xs text-blue-600 hover:underline"
                >
                  Abrir en Google Maps
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>

                <p className="text-[11px] text-slate-400">
                  El mapa se genera automáticamente según la dirección que
                  escribas. Revisá que esté bien para evitar errores en el
                  reparto.
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="delivery_time">Tiempo de entrega</Label>
                <Input
                  id="delivery_time"
                  value={restaurantForm.delivery_time}
                  onChange={(e) =>
                    setRestaurantForm((prev) => ({
                      ...prev,
                      delivery_time: e.target.value,
                    }))
                  }
                  placeholder="30-45 min"
                />
              </div>
              <div>
                <Label htmlFor="min_order">Pedido mínimo ($)</Label>
                <Input
                  id="min_order"
                  type="number"
                  value={restaurantForm.min_order}
                  onChange={(e) =>
                    setRestaurantForm((prev) => ({
                      ...prev,
                      min_order: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="delivery_fee">Costo de envío ($)</Label>
                <Input
                  id="delivery_fee"
                  type="number"
                  value={restaurantForm.delivery_fee}
                  onChange={(e) =>
                    setRestaurantForm((prev) => ({
                      ...prev,
                      delivery_fee: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_open"
                checked={restaurantForm.is_open}
                onCheckedChange={(checked) =>
                  setRestaurantForm((prev) => ({ ...prev, is_open: checked }))
                }
              />
              <Label htmlFor="is_open">Restaurante abierto</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Logo</Label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, "restaurant_logo_url")}
                  className="hidden"
                  id="logo-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => document.getElementById("logo-upload").click()}
                  disabled={uploading}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {restaurantForm.logo_url ? "Cambiar Logo" : "Subir Logo"}
                </Button>
                {restaurantForm.logo_url && (
                  <img
                    src={restaurantForm.logo_url}
                    alt="Logo"
                    className="mt-2 w-20 h-20 object-cover rounded-lg border border-slate-200"
                  />
                )}
              </div>

              <div>
                <Label>Imagen de portada</Label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleImageUpload(e, "restaurant_cover_image")
                  }
                  className="hidden"
                  id="cover-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    document.getElementById("cover-upload").click()
                  }
                  disabled={uploading}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {restaurantForm.cover_image
                    ? "Cambiar Portada"
                    : "Subir Portada"}
                </Button>
                {restaurantForm.cover_image && (
                  <img
                    src={restaurantForm.cover_image}
                    alt="Portada"
                    className="mt-2 w-full h-20 object-cover rounded-lg border border-slate-200"
                  />
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setRestaurantDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateOrUpdateRestaurant}
                disabled={savingRestaurant || subscriptionExpired}
                className="bg-red-600 hover:bg-red-700"
              >
                {myRestaurant ? "Actualizar" : "Crear Restaurante"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Dialog motivo de cancelación */}
      <Dialog
        open={cancelDialogOpen}
        onOpenChange={(open) => {
          setCancelDialogOpen(open);
          if (!open) {
            setCancelReason("");
            setOrderToCancel(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar pedido</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <p className="text-sm text-slate-600">
              Este motivo se le va a mostrar al cliente en su pantalla de
              pedidos.
            </p>

            <div>
              <Label htmlFor="cancel_reason">Motivo de la cancelación *</Label>
              <Textarea
                id="cancel_reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ej: El producto está agotado, hubo un problema con el envío, etc."
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCancelDialogOpen(false);
                  setCancelReason("");
                  setOrderToCancel(null);
                }}
              >
                Volver
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700"
                disabled={
                  !cancelReason.trim() ||
                  !orderToCancel ||
                  updatingOrderStatusId === orderToCancel?.id
                }
                onClick={async () => {
                  if (!orderToCancel || !cancelReason.trim()) return;

                  await updateOrderStatus(orderToCancel.id, "cancelled", {
                    cancel_reason: cancelReason.trim(),
                    cancelled_by: "restaurant",
                  });

                  setCancelDialogOpen(false);
                  setCancelReason("");
                  setOrderToCancel(null);
                }}
              >
                Confirmar cancelación
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog item de menú */}
      <Dialog
        open={menuItemDialogOpen}
        onOpenChange={(open) => {
          setMenuItemDialogOpen(open);
          if (!open) resetMenuItemForm();
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingMenuItem
                ? "Editar Item del Menú"
                : "Agregar Item al Menú"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="item_name">Nombre del producto *</Label>
              <Input
                id="item_name"
                value={menuItemForm.name}
                onChange={(e) =>
                  setMenuItemForm((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                placeholder="Ej: Pizza Muzzarella"
              />
            </div>

            <div>
              <Label htmlFor="item_description">Descripción</Label>
              <Textarea
                id="item_description"
                value={menuItemForm.description}
                onChange={(e) =>
                  setMenuItemForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Describe el producto..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="item_price">Precio *</Label>
                <Input
                  id="item_price"
                  type="number"
                  value={menuItemForm.price}
                  onChange={(e) =>
                    setMenuItemForm((prev) => ({
                      ...prev,
                      price: e.target.value,
                    }))
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="item_category">Categoría</Label>
                <Input
                  id="item_category"
                  value={menuItemForm.category}
                  onChange={(e) =>
                    setMenuItemForm((prev) => ({
                      ...prev,
                      category: e.target.value,
                    }))
                  }
                  placeholder="Ej: Pizzas, Bebidas"
                />
              </div>
            </div>

            <div>
              <Label>Imagen del producto</Label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, "menu_item")}
                className="hidden"
                id="item-image-upload"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() =>
                  document.getElementById("item-image-upload").click()
                }
                disabled={uploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                {menuItemForm.image_url ? "Cambiar Imagen" : "Subir Imagen"}
              </Button>
              {menuItemForm.image_url && (
                <img
                  src={menuItemForm.image_url}
                  alt="Preview"
                  className="mt-2 w-full h-40 object-cover rounded-lg border border-slate-200"
                />
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="item_available"
                checked={menuItemForm.available}
                onCheckedChange={(checked) =>
                  setMenuItemForm((prev) => ({ ...prev, available: checked }))
                }
              />
              <Label htmlFor="item_available">Disponible</Label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setMenuItemDialogOpen(false);
                  resetMenuItemForm();
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveMenuItem}
                disabled={savingMenuItem || subscriptionExpired}
                className="bg-red-600 hover:bg-red-700"
              >
                {editingMenuItem ? "Actualizar" : "Agregar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
