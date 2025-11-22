// src/layouts/Layout.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Home,
  Briefcase,
  Building2,
  ShoppingBag,
  Store,
  UtensilsCrossed,
  Menu,
  X,
  LogOut,
  Settings,
  Package,
  Crown,
  Shield,
  ChefHat,
} from "lucide-react";

import { Button } from "@/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/ui/dropdown-menu";

import { useAuthUser } from "@/hooks/useAuthUser";
import { db, auth } from "@/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { Badge } from "@/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner"; // 👈 NUEVO

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthUser();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profile, setProfile] = useState(null);

  const queryClient = useQueryClient();

  // Helper para invalidar keys
  const invalidate = (key) => {
    if (!key) return;
    queryClient.invalidateQueries({ queryKey: [key] });
  };

  // Según a qué sección vaya, invalidamos los queries correspondientes
  const invalidateForRoute = (routeName) => {
    switch (routeName) {
      case "Inicio":
        invalidate("featured-publications");
        invalidate("featured-restaurants");
        break;
      case "Empleos":
        invalidate("empleos");
        break;
      case "Alquileres":
        invalidate("alquileres");
        break;
      case "Ventas":
        invalidate("ventas");
        break;
      case "Negocios":
        invalidate("emprendimientos");
        break;
      case "Delivery":
        invalidate("delivery");
        invalidate("restaurants");
        invalidate("featured-restaurants");
        break;
      default:
        break;
    }
  };

  // === Cargar perfil desde Firestore ===
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setProfile({ email: user.email, ...snap.data() });
      } else {
        setProfile({ email: user.email });
      }
    });

    return () => unsub();
  }, [user]);

  // === LEER ?payment=... AL VOLVER DE MERCADO PAGO ===
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get("payment");
    if (!status) return;

    if (status === "success") {
      toast.success("Pago aprobado 🎉. Tu plan se está activando.");
    } else if (status === "failure") {
      toast.error("No pudimos procesar tu pago. Probá con otro medio.");
    } else if (status === "pending") {
      toast("Tu pago quedó pendiente en Mercado Pago.");
    }

    // Limpiar el parámetro para que no vuelva a dispararse
    const url = new URL(window.location.href);
    url.searchParams.delete("payment");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, [location.search]);

  // === Helpers: nombre e iniciales ===
  const displayName = useMemo(() => {
    if (profile?.full_name) return profile.full_name;
    if (user?.displayName) return user.displayName;
    if (profile?.email) return profile.email.split("@")[0];
    return "Usuario";
  }, [profile, user]);

  const initials = useMemo(() => {
    const src = (
      profile?.full_name ||
      user?.displayName ||
      profile?.email ||
      "U"
    ).trim();
    const letters = src
      .split(/[ ._]/)
      .filter(Boolean)
      .map((s) => s[0]?.toUpperCase());
    return (letters[0] || "U") + (letters[1] || "");
  }, [profile, user]);

  // === Logout ===
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setProfile(null);
      navigate("/");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      alert("Hubo un problema al cerrar sesión");
    }
  };

  // === Navegación principal ===
  const mainNavigation = [
    { name: "Inicio", href: "/", icon: Home },
    { name: "Empleos", href: createPageUrl("Empleos"), icon: Briefcase },
    { name: "Alquileres", href: createPageUrl("Alquileres"), icon: Building2 },
    { name: "Ventas", href: createPageUrl("Ventas"), icon: ShoppingBag },
    {
      name: "Negocios",
      href: createPageUrl("Emprendimientos"),
      icon: Store,
    },
    {
      name: "Delivery",
      href: createPageUrl("Delivery"),
      icon: UtensilsCrossed,
    },
  ];

  // === Activo (Inicio exacto / resto startsWith) ===
  const isActivePath = (itemHref, isHome) =>
    isHome
      ? location.pathname === "/" || location.pathname === "/home"
      : location.pathname.startsWith(itemHref);

  // === Badges de rol ===
  const RolePill = () => {
    const role = profile?.role_type;
    if (!role)
      return (
        <Badge className="gap-1 bg-slate-100 text-slate-700 border border-slate-200">
          Usuario
        </Badge>
      );
    if (role === "superadmin")
      return (
        <Badge className="gap-1 bg-purple-100 text-purple-700 border border-purple-200">
          <Shield className="w-3 h-3" /> SuperAdmin
        </Badge>
      );
    if (role === "admin")
      return (
        <Badge className="gap-1 bg-amber-100 text-amber-700 border border-amber-200">
          <Crown className="w-3 h-3" /> Admin
        </Badge>
      );
    return (
      <Badge className="gap-1 bg-slate-100 text-slate-700 border border-slate-200">
        Usuario
      </Badge>
    );
  };

  const RoleText = () => {
    const role = profile?.role_type;
    return null;
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(400px_200px_at_10%_-10%,#dbeafe_0%,transparent_60%),radial-gradient(600px_300px_at_110%_10%,#e9d5ff_0%,transparent_60%)]">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div
                className="
  w-12 h-12 rounded-2xl overflow-hidden 
  bg-white/40 backdrop-blur-xl 
  shadow-[0_8px_25px_-6px_rgba(0,0,0,0.25)]
  ring-1 ring-white/50
  hover:shadow-[0_10px_30px_-4px_rgba(0,0,0,0.35)]
  hover:scale-[1.04]
  transition-all duration-300
"
              >
                <img
                  src="/conectcity-logo.png"
                  alt="ConectCity Logo"
                  className="w-full h-full object-cover object-center"
                />
              </div>

              <div className="hidden sm:block">
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
                    ConectCity
                  </span>
                </h1>
                <p className="text-xs text-slate-500">
                  Conectamos tu ciudad, en un solo lugar.
                </p>
              </div>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-2">
              {mainNavigation.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(item.href, item.name === "Inicio");

                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => invalidateForRoute(item.name)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-2xl transition-all
                ${
                  active
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }
              `}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right (perfil o login) */}
            <div className="flex items-center gap-2">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-3 cursor-pointer rounded-full pl-1 pr-3 py-1 hover:bg-slate-100 transition"
                    >
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-xs font-semibold grid place-items-center shadow-md">
                        {profile?.photo_url ? (
                          <img
                            src={profile.photo_url}
                            alt="avatar"
                            className="w-9 h-9 rounded-full object-cover"
                          />
                        ) : (
                          <span>{initials}</span>
                        )}
                      </div>

                      {/* Nombre y rol */}
                      <div className="hidden sm:block text-left">
                        <div className="text-sm font-semibold leading-tight truncate max-w-[160px]">
                          {displayName}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <RolePill />
                        </div>
                      </div>
                    </button>
                  </DropdownMenuTrigger>

                  {/* Menu usuario */}
                  <DropdownMenuContent align="end" className="w-64">
                    <div className="px-3 py-2 text-sm">
                      <p className="font-medium truncate">
                        {profile?.email || user.email}
                      </p>
                      <div className="mt-2">
                        <RolePill />
                      </div>
                    </div>

                    <DropdownMenuSeparator />

                    {(profile?.role_type === "admin" ||
                      profile?.role_type === "superadmin") && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link to="/admin">
                            <Settings className="w-4 h-4" />
                            <span className="ml-2">Panel de Admin</span>
                          </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem asChild>
                          <Link to="/mi-restaurante">
                            <ChefHat className="w-4 h-4" />
                            <span className="ml-2">Mi Restaurante</span>
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}

                    {profile?.role_type === "superadmin" && (
                      <DropdownMenuItem asChild>
                        <Link to="/superadmin">
                          <Shield className="w-4 h-4" />
                          <span className="ml-2">Panel SuperAdmin</span>
                        </Link>
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuItem asChild>
                      <Link to="/mis-pedidos">
                        <Package className="w-4 h-4" />
                        <span className="ml-2">Mis Pedidos</span>
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem asChild>
                      <Link to="/configuracion">
                        <Settings className="w-4 h-4" />
                        <span className="ml-2">Configuración</span>
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        handleLogout();
                      }}
                      className="text-red-600"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="ml-2">Cerrar Sesión</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link to="/login">
                  <Button variant="primary" size="md" className="rounded-xl">
                    Iniciar Sesión
                  </Button>
                </Link>
              )}

              {/* Mobile toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="Abrir menú"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-xl">
            <nav className="px-4 py-3 grid grid-cols-2 gap-2">
              {mainNavigation.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(item.href, item.name === "Inicio");
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      invalidateForRoute(item.name);
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all border
                ${
                  active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "text-slate-700 hover:bg-slate-100 border-slate-200"
                }
              `}
                  >
                    <Icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Main */}
      <main className="min-h-[calc(100vh-4rem)]">{children}</main>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-200 py-10 mt-16 relative overflow-hidden">
        <div className="absolute right-[-10%] bottom-[-30%] w-[500px] h-[500px] rounded-full bg-indigo-600/10 blur-3xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Columna 1 – ConectCity */}
            <div>
              <h3 className="font-bold text-lg mb-3">ConectCity</h3>
              <p className="text-slate-400 text-sm">
                La plataforma que conecta tu ciudad: empleos, alquileres,
                ventas, negocios y delivery. Todo lo que necesitás, en un solo
                lugar.
              </p>
            </div>

            {/* Columna 2 – Explorar */}
            <div>
              <h3 className="font-bold text-lg mb-3">Explorar</h3>
              <div className="space-y-2 text-sm">
                <Link
                  to={createPageUrl("Empleos")}
                  onClick={() => invalidateForRoute("Empleos")}
                  className="block text-slate-400 hover:text-white"
                >
                  Ofertas de Empleo
                </Link>

                <Link
                  to={createPageUrl("Alquileres")}
                  onClick={() => invalidateForRoute("Alquileres")}
                  className="block text-slate-400 hover:text-white"
                >
                  Alquileres y Viviendas
                </Link>

                <Link
                  to={createPageUrl("Delivery")}
                  onClick={() => invalidateForRoute("Delivery")}
                  className="block text-slate-400 hover:text-white"
                >
                  Delivery y Restaurantes
                </Link>
              </div>
            </div>

            {/* Columna 3 – Contacto */}
            <div>
              <h3 className="font-bold text-lg mb-3">Contacto</h3>
              <p className="text-slate-400 text-sm">
                ¿Querés publicar en ConectCity como negocio o profesional?
                Escribinos y te asesoramos para empezar.
              </p>

              {/* 👇 Nuevo: mail de contacto */}
              <p className="text-slate-300 text-sm mt-3">
                Correo de contacto:{" "}
                <a
                  href="mailto:conectcity1@gmail.com"
                  className="text-sky-400 hover:underline"
                >
                  conectcity1@gmail.com
                </a>
              </p>

              {/* 👇 Nuevo: botón para sugerencias / reclamos */}
              <div className="mt-4">
                <Link to="/sugerencias-reclamos">
                  <Button
                    size="sm"
                    className="rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 
             text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 
             transition-all px-5 py-1.5"
                  >
                    Sugerencias y reclamos
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Copy final + links legales */}
          <div className="border-t border-slate-800 mt-8 pt-6 text-slate-500 text-sm">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <span className="text-center md:text-left">
                © {new Date().getFullYear()} ConectCity — Tu ciudad, conectada.
              </span>

              <div className="flex flex-wrap gap-3 justify-center md:justify-end">
                <Link
                  to="/terminos"
                  className="text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Términos y Condiciones
                </Link>
                <Link
                  to="/privacidad"
                  className="text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Política de Privacidad
                </Link>
                <Link
                  to="/aviso-legal"
                  className="text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Aviso Legal
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
