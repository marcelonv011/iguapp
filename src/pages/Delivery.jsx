import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";

// Firebase
import { db } from "@/firebase"; // si tu archivo es otro, ajusta este import
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";

// UI & iconos (esto asume que ya tienes estos componentes como en otros archivos)
import { UtensilsCrossed, Search, Star, Clock, DollarSign, Filter } from "lucide-react";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Badge } from "@/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";

export default function Delivery() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [restaurants, setRestaurants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // ==== Cargar restaurantes desde Firestore ====
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const ref = collection(db, "restaurants"); // cambia el nombre de la colección si usas otro
        const q = query(ref, orderBy("rating", "desc"));
        const snapshot = await getDocs(q);

        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setRestaurants(data);
      } catch (error) {
        console.error("Error al cargar restaurantes:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  // ==== Filtros de búsqueda y categoría ====
  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((restaurant) => {
      const name = (restaurant.name || "").toLowerCase();
      const description = (restaurant.description || "").toLowerCase();
      const search = searchTerm.toLowerCase();

      const matchesSearch =
        name.includes(search) || description.includes(search);

      const matchesCategory =
        categoryFilter === "all" ||
        restaurant.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [restaurants, searchTerm, categoryFilter]);

  const categories = [
    { value: "pizza", label: "Pizza" },
    { value: "hamburguesa", label: "Hamburguesa" },
    { value: "empanadas", label: "Empanadas" },
    { value: "sushi", label: "Sushi" },
    { value: "parrilla", label: "Parrilla" },
    { value: "comida_rapida", label: "Comida Rápida" },
    { value: "saludable", label: "Saludable" },
    { value: "postres", label: "Postres" },
    { value: "otro", label: "Otro" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-slate-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center">
              <UtensilsCrossed className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
                Delivery
              </h1>
              <p className="text-slate-600">
                Pedí comida de tus restaurantes favoritos
              </p>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <Input
                    placeholder="Buscar restaurantes o comida..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select
                value={categoryFilter}
                onValueChange={(value) => setCategoryFilter(value)}
              >
                <SelectTrigger>
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div className="mb-6">
          <p className="text-slate-600">
            {filteredRestaurants.length}{" "}
            {filteredRestaurants.length === 1
              ? "restaurante disponible"
              : "restaurantes disponibles"}
          </p>
        </div>

        {isLoading ? (
          // Skeleton mientras carga
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-48 bg-slate-200" />
                <CardContent className="p-6">
                  <div className="h-6 bg-slate-200 rounded mb-4" />
                  <div className="h-4 bg-slate-200 rounded mb-2" />
                  <div className="h-4 bg-slate-200 rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRestaurants.map((restaurant) => (
              <Link
                key={restaurant.id}
                // Ajustá esta ruta al detalle que vayas a usar para el menú
                to={`/delivery/${restaurant.id}`}
              >
                <Card className="hover:shadow-xl transition-all group overflow-hidden border-2 hover:border-red-200 h-full">
                  {/* Imagen de portada */}
                  <div className="h-40 bg-gradient-to-br from-red-400 to-orange-500 relative overflow-hidden">
                    {restaurant.cover_image ? (
                      <img
                        src={restaurant.cover_image}
                        alt={restaurant.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <UtensilsCrossed className="w-16 h-16 text-white opacity-50" />
                      </div>
                    )}

                    {/* Estado (abierto/cerrado) */}
                    <div className="absolute top-3 right-3">
                      <Badge className={restaurant.is_open ? "bg-green-500" : "bg-red-500"}>
                        {restaurant.is_open ? "Abierto" : "Cerrado"}
                      </Badge>
                    </div>

                    {/* Logo del restaurante */}
                    {restaurant.logo_url && (
                      <div className="absolute bottom-0 left-4 transform translate-y-1/2">
                        <div className="w-16 h-16 rounded-full bg-white p-1 shadow-lg">
                          <img
                            src={restaurant.logo_url}
                            alt={restaurant.name}
                            className="w-full h-full object-cover rounded-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <CardContent className="pt-10 pb-6 px-6">
                    <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-red-600 transition-colors">
                      {restaurant.name}
                    </h3>

                    {restaurant.description && (
                      <p className="text-slate-600 text-sm mb-3 line-clamp-2">
                        {restaurant.description}
                      </p>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center text-slate-600">
                          <Clock className="w-4 h-4 mr-2" />
                          {restaurant.delivery_time || "30-45 min"}
                        </div>
                        <div className="flex items-center text-yellow-500">
                          <Star className="w-4 h-4 mr-1 fill-yellow-500" />
                          {restaurant.rating || 5}
                        </div>
                      </div>

                      {restaurant.min_order && (
                        <div className="flex items-center text-slate-600 text-sm">
                          <DollarSign className="w-4 h-4 mr-1" />
                          Pedido mínimo: $
                          {Number(restaurant.min_order).toLocaleString()}
                        </div>
                      )}

                      {restaurant.delivery_fee !== undefined && (
                        <div className="text-sm">
                          {restaurant.delivery_fee === 0 ? (
                            <span className="text-green-600 font-medium">
                              Envío gratis
                            </span>
                          ) : (
                            <span className="text-slate-600">
                              Envío: ${restaurant.delivery_fee}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}

            {filteredRestaurants.length === 0 && !isLoading && (
              <div className="col-span-full text-center py-12">
                <UtensilsCrossed className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 text-lg">
                  No se encontraron restaurantes
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
