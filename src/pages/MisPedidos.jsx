import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

// Firebase
import { auth, db } from "@/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query as fsQuery,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  addDoc,
  runTransaction,
} from "firebase/firestore";

// UI
import {
  Package,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  AlertCircle,
  Star,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { toast } from "sonner";

export default function MisPedidos() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState(""); // YYYY-MM-DD
  const [reviewingOrderId, setReviewingOrderId] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const navigate = useNavigate();

  // Escuchar cambios de autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        navigate("/login");
      } else {
        setUser(currentUser);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Cargar pedidos del usuario logueado
  useEffect(() => {
    if (!user) return;

    setIsLoading(true);

    const ordersRef = collection(db, "orders");
    const q = fsQuery(
      ordersRef,
      where("customer_uid", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setOrders(data);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error al cargar pedidos:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const getStatusConfig = (status) => {
    const configs = {
      pending: {
        label: "Pendiente",
        icon: AlertCircle,
        color: "bg-yellow-100 text-yellow-700 border-yellow-300",
        iconColor: "text-yellow-600",
      },
      preparing: {
        label: "Preparando",
        icon: Clock,
        color: "bg-blue-100 text-blue-700 border-blue-300",
        iconColor: "text-blue-600",
      },
      on_the_way: {
        label: "En camino",
        icon: Truck,
        color: "bg-purple-100 text-purple-700 border-purple-300",
        iconColor: "text-purple-600",
      },
      delivered: {
        label: "Entregado",
        icon: CheckCircle,
        color: "bg-green-100 text-green-700 border-green-300",
        iconColor: "text-green-600",
      },
      cancelled: {
        label: "Cancelado",
        icon: XCircle,
        color: "bg-red-100 text-red-700 border-red-300",
        iconColor: "text-red-600",
      },
    };
    return configs[status] || configs.pending;
  };

  const formatDateTime = (dateValue) => {
    if (!dateValue) return { date: "-", time: "-" };

    let date;
    if (dateValue.toDate) {
      // Firestore Timestamp
      date = dateValue.toDate();
    } else {
      date = new Date(dateValue);
    }

    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
  };

  const getOrderNumber = (order) => {
    if (order.order_number) return order.order_number;
    if (order.short_code) return order.short_code;
    return (order.id || "").slice(-6).toUpperCase();
  };

  // === Acción: marcar como recibido ===
  const handleMarkReceived = async (orderId) => {
    try {
      const ref = doc(db, "orders", orderId);
      await updateDoc(ref, {
        customer_confirmed: true,
        updatedAt: serverTimestamp(),
      });

      toast.success("¡Gracias por confirmar tu pedido! 😊");

      // 👇 Abrimos directamente el formulario de reseña para este pedido
      setReviewingOrderId(orderId);
      setReviewRating(5);
      setReviewComment("");
    } catch (error) {
      console.error("Error al marcar como recibido:", error);
      toast.error("No se pudo marcar como recibido. Intentá de nuevo.");
    }
  };

  const handleSubmitReview = async (order) => {
  if (!user) {
    toast.error("Debés iniciar sesión para dejar una reseña");
    return;
  }
  if (!reviewRating || reviewRating < 1 || reviewRating > 5) {
    toast.error("Elegí una puntuación de 1 a 5 estrellas");
    return;
  }

  const restaurantId = order.restaurant_id;
  const restaurantRef = doc(db, "restaurants", restaurantId);

  try {
    setSubmittingReview(true);

    // 1) Crear reseña en restaurant_reviews
    await addDoc(collection(db, "restaurant_reviews"), {
      restaurant_id: restaurantId,
      restaurant_name: order.restaurant_name || "",
      order_id: order.id,
      user_uid: user.uid,
      user_email: user.email || null,
      user_name: user.displayName || order.customer_name || "",
      rating: reviewRating,
      comment: reviewComment.trim(),
      created_at: serverTimestamp(),
    });

    // 2) Actualizar rating acumulado del restaurante
    await runTransaction(db, async (tx) => {
      const restSnap = await tx.get(restaurantRef);
      if (!restSnap.exists()) {
        throw new Error("Restaurante no encontrado");
      }

      const data = restSnap.data();
      let count = data.rating_count || 0;
      let sum = data.rating_sum || 0;

      count += 1;
      sum += reviewRating;

      const avg = count > 0 ? sum / count : 0;

      tx.update(restaurantRef, {
        rating_count: count,
        rating_sum: sum,
        rating: avg,
      });
    });

    // 3) Marcar el pedido como reseñado
    await updateDoc(doc(db, "orders", order.id), {
      review_submitted: true,
      updatedAt: serverTimestamp(),
    });

    toast.success("¡Gracias por tu reseña!");

    // Resetear estado del formulario
    setReviewingOrderId(null);
    setReviewRating(5);
    setReviewComment("");
  } catch (err) {
    console.error("Error al guardar reseña:", err);
    toast.error("No se pudo guardar la reseña. Intentá de nuevo.");
  } finally {
    setSubmittingReview(false);
  }
};


  // === 1) Filtrar por fecha solamente (para usar en contadores + lista) ===
  const dateFilteredOrders = useMemo(() => {
    if (!dateFilter) return orders;

    return orders.filter((order) => {
      const created = order.createdAt || order.created_date;
      if (!created) return false;

      let createdDate;
      if (created.toDate) {
        createdDate = created.toDate();
      } else {
        createdDate = new Date(created);
      }

      const selected = new Date(dateFilter + "T00:00:00");

      const sameDay =
        createdDate.getFullYear() === selected.getFullYear() &&
        createdDate.getMonth() === selected.getMonth() &&
        createdDate.getDate() === selected.getDate();

      return sameDay;
    });
  }, [orders, dateFilter]);

  // === 2) Contadores por estado (respetan solo filtro de fecha) ===
  const statusCounts = useMemo(() => {
    const base = {
      all: 0,
      pending: 0,
      preparing: 0,
      on_the_way: 0,
      delivered: 0,
      cancelled: 0,
    };

    for (const order of dateFilteredOrders) {
      base.all += 1;
      const st = order.status;
      if (st && base.hasOwnProperty(st)) {
        base[st] += 1;
      }
    }

    return base;
  }, [dateFilteredOrders]);

  // === 3) Filtro final (fecha + estado) ===
  const filteredOrders = useMemo(() => {
    if (statusFilter === "all") return dateFilteredOrders;
    return dateFilteredOrders.filter((order) => order.status === statusFilter);
  }, [dateFilteredOrders, statusFilter]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando...</p>
        </div>
      </div>
    );
  }

  const statusFilters = [
    { key: "all", label: "Todos" },
    { key: "pending", label: "Pendiente" },
    { key: "preparing", label: "Preparando" },
    { key: "on_the_way", label: "En camino" },
    { key: "delivered", label: "Entregado" },
    { key: "cancelled", label: "Cancelado" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
                Mis Pedidos
              </h1>
              <p className="text-slate-600">
                Seguí el estado de tus pedidos y filtrá por día o estado
              </p>
              {/* mini resumen opcional */}
              <p className="text-xs text-slate-500 mt-1">
                {statusCounts.all} pedidos
                {dateFilter && ` en ${dateFilter}`}
              </p>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Filtro de estado con contador */}
            <div className="flex flex-wrap gap-2">
              {statusFilters.map((f) => {
                const count = statusCounts[f.key] ?? 0;
                const label = count > 0 ? `${f.label} (${count})` : f.label;

                return (
                  <Button
                    key={f.key}
                    type="button"
                    size="sm"
                    variant={statusFilter === f.key ? "default" : "outline"}
                    className={`rounded-full text-xs ${
                      statusFilter === f.key
                        ? "bg-slate-900 text-white"
                        : "bg-white"
                    }`}
                    onClick={() => setStatusFilter(f.key)}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>

            {/* Filtro por día */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">Filtrar por día:</label>
              <input
                type="date"
                className="border border-slate-200 rounded-lg px-2 py-1 text-sm bg-white"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
              {dateFilter && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-slate-500"
                  onClick={() => setDateFilter("")}
                >
                  ✕
                </Button>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-6 bg-slate-200 rounded mb-4"></div>
                  <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                No hay pedidos con los filtros actuales
              </h3>
              <p className="text-slate-600">
                Probá cambiar el estado o el día seleccionado.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {filteredOrders.map((order) => {
              const statusConfig = getStatusConfig(order.status);
              const StatusIcon = statusConfig.icon;
              const { date, time } = formatDateTime(
                order.createdAt || order.created_date
              );

              const deliveryFee = order.delivery_fee || 0;
              const total = order.total || 0;
              const subtotal = total - deliveryFee;
              const orderNumber = getOrderNumber(order);

              const isDelivered = order.status === "delivered";
              const isConfirmed = !!order.customer_confirmed;

              return (
                <Card key={order.id} className="hover:shadow-lg transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                          {order.restaurant_name || "Pedido"}
                          <span className="text-xs font-medium text-slate-400">
                            #{orderNumber}
                          </span>
                        </CardTitle>
                        <p className="text-sm text-slate-500 mt-1">
                          Pedido el {date} a las {time}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge
                          className={`${statusConfig.color} border flex items-center gap-2`}
                        >
                          <StatusIcon
                            className={`w-4 h-4 ${statusConfig.iconColor}`}
                          />
                          {statusConfig.label}
                        </Badge>

                        {isDelivered && isConfirmed && (
                          <span className="text-xs text-emerald-600 font-medium">
                            Recibido por vos
                          </span>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Items */}
                    {order.items && order.items.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-slate-900 mb-2">
                          Productos
                        </h4>
                        <div className="space-y-2">
                          {order.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex justify-between items-center text-sm bg-slate-50 p-3 rounded-lg"
                            >
                              <div>
                                <span className="font-medium">
                                  {item.name || "Producto"}
                                </span>
                                <span className="text-slate-500">
                                  {" "}
                                  x{item.quantity || 1}
                                </span>
                              </div>
                              <span className="font-semibold">
                                $
                                {(
                                  (item.price || 0) * (item.quantity || 1)
                                ).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Delivery Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          Dirección de entrega
                        </p>
                        <p className="text-sm text-slate-600">
                          {order.delivery_address || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          Método de pago
                        </p>
                        <p className="text-sm text-slate-600">
                          {order.payment_method === "cash"
                            ? "Efectivo"
                            : order.payment_method === "card"
                            ? "Tarjeta"
                            : order.payment_method === "transfer"
                            ? "Transferencia"
                            : "No especificado"}
                        </p>
                      </div>
                    </div>

                    {/* Notas */}
                    {order.notes && (
                      <div className="pt-4 border-t">
                        <p className="text-sm font-semibold text-slate-700">
                          Notas
                        </p>
                        <p className="text-sm text-slate-600">{order.notes}</p>
                      </div>
                    )}

                    {/* Motivo de cancelación */}
                    {order.status === "cancelled" && order.cancel_reason && (
                      <div className="pt-4 border-t">
                        <p className="text-sm font-semibold text-red-600">
                          Motivo de cancelación
                        </p>
                        <p className="text-sm text-red-500">
                          {order.cancel_reason}
                        </p>
                      </div>
                    )}

                    {/* Total */}
                    <div className="pt-4 border-t">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm text-slate-600">
                            Subtotal: ${subtotal.toLocaleString()}
                          </p>
                          <p className="text-sm text-slate-600">
                            Envío: ${deliveryFee.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-slate-600">Total</p>
                          <p className="text-2xl font-bold text-slate-900">
                            ${total.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Reseña (solo si entregado, confirmado y aún sin reseña) */}
                    {isDelivered && isConfirmed && !order.review_submitted && (
                      <div className="pt-4 border-t">
                        {reviewingOrderId !== order.id ? (
                          // Botón inicial "Dejar reseña"
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-slate-300 text-slate-700 hover:bg-slate-50"
                              onClick={() => {
                                setReviewingOrderId(order.id);
                                setReviewRating(5);
                                setReviewComment("");
                              }}
                            >
                              Dejar reseña
                            </Button>
                          </div>
                        ) : (
                          // Formulario de reseña
                          <div className="space-y-3">
                            <p className="text-sm font-semibold text-slate-700">
                              ¿Qué te pareció {order.restaurant_name}?
                            </p>

                            {/* Estrellas */}
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => setReviewRating(star)}
                                  className="p-1"
                                >
                                  <Star
                                    className={`w-5 h-5 ${
                                      star <= reviewRating
                                        ? "fill-yellow-400 text-yellow-400"
                                        : "text-slate-300"
                                    }`}
                                  />
                                </button>
                              ))}
                            </div>

                            {/* Comentario */}
                            <textarea
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                              rows={3}
                              placeholder="Contá brevemente tu experiencia (opcional)"
                              value={reviewComment}
                              onChange={(e) => setReviewComment(e.target.value)}
                            />

                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setReviewingOrderId(null);
                                  setReviewComment("");
                                }}
                                disabled={submittingReview}
                              >
                                Cancelar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className="bg-slate-900 text-white hover:bg-slate-800"
                                onClick={() => handleSubmitReview(order)}
                                disabled={submittingReview}
                              >
                                {submittingReview
                                  ? "Enviando..."
                                  : "Enviar reseña"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Acción: marcar como recibido */}
                    {isDelivered && !isConfirmed && (
                      <div className="pt-3 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => handleMarkReceived(order.id)}
                        >
                          Marcar como recibido
                        </Button>
                      </div>
                    )}

                    {isDelivered && isConfirmed && (
                      <div className="pt-3 flex justify-end">
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                          ✅ Pedido recibido
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
