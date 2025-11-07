// src/pages/Home.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl, asARS } from "@/utils";
import { useQuery } from "@tanstack/react-query";
import { fetchFeaturedPublications, fetchFeaturedRestaurants } from "@/api/firestoreFetchers";
import { useAuthUser } from "@/hooks/useAuthUser";

import {
  Briefcase, Building2, ShoppingBag, Store,
  UtensilsCrossed, ArrowRight, TrendingUp, Star,
  MapPin, Clock
} from "lucide-react";

import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Badge } from "@/ui/badge";

export default function Home() {
  const { user, loadingUser } = useAuthUser();

  const { data: publications = [], isLoading: loadingPubs } = useQuery({
    queryKey: ["featured-publications"],
    queryFn: fetchFeaturedPublications,
  });

  const { data: restaurants = [], isLoading: loadingRests } = useQuery({
    queryKey: ["featured-restaurants"],
    queryFn: fetchFeaturedRestaurants,
  });

  const categories = [
    { name: "Empleos",          icon: Briefcase,     description: "Encontrá tu próximo trabajo",   color: "from-blue-500 to-blue-600",       href: createPageUrl("Empleos") },
    { name: "Alquileres",       icon: Building2,     description: "Casas, deptos y más",           color: "from-purple-500 to-purple-600",   href: createPageUrl("Alquileres") },
    { name: "Ventas",           icon: ShoppingBag,   description: "Comprá y vendé",                color: "from-green-500 to-green-600",     href: createPageUrl("Ventas") },
    { name: "Emprendimientos",  icon: Store,         description: "Descubrí negocios locales",     color: "from-orange-500 to-orange-600",   href: createPageUrl("Emprendimientos") },
    { name: "Delivery",         icon: UtensilsCrossed, description: "Pedí comida a domicilio",     color: "from-red-500 to-red-600",         href: createPageUrl("Delivery") },
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
              Todo lo que necesitás<br />
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
                onClick={() => document.getElementById("cats")?.scrollIntoView({ behavior: "smooth" })}
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
      <section id="cats" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Explorá por Categoría</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Link key={category.name} to={category.href}>
                <Card className="group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border-white/70 bg-white/80 backdrop-blur-xl overflow-hidden h-full">
                  <CardContent className="p-6">
                    <div className={`w-16 h-16 bg-gradient-to-br ${category.color} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">{category.name}</h3>
                    <p className="text-slate-600 mb-4">{category.description}</p>
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
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Publicaciones Destacadas</h2>
              <p className="text-slate-600">Las mejores oportunidades de la semana</p>
            </div>
            <Star className="w-8 h-8 text-yellow-500 fill-yellow-500" />
          </div>

          {loadingPubs ? (
            <p className="text-slate-500">Cargando publicaciones…</p>
          ) : publications.length === 0 ? (
            <p className="text-slate-500">No hay publicaciones destacadas por ahora.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {publications.map((pub) => (
                <Card key={pub.id} className="hover:shadow-xl hover:-translate-y-1 transition-all group overflow-hidden">
                  {pub.images?.[0] && (
                    <div className="h-48 overflow-hidden">
                      <img
                        src={pub.images[0]}
                        alt={pub.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <CardContent className="p-6">
                    {pub.category && <Badge className="mb-2">{pub.category}</Badge>}
                    <h3 className="font-bold text-xl mb-2 text-slate-900">{pub.title}</h3>
                    {pub.description && (
                      <p className="text-slate-600 text-sm mb-3 clamp-2">{pub.description}</p>
                    )}
                    {typeof pub.price === "number" && (
                      <p className="text-2xl font-bold text-green-600 mb-2">{asARS(pub.price)}</p>
                    )}
                    {pub.location && (
                      <div className="flex items-center text-slate-500 text-sm">
                        <MapPin className="w-4 h-4 mr-1" />
                        {pub.location}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== Featured Restaurants ===== */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Restaurantes Populares</h2>
              <p className="text-slate-600">Pedí comida de los mejores lugares</p>
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
            <p className="text-slate-500">No hay restaurantes destacados por ahora.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {restaurants.map((restaurant) => (
                <Link key={restaurant.id} to={createPageUrl("RestaurantMenu") + `?id=${restaurant.id}`}>
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
                            <img src={restaurant.logo_url} alt="" className="w-full h-full object-cover rounded-full" />
                          </div>
                        </div>
                      )}
                    </div>
                    <CardContent className="pt-10 pb-6 px-4">
                      <h3 className="font-bold text-lg mb-1">{restaurant.name}</h3>
                      <p className="text-slate-600 text-sm mb-2 clamp-1">{restaurant.description}</p>
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
          <h2 className="text-3xl md:text-4xl font-bold mb-4">¿Querés publicar tu negocio o servicio?</h2>
          <p className="text-xl text-blue-100 mb-8">Convertite en Admin y publicá tus avisos</p>
          <Button size="lg" variant="white" className="shadow-xl hover:shadow-2xl">Contactar para más info</Button>
        </div>
      </section>
    </div>
  );
}
