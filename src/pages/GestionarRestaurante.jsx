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

  // Restaurant form
  const [restaurantForm, setRestaurantForm] = useState({
    name: "",
    description: "",
    category: "comida_rapida",
    address: "",
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
      !restaurantForm.address ||
      !restaurantForm.phone
    ) {
      toast.error("Completá todos los campos obligatorios");
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
    if (myRestaurant) {
      setRestaurantForm({
        name: myRestaurant.name || "",
        description: myRestaurant.description || "",
        category: myRestaurant.category || "comida_rapida",
        address: myRestaurant.address || "",
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
  const updateOrderStatus = async (orderId, status) => {
    setUpdatingOrderStatusId(orderId);
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status,
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const pendingOrdersCount = orders.filter(
    (o) => o.status === "pending"
  ).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-slate-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          {/* Aviso de aprobación por superadmin */}
          {!restaurantLoading && myRestaurant && (
            <Card
              className={
                myRestaurant.status === "approved"
                  ? "border-green-200 bg-green-50"
                  : myRestaurant.status === "rejected"
                  ? "border-red-200 bg-red-50"
                  : "border-amber-200 bg-amber-50"
              }
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

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center">
                <UtensilsCrossed className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
                  {myRestaurant ? myRestaurant.name : "Mi Restaurante"}
                </h1>
                <p className="text-slate-600">
                  Gestioná tu negocio de delivery
                </p>
              </div>
            </div>
            <Button
              onClick={handleOpenRestaurantDialog}
              className="bg-red-600 hover:bg-red-700"
            >
              <Edit className="w-4 h-4 mr-2" />
              {myRestaurant ? "Editar Restaurante" : "Crear Restaurante"}
            </Button>
          </div>

          {!restaurantLoading && !myRestaurant && (
            <Card className="border-yellow-300 bg-yellow-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-yellow-900 mb-1">
                      Todavía no tenés un restaurante
                    </h3>
                    <p className="text-sm text-yellow-800">
                      Hacé clic en "Crear Restaurante" para empezar a recibir
                      pedidos
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {myRestaurant && (
          <Tabs defaultValue="menu" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="menu">Menú</TabsTrigger>
              <TabsTrigger value="orders">
                Pedidos
                {pendingOrdersCount > 0 && (
                  <Badge className="ml-2 bg-red-500">
                    {pendingOrdersCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="info">Info del Restaurante</TabsTrigger>
            </TabsList>

            {/* Menú */}
            <TabsContent value="menu">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Menú del Restaurante</CardTitle>
                    <Button
                      onClick={() => {
                        resetMenuItemForm();
                        setMenuItemDialogOpen(true);
                      }}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar Item
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {menuItems.length === 0 ? (
                    <div className="text-center py-12">
                      <UtensilsCrossed className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-600">
                        No hay items en el menú todavía
                      </p>
                      <p className="text-sm text-slate-500 mt-2">
                        Agregá productos para que los clientes puedan hacer
                        pedidos
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {menuItems.map((item) => (
                        <Card key={item.id} className="overflow-hidden">
                          {item.image_url && (
                            <div className="h-40 overflow-hidden">
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h3 className="font-bold text-lg">
                                  {item.name}
                                </h3>
                                {item.category && (
                                  <Badge variant="outline" className="mt-1">
                                    {item.category}
                                  </Badge>
                                )}
                              </div>
                              <Badge
                                className={
                                  item.available
                                    ? "bg-green-500"
                                    : "bg-slate-500"
                                }
                              >
                                {item.available
                                  ? "Disponible"
                                  : "No disponible"}
                              </Badge>
                            </div>

                            {item.description && (
                              <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                                {item.description}
                              </p>
                            )}

                            <p className="text-2xl font-bold text-red-600 mb-3">
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
              <Card>
                <CardHeader>
                  <CardTitle>Pedidos Recibidos</CardTitle>
                </CardHeader>
                <CardContent>
                  {ordersLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-600">No hay pedidos todavía</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((order) => {
                        const statusConfig = getOrderStatusConfig(order.status);
                        const StatusIcon = statusConfig.icon;
                        const createdAt = order.createdAt?.toDate
                          ? order.createdAt.toDate()
                          : null;

                        return (
                          <Card key={order.id} className="border-2">
                            <CardContent className="p-6">
                              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                                <div>
                                  <h3 className="font-bold text-lg">
                                    {order.customer_name}
                                  </h3>
                                  <p className="text-sm text-slate-600">
                                    {order.customer_phone}
                                  </p>
                                  {createdAt && (
                                    <p className="text-sm text-slate-600 mt-1">
                                      {createdAt.toLocaleString()}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <Badge className={statusConfig.color}>
                                    <StatusIcon className="w-4 h-4 mr-1" />
                                    {statusConfig.label}
                                  </Badge>
                                  <p className="text-2xl font-bold text-slate-900">
                                    ${Number(order.total).toLocaleString()}
                                  </p>
                                </div>
                              </div>

                              <div className="bg-slate-50 rounded-lg p-4 mb-4">
                                <h4 className="font-semibold mb-2">
                                  Items del pedido:
                                </h4>
                                <div className="space-y-1">
                                  {order.items?.map((item, idx) => (
                                    <div
                                      key={idx}
                                      className="flex justify-between text-sm"
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

                              <div className="space-y-2 mb-4">
                                <p className="text-sm">
                                  <strong>Dirección:</strong>{" "}
                                  {order.delivery_address}
                                </p>
                                <p className="text-sm">
                                  <strong>Pago:</strong>{" "}
                                  {order.payment_method === "cash"
                                    ? "Efectivo"
                                    : order.payment_method === "card"
                                    ? "Tarjeta"
                                    : "Transferencia"}
                                </p>
                                {order.notes && (
                                  <p className="text-sm">
                                    <strong>Notas:</strong> {order.notes}
                                  </p>
                                )}
                              </div>

                              {order.status !== "delivered" &&
                                order.status !== "cancelled" && (
                                  <div className="flex flex-wrap gap-2">
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
                                      onClick={() =>
                                        updateOrderStatus(order.id, "cancelled")
                                      }
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
              <Card>
                <CardHeader>
                  <CardTitle>Información del Restaurante</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Nombre</p>
                      <p className="font-semibold">{myRestaurant.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Categoría</p>
                      <p className="font-semibold">{myRestaurant.category}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Teléfono</p>
                      <p className="font-semibold">{myRestaurant.phone}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Dirección</p>
                      <p className="font-semibold">{myRestaurant.address}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 mb-1">
                        Tiempo de entrega
                      </p>
                      <p className="font-semibold">
                        {myRestaurant.delivery_time}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 mb-1">
                        Pedido mínimo
                      </p>
                      <p className="font-semibold">
                        ${Number(myRestaurant.min_order || 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 mb-1">
                        Costo de envío
                      </p>
                      <p className="font-semibold">
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
                  <div>
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
                      <p className="text-slate-800">
                        {myRestaurant.description}
                      </p>
                    </div>
                  )}

                  <Button onClick={handleOpenRestaurantDialog} className="mt-4">
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
                <Label htmlFor="address">Dirección *</Label>
                <Input
                  id="address"
                  value={restaurantForm.address}
                  onChange={(e) =>
                    setRestaurantForm((prev) => ({
                      ...prev,
                      address: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

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
                    className="mt-2 w-20 h-20 object-cover rounded-lg"
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
                    className="mt-2 w-full h-20 object-cover rounded-lg"
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
                disabled={savingRestaurant}
              >
                {myRestaurant ? "Actualizar" : "Crear Restaurante"}
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
                  className="mt-2 w-full h-40 object-cover rounded-lg"
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
              <Button onClick={handleSaveMenuItem} disabled={savingMenuItem}>
                {editingMenuItem ? "Actualizar" : "Agregar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
