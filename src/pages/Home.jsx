// src/pages/Home.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl, asARS } from "@/utils";
import { useQuery } from "@tanstack/react-query";
import {
  fetchFeaturedPublications,
  fetchFeaturedRestaurants,
} from "@/api/firestoreFetchers";
import { useAuthUser } from "@/hooks/useAuthUser";

import {
  Briefcase,
  Building2,
  ShoppingBag,
  Store,
  UtensilsCrossed,
  ArrowRight,
  TrendingUp,
  Star,
  MapPin,
  Clock,
} from "lucide-react";

import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Badge } from "@/ui/badge";

export default function Home() {
  const { user, loadingUser } = useAuthUser();

  // Publicaciones destacadas
  const { data: publications = [], isLoading: loadingPubs } = useQuery({
    queryKey: ["featured-publications"],
    queryFn: fetchFeaturedPublications,
  });

  const mainPub = publications[0] || null;
  const otherPubs = publications.slice(1);

  // Restaurantes destacados
  const { data: restaurants = [], isLoading: loadingRests } = useQuery({
    queryKey: ["featured-restaurants"],
    queryFn: fetchFeaturedRestaurants,
  });

  const categories = [
    {
      name: "Empleos",
      icon: Briefcase,
      description: "Encontrá tu próximo trabajo",
      color: "from-blue-500 to-blue-600",
      href: createPageUrl("Empleos"),
    },
    {
      name: "Alquileres",
      icon: Building2,
      description: "Casas, deptos y más",
      color: "from-purple-500 to-purple-600",
      href: createPageUrl("Alquileres"),
    },
    {
      name: "Ventas",
      icon: ShoppingBag,
      description: "Comprá y vendé",
      color: "from-green-500 to-green-600",
      href: createPageUrl("Ventas"),
    },
    {
      name: "Emprendimientos",
      icon: Store,
      description: "Descubrí negocios locales",
      color: "from-orange-500 to-orange-600",
      href: createPageUrl("Emprendimientos"),
    },
    {
      name: "Delivery",
      icon: UtensilsCrossed,
      description: "Pedí comida a domicilio",
      color: "from-red-500 to-red-600",
      href: createPageUrl("Delivery"),
    },
  ];

  const navigate = useNavigate();
  const goToLogin = () => navigate("/login");

  return (
    <div className="min-h-screen">
      {/* ===== Hero Section ===== */}
      <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-purple-800 text-white py-20 overflow-hidden">
        {/* blobs decorativos */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-300 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <Badge className="mb-4 bg-white/20 text-white border-white/30">
              <TrendingUp className="w-3 h-3 mr-1" />
              Tu ciudad conectada
            </Badge>

            <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight tracking-tight">
              Todo lo que necesitás
              <br />
              <span className="gradient-title">en un solo lugar</span>
            </h1>

            <p className="text-xl md:text-2xl text-blue-100 mb-8">
              Empleos, alquileres, ventas, emprendimientos y delivery
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                variant="white"
                className="shadow-xl hover:shadow-2xl"
                onClick={() =>
                  document
                    .getElementById("cats")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Explorar Categorías
              </Button>

              {!loadingUser && !user && (
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white text-white hover:bg-white/10"
                  onClick={goToLogin}
                >
                  Crear Cuenta
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===== Categories Grid ===== */}
      <section
        id="cats"
        className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Explorá por Categoría
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Link key={category.name} to={category.href}>
                <Card className="group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border-white/70 bg-white/80 backdrop-blur-xl overflow-hidden h-full">
                  <CardContent className="p-6">
                    <div
                      className={`w-16 h-16 bg-gradient-to-br ${category.color} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}
                    >
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">
                      {category.name}
                    </h3>
                    <p className="text-slate-600 mb-4">
                      {category.description}
                    </p>
                    <div className="flex items-center text-blue-600 font-medium group-hover:gap-3 gap-2 transition-all">
                      Ver más
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ===== Featured Publications ===== */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                Publicaciones Destacadas
              </h2>
              <p className="text-slate-600">
                Las mejores oportunidades elegidas para vos
              </p>
            </div>
            <div className="flex items-center gap-2 text-amber-500">
              <Star className="w-7 h-7 fill-amber-400" />
              <span className="font-semibold">Destacadas</span>
            </div>
          </div>

          {loadingPubs ? (
            <p className="text-slate-500">Cargando publicaciones…</p>
          ) : !mainPub ? (
            <p className="text-slate-500">
              No hay publicaciones destacadas por ahora.
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* ===== Tarjeta principal grande ===== */}
              <Card className="lg:col-span-2 relative overflow-hidden group border-none shadow-xl bg-gradient-to-br from-amber-50 via-white to-slate-50">
                <div className="absolute inset-0 pointer-events-none opacity-60">
                  <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-amber-100 blur-3xl" />
                  <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-purple-100 blur-3xl" />
                </div>

                <div className="relative grid grid-cols-1 md:grid-cols-[1.2fr,1.1fr] gap-0">
                  {/* Imagen grande */}
                  {mainPub.images?.[0] && (
                    <div className="relative h-64 md:h-full overflow-hidden">
                      <img
                        src={mainPub.images[0]}
                        alt={mainPub.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                      <div className="absolute top-3 left-3 flex items-center gap-2">
                        <Badge className="bg-amber-500 text-white flex items-center gap-1 shadow-md">
                          <Star className="w-3 h-3 fill-white" />
                          Destacada
                        </Badge>
                        {mainPub.category && (
                          <Badge className="bg-white/90 text-slate-800 capitalize shadow">
                            {mainPub.category}
                          </Badge>
                        )}
                      </div>
                      {mainPub.location && (
                        <div className="absolute bottom-3 left-3 flex items-center text-white/90 text-sm bg-black/40 rounded-full px-3 py-1 backdrop-blur">
                          <MapPin className="w-4 h-4 mr-1" />
                          <span className="truncate max-w-[220px] md:max-w-[260px]">
                            {mainPub.location}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Info principal */}
                  <CardContent className="p-6 md:p-7 flex flex-col justify-between relative z-10">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-amber-600 font-semibold mb-2">
                        Oportunidad destacada
                      </p>
                      <h3 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-3 leading-tight">
                        {mainPub.title}
                      </h3>

                      {mainPub.description && (
                        <p className="text-slate-600 text-sm md:text-base mb-4 line-clamp-3">
                          {mainPub.description}
                        </p>
                      )}

                      {typeof mainPub.price === "number" && (
                        <p className="text-3xl font-extrabold text-emerald-600 mb-3">
                          {asARS(mainPub.price)}
                        </p>
                      )}

                      {mainPub.contact_phone && (
                        <p className="text-sm text-slate-500">
                          Contacto:{" "}
                          <span className="font-medium">
                            {mainPub.contact_phone}
                          </span>
                        </p>
                      )}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2 items-center">
                      {mainPub.category === "empleo" && (
                        <Badge
                          variant="outline"
                          className="text-xs border-blue-200 text-blue-700 bg-blue-50"
                        >
                          Ideal para conseguir trabajo
                        </Badge>
                      )}
                      {mainPub.category === "alquiler" && (
                        <Badge
                          variant="outline"
                          className="text-xs border-purple-200 text-purple-700 bg-purple-50"
                        >
                          Oportunidad para mudarte
                        </Badge>
                      )}
                      {mainPub.category === "venta" && (
                        <Badge
                          variant="outline"
                          className="text-xs border-emerald-200 text-emerald-700 bg-emerald-50"
                        >
                          Oferta especial
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </div>
              </Card>

              {/* ===== Otras destacadas en columnas ===== */}
              <div className="space-y-4">
                {otherPubs.length === 0 ? (
                  <Card className="h-full flex items-center justify-center border-dashed border-slate-200">
                    <CardContent className="text-center text-slate-500">
                      No hay más destacadas por ahora.
                    </CardContent>
                  </Card>
                ) : (
                  otherPubs.map((pub) => (
                    <Card
                      key={pub.id}
                      className="flex gap-3 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all"
                    >
                      {pub.images?.[0] && (
                        <div className="w-28 h-28 shrink-0 overflow-hidden">
                          <img
                            src={pub.images[0]}
                            alt={pub.title}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <CardContent className="py-3 px-3 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-semibold text-sm text-slate-900 line-clamp-1">
                              {pub.title}
                            </h4>
                            {pub.category && (
                              <Badge className="capitalize text-[10px] px-2 py-0.5">
                                {pub.category}
                              </Badge>
                            )}
                          </div>
                          {pub.description && (
                            <p className="text-xs text-slate-600 line-clamp-2">
                              {pub.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          {typeof pub.price === "number" ? (
                            <span className="text-sm font-bold text-emerald-600">
                              {asARS(pub.price)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">
                              Consultar precio
                            </span>
                          )}
                          {pub.location && (
                            <div className="flex items-center text-[11px] text-slate-500">
                              <MapPin className="w-3 h-3 mr-1" />
                              <span className="truncate max-w-[120px]">
                                {pub.location}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ===== Featured Restaurants ===== */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                Restaurantes Populares
              </h2>
              <p className="text-slate-600">
                Pedí comida de los mejores lugares
              </p>
            </div>
            <Link to={createPageUrl("Delivery")}>
              <Button variant="outline">
                Ver todos
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          {loadingRests ? (
            <p className="text-slate-500">Cargando restaurantes…</p>
          ) : restaurants.length === 0 ? (
            <p className="text-slate-500">
              No hay restaurantes destacados por ahora.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {restaurants.map((restaurant) => (
                <Link
                  key={restaurant.id}
                  to={createPageUrl("RestaurantMenu") + `?id=${restaurant.id}`}
                >
                  <Card className="hover:shadow-xl hover:-translate-y-1 transition-all group overflow-hidden">
                    <div className="h-40 bg-gradient-to-br from-orange-400 to-red-500 relative overflow-hidden">
                      {restaurant.cover_image ? (
                        <img
                          src={restaurant.cover_image}
                          alt={restaurant.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <UtensilsCrossed className="w-16 h-16 text-white opacity-50" />
                        </div>
                      )}
                      {restaurant.logo_url && (
                        <div className="absolute bottom-0 left-4 translate-y-1/2">
                          <div className="w-16 h-16 rounded-full bg-white p-1 shadow-lg">
                            <img
                              src={restaurant.logo_url}
                              alt=""
                              className="w-full h-full object-cover rounded-full"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <CardContent className="pt-10 pb-6 px-4">
                      <h3 className="font-bold text-lg mb-1">
                        {restaurant.name}
                      </h3>
                      <p className="text-slate-600 text-sm mb-2 clamp-1">
                        {restaurant.description}
                      </p>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center text-slate-500">
                          <Clock className="w-4 h-4 mr-1" />
                          {restaurant.delivery_time || "30-45 min"}
                        </div>
                        <div className="flex items-center text-yellow-500">
                          <Star className="w-4 h-4 mr-1 fill-yellow-500" />
                          {restaurant.rating}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== CTA Admins ===== */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            ¿Querés publicar tu negocio o servicio?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Convertite en Admin y publicá tus avisos
          </p>
          <Button
            size="lg"
            variant="white"
            className="shadow-xl hover:shadow-2xl"
          >
            Contactar para más info
          </Button>
        </div>
      </section>
    </div>
  );
}
