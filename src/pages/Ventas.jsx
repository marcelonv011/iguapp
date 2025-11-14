// src/pages/Ventas.jsx
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ShoppingBag,
  MapPin,
  DollarSign,
  Search,
  Tag,
} from "lucide-react";

import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";

// Firebase
import { db } from "@/firebase";
import {
  collection,
  getDocs,
  query as fsQuery,
  where,
  orderBy,
} from "firebase/firestore";

// ========= Fetch de ventas desde Firestore =========

async function fetchVentas() {
  const col = collection(db, "publications");

  const normalize = (docSnap) => {
    const r = docSnap.data();

    return {
      id: docSnap.id,
      ...r,
      created_date: r?.created_date?.toDate
        ? r.created_date.toDate()
        : r?.created_date
        ? new Date(r.created_date)
        : new Date(0),
      title: r?.title || "(Sin título)",
      description: r?.description || "",
      location: r?.location || "",
      price: r?.price ?? null,
      images: Array.isArray(r?.images) ? r.images : [],
      category: (r?.category || r?.tipo || "").toString().toLowerCase(),
      status: (r?.status || r?.estado || "").toString().toLowerCase(),
    };
  };

  const isVentaCat = (cat) =>
    ["venta", "ventas", "product", "producto", "productos"].includes(
      String(cat || "").toLowerCase()
    );

  const isActivoStatus = (st) =>
    ["active", "activo", "activa"].includes(String(st || "").toLowerCase());

  const tryQuery = async (q) => {
    const snap = await getDocs(q);
    return snap.docs.map(normalize);
  };

  // 1) Ideal: category = "venta" + status = "active" + orderBy(created_date)
  try {
    const q1 = fsQuery(
      col,
      where("category", "==", "venta"),
      where("status", "==", "active"),
      orderBy("created_date", "desc")
    );
    const r1 = await tryQuery(q1);
    return r1;
  } catch (e) {
    console.warn("[ventas] q1 falló:", e?.code || e);
  }

  // 2) Solo category="venta", filtrando status activo en cliente
  try {
    const q2 = fsQuery(col, where("category", "==", "venta"));
    const r2 = await tryQuery(q2);
    const activos = r2.filter((x) => isActivoStatus(x.status));
    const final = activos.sort((a, b) => b.created_date - a.created_date);
    return final;
  } catch (e) {
    console.warn("[ventas] q2 falló:", e?.code || e);
  }

  // 3) Fallback: traer todo y filtrar por categoría "venta" + status activo
  try {
    const snap = await getDocs(col);
    const all = snap.docs.map(normalize);
    const ventaLike = all.filter((x) => isVentaCat(x.category));
    const activos = ventaLike.filter((x) => isActivoStatus(x.status));
    const final = activos.sort((a, b) => b.created_date - a.created_date);
    return final;
  } catch (e) {
    console.error("[ventas] fallo general:", e?.code || e);
    return [];
  }
}

// ========= Componente principal =========

export default function Ventas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");

  const {
    data: publications = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["ventas"],
    queryFn: fetchVentas,
  });

  // Opciones de ubicación (únicas)
  const locations = useMemo(
    () => [
      ...new Set(
        (publications || [])
          .map((p) => p.location?.trim())
          .filter(Boolean)
      ),
    ],
    [publications]
  );

  // Filtrado en memoria
  const filteredPublications = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return (publications || []).filter((pub) => {
      const title = (pub.title || "").toLowerCase();
      const desc = (pub.description || "").toLowerCase();

      const matchesSearch =
        !q || title.includes(q) || desc.includes(q);

      const matchesLocation =
        locationFilter === "all" || pub.location === locationFilter;

      return matchesSearch && matchesLocation;
    });
  }, [publications, searchTerm, locationFilter]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-slate-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30">
              <ShoppingBag className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
                Ventas
              </h1>
              <p className="text-slate-600">
                Comprá y vendé lo que necesites
              </p>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Buscador */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <Input
                    placeholder="Buscar productos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 shadow-sm"
                  />
                </div>
              </div>

              {/* Filtro ubicación */}
              <Select
                value={locationFilter}
                onValueChange={setLocationFilter}
              >
                <SelectTrigger className="shadow-sm">
                  <MapPin className="w-4 h-4 mr-2 text-slate-500" />
                  <SelectValue placeholder="Ubicación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las ubicaciones</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Meta resultados */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-2">
          <p className="text-slate-600">
            {filteredPublications.length}{" "}
            {filteredPublications.length === 1
              ? "producto encontrado"
              : "productos encontrados"}
          </p>

          {isError && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-red-500">
                No se pudo cargar la lista.
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetch()}
              >
                Reintentar
              </Button>
            </div>
          )}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Card
                key={i}
                className="animate-pulse overflow-hidden border-2 border-slate-100"
              >
                <div className="h-48 bg-slate-200" />
                <CardContent className="p-4">
                  <div className="h-4 bg-slate-200 rounded mb-2" />
                  <div className="h-6 bg-slate-200 rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredPublications.map((product) => (
              <Card
                key={product.id}
                className="hover:shadow-xl transition-all group overflow-hidden border-2 border-slate-100 hover:border-green-200 bg-white"
              >
                {/* Imagen */}
                {product.images && product.images[0] ? (
                  <div className="h-48 overflow-hidden bg-slate-50 flex items-center justify-center">
                    <img
                      src={product.images[0]}
                      alt={product.title}
                      className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300 p-2"
                    />
                  </div>
                ) : (
                  <div className="h-48 bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center">
                    <Tag className="w-16 h-16 text-white opacity-60" />
                  </div>
                )}

                <CardContent className="p-4">
                  <Badge className="mb-2" tone="green">
                    Venta
                  </Badge>

                  <h3 className="font-bold text-slate-900 mb-2 group-hover:text-green-600 transition-colors line-clamp-2">
                    {product.title}
                  </h3>

                  {product.price && (
                    <div className="flex items-center text-xl font-bold text-green-600 mb-2">
                      <DollarSign className="w-5 h-5" />
                      {Number(product.price).toLocaleString("es-AR")}
                    </div>
                  )}

                  {product.location && (
                    <div className="flex items-center text-slate-500 text-xs mb-3">
                      <MapPin className="w-3 h-3 mr-1" />
                      {product.location}
                    </div>
                  )}

                  <Button
                    size="sm"
                    className="w-full bg-green-600 hover:bg-green-700"
                    // Más adelante podés hacer un Link a /ventas/:id o abrir un modal
                  >
                    Ver detalles
                  </Button>
                </CardContent>
              </Card>
            ))}

            {filteredPublications.length === 0 && !isLoading && !isError && (
              <div className="col-span-full text-center py-12">
                <ShoppingBag className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 text-lg">
                  No se encontraron productos
                </p>
                <p className="text-slate-400 text-sm">
                  Probá buscar por otra palabra o cambiar la ubicación.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
