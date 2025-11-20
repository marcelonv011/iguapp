// src/pages/RestaurantMenu.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createPageUrl } from "@/utils";

import {
  ArrowLeft,
  ShoppingCart,
  Plus,
  Minus,
  Star,
  Clock,
  DollarSign,
  MapPin,
  Trash2,
  Phone,
  UtensilsCrossed,
  Crosshair,
} from "lucide-react";

import { Card, CardContent } from "@/ui/card";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Input } from "@/ui/input";
import { Textarea } from "@/ui/textarea";
import { Label } from "@/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/ui/sheet";
import { toast } from "sonner";

// Firebase
import { db, auth } from "@/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  orderBy,
  deleteDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function RestaurantMenu() {
  const navigate = useNavigate();
  const { restaurantId } = useParams();

  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // "superadmin", "admin", "usuario", etc.
  const isSuperAdmin = userRole === "superadmin";

  const [restaurant, setRestaurant] = useState(null);
  const [restaurantLoading, setRestaurantLoading] = useState(true);

  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);

  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNumber, setDeliveryNumber] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("Puerto Iguazú"); // podés cambiar el default
  const [creatingOrder, setCreatingOrder] = useState(false);

  const [currentCoords, setCurrentCoords] = useState(null); // { lat, lng } | null
  const [geoLoading, setGeoLoading] = useState(false);
  // RESEÑAS
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  const [mapLink, setMapLink] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");

  // ==========================
  //  Auth: cargar usuario
  // ==========================
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setUser(fbUser);
        setCustomerName(fbUser.displayName || "");
        setCustomerPhone(fbUser.phoneNumber || "");
        // Cargar rol desde /users/{uid}
        try {
          const userRef = doc(db, "users", fbUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            setUserRole(data.role_type || "usuario");
          } else {
            setUserRole("usuario");
          }
        } catch (e) {
          console.error("Error cargando rol de usuario:", e);
          setUserRole("usuario");
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
    });
    return () => unsub();
  }, []);

  // ==========================
  //  Cargar restaurante
  // ==========================
  useEffect(() => {
    if (!restaurantId) return;

    const loadRestaurant = async () => {
      setRestaurantLoading(true);
      try {
        const ref = doc(db, "restaurants", restaurantId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setRestaurant({ id: snap.id, ...snap.data() });
        } else {
          toast.error("Restaurante no encontrado");
          navigate(createPageUrl("Delivery"));
        }
      } catch (error) {
        console.error("Error cargando restaurante:", error);
        toast.error("Error cargando restaurante");
      } finally {
        setRestaurantLoading(false);
      }
    };

    loadRestaurant();
  }, [restaurantId, navigate]);

  // ==========================
  //  Cargar items del menú
  // ==========================
  useEffect(() => {
    if (!restaurantId) return;

    const loadMenu = async () => {
      setMenuLoading(true);
      try {
        const qRef = query(
          collection(db, "menu_items"),
          where("restaurant_id", "==", restaurantId),
          where("available", "==", true)
        );
        const snap = await getDocs(qRef);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMenuItems(data);
      } catch (error) {
        console.error("Error cargando menú:", error);
        toast.error("Error cargando menú del restaurante");
      } finally {
        setMenuLoading(false);
      }
    };

    loadMenu();
  }, [restaurantId]);

  // ==========================
  //  Cargar reseñas del restaurante
  // ==========================
  useEffect(() => {
    if (!restaurantId) return;

    const loadReviews = async () => {
      setReviewsLoading(true);

      try {
        const qRef = query(
          collection(db, "restaurant_reviews"),
          where("restaurant_id", "==", restaurantId),
          orderBy("createdAt", "desc")
        );

        const snap = await getDocs(qRef);
        setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error cargando reseñas:", err);
      } finally {
        setReviewsLoading(false);
      }
    };

    loadReviews();
  }, [restaurantId]);

  // ==========================
  //  Geolocalización + mapa
  // ==========================

  const fullAddressForMap = (() => {
    const mainLine = [deliveryAddress.trim(), deliveryNumber.trim()]
      .filter(Boolean)
      .join(" ");

    if (!mainLine) return "";

    return `${mainLine}${deliveryCity ? ", " + deliveryCity.trim() : ""}`;
  })();

  useEffect(() => {
    if (currentCoords) {
      const q = `${currentCoords.lat},${currentCoords.lng}`;
      setMapLink(`https://www.google.com/maps?q=${q}`);
    } else if (fullAddressForMap) {
      setMapLink(
        `https://www.google.com/maps?q=${encodeURIComponent(fullAddressForMap)}`
      );
    } else {
      setMapLink("");
    }
  }, [fullAddressForMap, currentCoords]);

  const mapEmbedUrl = currentCoords
    ? `https://www.google.com/maps?q=${currentCoords.lat},${currentCoords.lng}&z=16&output=embed`
    : fullAddressForMap
    ? `https://www.google.com/maps?q=${encodeURIComponent(
        fullAddressForMap
      )}&z=16&output=embed`
    : "";

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización");
      return;
    }

    setGeoLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          setCurrentCoords({ lat: latitude, lng: longitude });

          // Llamamos a Nominatim (OpenStreetMap) para obtener la dirección
          const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=es`;

          const res = await fetch(url, {
            headers: {
              Accept: "application/json",
            },
          });

          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};

            const road = addr.road || addr.pedestrian || addr.footway || "";
            const houseNumber = addr.house_number || "";
            const neighbourhood = addr.neighbourhood || addr.suburb || "";

            const streetPart = [road, houseNumber].filter(Boolean).join(" ");
            const areaPart = neighbourhood;
            const fullAddress = [streetPart, areaPart]
              .filter(Boolean)
              .join(", ");

            // Ciudad: probamos en este orden
            const cityCandidate =
              addr.city ||
              addr.town ||
              addr.village ||
              addr.municipality ||
              addr.state ||
              "";

            if (fullAddress) {
              setDeliveryAddress(fullAddress);
            }
            if (houseNumber) {
              setDeliveryNumber(houseNumber); // 👈 rellenamos el número
            }

            if (cityCandidate) {
              setDeliveryCity(cityCandidate);
            } else if (!deliveryCity) {
              // fallback si no viene nada y el input estaba vacío
              setDeliveryCity("Puerto Iguazú");
            }

            toast.success("Ubicación actual obtenida y dirección completada");
          } else {
            // Si falla el reverse, al menos dejamos el mapa funcionando
            if (!deliveryCity) {
              setDeliveryCity("Puerto Iguazú");
            }
            toast.success("Ubicación actual obtenida");
          }
        } catch (error) {
          console.error("Error obteniendo dirección:", error);
          if (!deliveryCity) {
            setDeliveryCity("Puerto Iguazú");
          }
          toast.success("Ubicación actual obtenida");
        } finally {
          setGeoLoading(false);
        }
      },
      (err) => {
        console.error(err);
        toast.error("No se pudo obtener tu ubicación");
        setGeoLoading(false);
      }
    );
  };

  // ==========================
  //  Carrito
  // ==========================
  const addToCart = (item) => {
    const existing = cart.find((i) => i.id === item.id);
    if (existing) {
      setCart(
        cart.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      );
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
    toast.success(`${item.name} agregado al carrito`);
  };

  const updateQuantity = (itemId, change) => {
    setCart(
      cart
        .map((item) => {
          if (item.id === itemId) {
            const newQuantity = item.quantity + change;
            return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter((item) => item.id !== itemId));
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const getTotalWithDelivery = () => {
    return getCartTotal() + (restaurant?.delivery_fee || 0);
  };

  const totalItemsCart = cart.reduce((sum, item) => sum + item.quantity, 0);

  // ==========================
  //  Checkout / crear pedido
  // ==========================
  const handleCheckout = async () => {
    if (!user) {
      toast.error("Debés iniciar sesión para hacer un pedido");
      navigate(createPageUrl("Login"));
      return;
    }

    if (!restaurant) {
      toast.error("Restaurante no disponible");
      return;
    }

    if (!restaurant.is_open) {
      toast.error("Este restaurante está cerrado en este momento");
      return;
    }

    if (cart.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }

    if (
      !customerName ||
      !customerPhone ||
      !deliveryAddress ||
      !deliveryNumber ||
      !deliveryCity
    ) {
      toast.error(
        "Por favor completá nombre, teléfono, dirección, número y ciudad"
      );
      return;
    }

    const subtotal = getCartTotal();
    const minOrder = Number(restaurant.min_order || 0);
    if (minOrder > 0 && subtotal < minOrder) {
      toast.error(
        `El pedido mínimo es de $${minOrder.toLocaleString()} (tu subtotal es $${subtotal.toLocaleString()})`
      );
      return;
    }

    const orderData = {
      restaurant_id: restaurant.id,
      restaurant_name: restaurant.name || "",
      customer_uid: user.uid,
      customer_name: customerName,
      customer_phone: customerPhone,
      delivery_address: deliveryAddress,
      delivery_number: deliveryNumber,
      delivery_city: deliveryCity,
      map_link: mapLink || null,
      items: cart.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
      total: getTotalWithDelivery(),
      delivery_fee: restaurant.delivery_fee || 0,
      payment_method: paymentMethod,
      notes: notes,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      setCreatingOrder(true);
      await addDoc(collection(db, "orders"), orderData);
      setCart([]);
      setCartOpen(false);
      toast.success(
        "¡Pedido realizado con éxito! El restaurante fue notificado."
      );

      // 👇 Ir directo a MisPedidos
      navigate("/mis-pedidos");
    } catch (error) {
      console.error("Error creando pedido:", error);
      toast.error("No se pudo crear el pedido. Intentá nuevamente.");
    } finally {
      setCreatingOrder(false);
    }
  };

  // ==========================
  //  Loading estados
  // ==========================
  if (restaurantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4" />
          <p className="text-slate-600 text-sm">Cargando restaurante...</p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
        <p className="text-slate-700 text-lg font-medium">
          Restaurante no encontrado.
        </p>
        <Button onClick={() => navigate(createPageUrl("Delivery"))}>
          Volver al listado
        </Button>
      </div>
    );
  }

  // Agrupar items por categoría
  const itemsByCategory = menuItems.reduce((acc, item) => {
    const category = item.category || "Otros";
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

  const categories = Object.keys(itemsByCategory);

  const scrollToCategory = (cat) => {
    const el = document.getElementById(`cat-${cat}`);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 160;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  const handleDeleteReview = async (reviewId) => {
    if (!user || !isSuperAdmin) return;

    const confirmed = window.confirm(
      "¿Seguro que querés eliminar esta reseña?"
    );
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "restaurant_reviews", reviewId));

      // Actualizamos estado local
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));

      toast.success("Reseña eliminada");
    } catch (error) {
      console.error("Error eliminando reseña:", error);
      toast.error("No se pudo eliminar la reseña");
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-50 via-slate-100 to-slate-50">
      {/* Header restaurante */}
      <div className="relative bg-gradient-to-r from-red-500 via-red-600 to-orange-500 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25),_transparent_55%)] opacity-70" />
        <div className="absolute inset-0 bg-black/10" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl("Delivery"))}
            className="text-white hover:bg-white/15 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>

          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            {/* Logo */}
            {restaurant.logo_url ? (
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl bg-white/90 p-2 shadow-2xl flex-shrink-0">
                <img
                  src={restaurant.logo_url}
                  alt={restaurant.name}
                  className="w-full h-full object-cover rounded-xl"
                />
              </div>
            ) : (
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl bg-white/20 flex items-center justify-center shadow-xl flex-shrink-0">
                <UtensilsCrossed className="w-10 h-10 text-white/80" />
              </div>
            )}

            {/* Info principal */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight drop-shadow-sm">
                  {restaurant.name}
                </h1>
                <Badge
                  className={`px-3 py-1 text-xs rounded-full border-0 shadow-sm ${
                    restaurant.is_open ? "bg-emerald-500" : "bg-red-500"
                  }`}
                >
                  {restaurant.is_open ? "Abierto ahora" : "Cerrado"}
                </Badge>
                {restaurant.category && (
                  <Badge className="bg-black/20 border border-white/20 text-xs rounded-full px-3 py-1">
                    {restaurant.category}
                  </Badge>
                )}
              </div>

              {restaurant.description && (
                <p className="text-white/95 text-sm md:text-base mb-4 max-w-2xl">
                  {restaurant.description}
                </p>
              )}

              {/* Datos rápidos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
                <div className="flex items-center gap-2 bg-black/15 rounded-xl px-3 py-2 backdrop-blur-sm">
                  <Clock className="w-4 h-4" />
                  <div>
                    <p className="font-semibold leading-tight">
                      Entrega estimada
                    </p>
                    <p className="text-white/80">
                      {restaurant.delivery_time || "30-45 min"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-black/15 rounded-xl px-3 py-2 backdrop-blur-sm">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <div>
                    <p className="font-semibold leading-tight">Valoración</p>
                    <p className="text-white/80">
                      {restaurant.rating
                        ? `${restaurant.rating.toFixed(1)} / 5`
                        : "Nuevo"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-black/15 rounded-xl px-3 py-2 backdrop-blur-sm">
                  <DollarSign className="w-4 h-4" />
                  <div>
                    <p className="font-semibold leading-tight">Pedido mínimo</p>
                    <p className="text-white/80">
                      ${Number(restaurant.min_order || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {restaurant.address && (
                <div className="flex flex-wrap items-center gap-3 mt-4 text-xs sm:text-sm text-white/90">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    <span>
                      {restaurant.address}
                      {restaurant.address_number &&
                        ` ${restaurant.address_number}`}
                      {restaurant.city && `, ${restaurant.city}`}
                    </span>
                  </div>
                  {restaurant.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-4 h-4" />
                      <span>{restaurant.phone}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 -mt-4 relative">
        {/* Tarjeta contenedora */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-100/80 px-4 sm:px-6 lg:px-8 pt-6 pb-8">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Menú de {restaurant.name}
              </h2>
              <p className="text-sm text-slate-500">
                Elegí tus platos favoritos y agregalos al carrito
              </p>
            </div>

            {/* Carrito (Sheet) */}
            <Sheet open={cartOpen} onOpenChange={setCartOpen}>
              <SheetTrigger asChild>
                <Button className="relative bg-red-600 hover:bg-red-700 rounded-full px-5 shadow-md">
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Ver carrito
                  {cart.length > 0 && (
                    <Badge className="absolute -top-2 -right-2 bg-orange-500 text-xs rounded-full px-2 py-0.5">
                      {totalItemsCart}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>

              <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Tu pedido en {restaurant.name}</SheetTitle>
                </SheetHeader>

                {cart.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600">Tu carrito está vacío</p>
                    <p className="text-xs text-slate-400">
                      Agregá productos desde el menú
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6 mt-6 pb-6">
                    {/* Items del carrito */}
                    <div className="space-y-3">
                      {cart.map((item) => (
                        <Card key={item.id} className="border-slate-200">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              {item.image_url && (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="w-16 h-16 object-cover rounded-lg"
                                />
                              )}
                              <div className="flex-1">
                                <h4 className="font-semibold text-slate-900">
                                  {item.name}
                                </h4>
                                <p className="text-sm text-slate-600">
                                  ${item.price.toLocaleString()}
                                </p>

                                <div className="flex items-center gap-3 mt-2">
                                  <div className="flex items-center gap-2 bg-slate-100 rounded-full px-1.5">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={() =>
                                        updateQuantity(item.id, -1)
                                      }
                                    >
                                      <Minus className="w-4 h-4" />
                                    </Button>
                                    <span className="font-semibold w-8 text-center text-sm">
                                      {item.quantity}
                                    </span>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={() => updateQuantity(item.id, 1)}
                                    >
                                      <Plus className="w-4 h-4" />
                                    </Button>
                                  </div>

                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-red-600 hover:bg-red-50"
                                    onClick={() => removeFromCart(item.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              <div className="font-semibold text-sm">
                                ${(item.price * item.quantity).toLocaleString()}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Datos de entrega */}
                    <Card className="border-slate-200">
                      <CardContent className="p-4 space-y-4">
                        <h3 className="font-semibold text-slate-900">
                          Datos de entrega
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label
                              htmlFor="name"
                              className="text-xs text-slate-600"
                            >
                              Nombre completo
                            </Label>
                            <Input
                              id="name"
                              value={customerName}
                              onChange={(e) => setCustomerName(e.target.value)}
                              placeholder="Tu nombre"
                              className="mt-1"
                            />
                          </div>

                          <div>
                            <Label
                              htmlFor="phone"
                              className="text-xs text-slate-600"
                            >
                              Teléfono
                            </Label>
                            <Input
                              id="phone"
                              value={customerPhone}
                              onChange={(e) => setCustomerPhone(e.target.value)}
                              placeholder="Tu teléfono"
                              className="mt-1"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div className="sm:col-span-3">
                            <Label
                              htmlFor="address"
                              className="text-xs text-slate-600"
                            >
                              Dirección de entrega
                            </Label>
                            <Textarea
                              id="address"
                              value={deliveryAddress}
                              onChange={(e) => {
                                setDeliveryAddress(e.target.value);
                                if (currentCoords) setCurrentCoords(null);
                              }}
                              placeholder="Ej: Av. Misiones"
                              rows={2}
                              className="mt-1"
                            />
                          </div>

                          <div>
                            <Label
                              htmlFor="number"
                              className="text-xs text-slate-600"
                            >
                              Número
                            </Label>
                            <Input
                              id="number"
                              value={deliveryNumber}
                              onChange={(e) =>
                                setDeliveryNumber(e.target.value)
                              }
                              placeholder="Ej: 234"
                              className="mt-1"
                            />
                          </div>
                        </div>

                        {/* Ciudad como input libre */}
                        <div>
                          <Label
                            htmlFor="city"
                            className="text-xs text-slate-600"
                          >
                            Ciudad
                          </Label>
                          <Input
                            id="city"
                            value={deliveryCity}
                            onChange={(e) => setDeliveryCity(e.target.value)}
                            placeholder="Ej: Puerto Iguazú"
                            className="mt-1"
                          />
                          <p className="text-[11px] text-slate-400 mt-1">
                            Podés escribir la ciudad. Si usás tu ubicación
                            actual, se completa automáticamente.
                          </p>
                        </div>

                        {/* Bloque de mapa + ubicación actual */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-slate-600">
                              Mapa de la ubicación
                            </Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              onClick={handleUseCurrentLocation}
                              disabled={geoLoading}
                            >
                              {geoLoading ? (
                                "Obteniendo..."
                              ) : (
                                <>
                                  <Crosshair className="w-3 h-3 mr-1" />
                                  Usar mi ubicación actual
                                </>
                              )}
                            </Button>
                          </div>

                          <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50 h-48">
                            {mapEmbedUrl ? (
                              <iframe
                                title="Mapa de entrega"
                                src={mapEmbedUrl}
                                className="w-full h-full border-0"
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 px-4 text-center">
                                Escribí una dirección y ciudad o usá tu
                                ubicación actual para ver el mapa.
                              </div>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-400">
                            El mapa se genera automáticamente según la dirección
                            + ciudad o tu ubicación actual. El link se enviará
                            al restaurante junto con tu pedido.
                          </p>
                        </div>

                        <div>
                          <Label
                            htmlFor="payment"
                            className="text-xs text-slate-600"
                          >
                            Método de pago
                          </Label>
                          <select
                            className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                          >
                            <option value="cash">Efectivo</option>
                            <option value="card">Tarjeta</option>
                            <option value="transfer">Transferencia</option>
                          </select>
                        </div>

                        <div>
                          <Label
                            htmlFor="notes"
                            className="text-xs text-slate-600"
                          >
                            Notas adicionales (opcional)
                          </Label>
                          <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Ej: sin cebolla, extra salsa..."
                            rows={2}
                            className="mt-1"
                          />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Resumen total */}
                    <Card className="border-slate-200">
                      <CardContent className="p-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Subtotal</span>
                          <span className="font-medium">
                            ${getCartTotal().toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Envío</span>
                          <span className="font-medium">
                            $
                            {Number(
                              restaurant?.delivery_fee || 0
                            ).toLocaleString()}
                          </span>
                        </div>
                        <div className="border-t pt-2 mt-1 flex justify-between font-bold text-base">
                          <span>Total</span>
                          <span className="text-red-600">
                            ${getTotalWithDelivery().toLocaleString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Button
                      className="w-full bg-red-600 hover:bg-red-700"
                      size="lg"
                      onClick={handleCheckout}
                      disabled={creatingOrder}
                    >
                      {creatingOrder ? "Procesando..." : "Confirmar pedido"}
                    </Button>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </div>

          {/* Chips de categorías */}
          {categories.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  Categorías
                </p>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() =>
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }
                  className="text-xs px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 whitespace-nowrap transition"
                >
                  Todo
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => scrollToCategory(cat)}
                    className="text-xs px-3 py-1.5 rounded-full border border-red-100 bg-red-50 text-red-700 hover:bg-red-100 whitespace-nowrap transition"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Menú */}
          {menuLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mx-auto mb-4" />
              <p className="text-slate-600 text-sm">Cargando menú...</p>
            </div>
          ) : Object.keys(itemsByCategory).length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600 text-lg">
                No hay items en el menú todavía
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Volvé más tarde, el restaurante está cargando su carta
              </p>
            </div>
          ) : (
            <div className="space-y-10 mt-4">
              {Object.entries(itemsByCategory).map(([category, items]) => (
                <div key={category} id={`cat-${category}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">
                        {category}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {items.length}{" "}
                        {items.length === 1
                          ? "opción disponible"
                          : "opciones disponibles"}
                      </p>
                    </div>
                    <div className="h-px flex-1 ml-6 bg-gradient-to-r from-red-200 via-slate-200 to-transparent" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map((item) => (
                      <Card
                        key={item.id}
                        className="hover:shadow-xl transition-all group border-slate-200 overflow-hidden flex flex-col"
                      >
                        {item.image_url && (
                          <div className="h-44 overflow-hidden bg-slate-100">
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            />
                          </div>
                        )}
                        <CardContent className="p-5 flex flex-col flex-1">
                          <h4 className="font-semibold text-lg text-slate-900 mb-1.5">
                            {item.name}
                          </h4>
                          {item.description && (
                            <p className="text-slate-600 text-sm mb-3 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                          <div className="mt-auto flex items-center justify-between pt-2">
                            <span className="text-2xl font-bold text-red-600">
                              ${Number(item.price).toLocaleString()}
                            </span>
                            <Button
                              onClick={() => addToCart(item)}
                              className="bg-red-600 hover:bg-red-700 rounded-full px-4"
                              size="sm"
                            >
                              <Plus className="w-4 h-4 mr-1.5" />
                              Agregar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ==========================
   RESEÑAS DEL RESTAURANTE (solo mostrar)
========================== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <h2 className="text-2xl font-bold mb-4">Reseñas</h2>

        {reviewsLoading ? (
          <p className="text-slate-500 text-sm">Cargando reseñas...</p>
        ) : reviews.length === 0 ? (
          <p className="text-slate-500 text-sm">
            Este restaurante aún no tiene reseñas.
          </p>
        ) : (
          <div className="space-y-4">
  {reviews.map((r) => (
    <Card key={r.id} className="bg-slate-50 border">
      <CardContent className="p-4">
        <div className="flex justify-between items-start gap-2">
          {/* Nombre + estrellas */}
          <div>
            <p className="font-semibold">{r.user_name}</p>
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`w-4 h-4 ${
                    r.rating >= n
                      ? "text-yellow-400 fill-yellow-400"
                      : "text-slate-300"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Botón eliminar solo para superadmin */}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => handleDeleteReview(r.id)}
              className="text-xs text-red-600 hover:text-red-700 hover:underline"
            >
              Eliminar
            </button>
          )}
        </div>

        {r.comment && <p className="text-sm mt-2">{r.comment}</p>}

        {r.createdAt?.toDate && (
          <p className="text-xs text-slate-400 mt-1">
            {r.createdAt.toDate().toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  ))}
</div>

        )}
      </div>

      {/* Botón flotante de carrito en mobile */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-0 right-0 px-4 sm:hidden z-40">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="w-full max-w-md mx-auto flex items-center justify-between rounded-full bg-red-600 text-white px-4 py-3 shadow-xl"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              <span className="text-sm font-medium">
                Ver carrito ({totalItemsCart})
              </span>
            </div>
            <span className="text-sm font-semibold">
              ${getTotalWithDelivery().toLocaleString()}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
