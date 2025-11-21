// src/pages/Planes.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuthUser } from "@/hooks/useAuthUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import {
  CheckCircle,
  Briefcase,
  Store,
  AlertCircle,
  Star,
  Rocket,
} from "lucide-react";

export default function Planes() {
  const { user } = useAuthUser();
  const navigate = useNavigate();

  const handleCheckout = async (plan_type) => {
    if (!user) {
      navigate("/login", {
        state: { from: "/planes-publicar" },
      });
      return;
    }

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/create-preference`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan_type,
            user_email: user.email,
            user_id: user.id || user.uid, // según cómo te venga del hook
          }),
        }
      );

      const data = await res.json();

      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        alert("No se pudo iniciar el pago. Intentá de nuevo.");
      }
    } catch (error) {
      console.error(error);
      alert("Hubo un error al iniciar el pago.");
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(400px_200px_at_10%_-10%,#dbeafe_0%,transparent_60%),radial-gradient(600px_300px_at_110%_10%,#e9d5ff_0%,transparent_60%)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 lg:py-16">
        {/* HERO / HEADER */}
        <div className="text-center mb-10 sm:mb-12">
          <Badge className="mb-3 bg-blue-50 text-blue-700 border border-blue-200">
            Publicá en ConectCity
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Elegí el plan para tu negocio o servicio
          </h1>
          <p className="mt-3 text-slate-600 text-sm sm:text-base max-w-xl mx-auto">
            Pagás con Mercado Pago y activamos tu suscripción automáticamente
            para que puedas publicar empleos, alquileres, ventas y servicios.
          </p>

          {!user && (
            <p className="mt-3 text-xs sm:text-sm text-amber-700 bg-amber-50 border border-amber-200 inline-flex px-3 py-1 rounded-full">
              Necesitás iniciar sesión para contratar un plan.
            </p>
          )}
        </div>

        {/* PLANES PUBLICACIONES */}
        <section className="mb-12">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">
            Planes para publicaciones
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Para publicar empleos, alquileres, ventas, servicios, etc.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {/* 🟦 PLAN BÁSICO */}
            <Card className="flex flex-col rounded-2xl border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-slate-900">
                      Plan Básico
                    </span>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col space-y-4">
                <div>
                  <p className="text-3xl font-bold text-slate-900">
                    $15.000{" "}
                    <span className="text-base text-slate-500">/ mes</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Hasta 3 publicaciones activas.
                  </p>
                </div>

                <ul className="space-y-2 text-sm text-slate-700 flex-1">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-[2px] text-emerald-500" />
                    <span>Hasta 3 publicaciones activas.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-[2px] text-emerald-500" />
                    <span>Publicá en todas las categorías.</span>
                  </li>
                  <li className="flex items-start gap-2 opacity-60">
                    <CheckCircle className="w-4 h-4 mt-[2px]" />
                    <span>Sin publicaciones destacadas.</span>
                  </li>
                  <li className="flex items-start gap-2 opacity-60">
                    <CheckCircle className="w-4 h-4 mt-[2px]" />
                    <span>No incluye restaurante.</span>
                  </li>
                </ul>

                <Button
                  className="w-full mt-2"
                  onClick={() => handleCheckout("publications_basic")}
                >
                  Pagar con Mercado Pago
                </Button>
              </CardContent>
            </Card>

            {/* 🟧 PLAN INTERMEDIO */}
            <Card className="flex flex-col rounded-2xl border-slate-200 shadow-sm bg-gradient-to-b from-amber-50/70 to-white">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Rocket className="w-5 h-5 text-amber-600" />
                    <span className="font-semibold text-slate-900">
                      Plan Intermedio
                    </span>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col space-y-4">
                <div>
                  <p className="text-3xl font-bold text-slate-900">
                    $25.000{" "}
                    <span className="text-base text-slate-500">/ mes</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Hasta 6 publicaciones activas.
                  </p>
                </div>

                <ul className="space-y-2 text-sm text-slate-700 flex-1">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-[2px] text-emerald-500" />
                    <span>Hasta 6 publicaciones activas.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-[2px] text-emerald-500" />
                    <span>Publicá en todas las categorías.</span>
                  </li>
                  <li className="flex items-start gap-2 opacity-60">
                    <CheckCircle className="w-4 h-4 mt-[2px]" />
                    <span>Sin publicaciones destacadas.</span>
                  </li>
                  <li className="flex items-start gap-2 opacity-60">
                    <CheckCircle className="w-4 h-4 mt-[2px]" />
                    <span>No incluye restaurante.</span>
                  </li>
                </ul>

                <Button
                  className="w-full mt-2"
                  variant="outline"
                  onClick={() => handleCheckout("publications_intermediate")}
                >
                  Pagar con Mercado Pago
                </Button>
              </CardContent>
            </Card>

            {/* 🟪 PLAN PROFESIONAL */}
            <Card className="flex flex-col rounded-2xl border-slate-200 shadow-md relative overflow-hidden bg-gradient-to-b from-purple-50 via-white to-white">
              <div className="absolute right-4 top-4"></div>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-700">
                  <Star className="w-5 h-5 text-purple-600" />
                  <span className="font-semibold">Plan Profesional</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col space-y-5">
                <div className="text-center">
                  <p className="text-4xl font-extrabold text-purple-700 drop-shadow-sm">
                    $50.000
                    <span className="text-base text-slate-500 font-medium">
                      {" "}
                      / mes
                    </span>
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Hasta 12 publicaciones activas.
                  </p>
                </div>

                <ul className="space-y-3 text-sm text-slate-700 flex-1">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-[2px] text-purple-600" />
                    <span className="font-medium">
                      Hasta 12 publicaciones activas.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-[2px] text-purple-600" />
                    <span>Publicación en todas las categorías.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-[2px] text-purple-600" />
                    <span>1 publicación destacada por mes.</span>
                  </li>
                  <li className="flex items-start gap-2 opacity-60">
                    <CheckCircle className="w-4 h-4 mt-[2px]" />
                    <span>No incluye restaurante.</span>
                  </li>
                </ul>

                <Button
                  className="w-full mt-2 bg-purple-600 hover:bg-purple-700 text-white shadow-md"
                  onClick={() => handleCheckout("publications_pro")}
                >
                  Pagar con Mercado Pago
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* PLAN RESTAURANTE */}
        <section className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">
                Plan para restaurantes y delivery
              </h2>
              <p className="text-xs text-slate-500">
                Para locales gastronómicos que quieren recibir pedidos desde
                ConectCity.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            <Card className="flex flex-col rounded-2xl border-slate-200 shadow-sm relative overflow-hidden bg-gradient-to-r from-emerald-50 via-white to-white">
              <div className="absolute right-4 top-4"></div>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="w-5 h-5 text-emerald-600" />
                  <span className="font-semibold text-slate-900">
                    Plan Restaurante
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col space-y-4">
                <div>
                  <p className="text-3xl font-bold text-slate-900">
                    $25.000{" "}
                    <span className="text-base text-slate-500">/ mes</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Tu local en la sección Delivery.
                  </p>
                </div>

                <ul className="space-y-2 text-sm text-slate-700 flex-1">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-[2px] text-emerald-500" />
                    <span>Crear tu restaurante en la sección Delivery.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-[2px] text-emerald-500" />
                    <span>Menú ilimitado.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-[2px] text-emerald-500" />
                    <span>Recibir pedidos y verlos en “Mis pedidos”.</span>
                  </li>
                  <li className="flex items-start gap-2 opacity-60">
                    <CheckCircle className="w-4 h-4 mt-[2px]" />
                    <span>No incluye publicaciones en otras categorías.</span>
                  </li>
                </ul>

                <Button
                  className="w-full mt-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                  variant="outline"
                  onClick={() => handleCheckout("restaurant_mensual")}
                >
                  Pagar con Mercado Pago
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* NOTA FINAL */}
        <div className="mt-10 flex items-start gap-2 text-xs text-slate-500">
          <AlertCircle className="w-4 h-4 mt-[2px]" />
          <p>
            Los pagos se procesan de forma segura a través de Mercado Pago. Una
            vez acreditado el pago, tu plan se activa automáticamente y vas a
            poder gestionar tus publicaciones desde tu cuenta.
          </p>
        </div>
      </div>
    </div>
  );
}
