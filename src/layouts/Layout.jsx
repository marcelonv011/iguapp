// src/layouts/Layout.jsx
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Home, Briefcase, Building2, ShoppingBag, Store,
  UtensilsCrossed, Menu, X, User, LogOut, Settings,
  Package, Crown, Shield, ChefHat
} from "lucide-react";

import { Button } from "@/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator
} from "@/ui/dropdown-menu";

import { useAuthUser } from "@/hooks/useAuthUser";
import { db, auth } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { Badge } from "@/ui/badge";

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthUser();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profile, setProfile] = useState(null);

  // === Cargar perfil desde Firestore ===
  useEffect(() => {
    const load = async () => {
      try {
        if (!user) { setProfile(null); return; }
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        setProfile(snap.exists() ? { email: user.email, ...snap.data() } : { email: user.email });
      } catch {
        setProfile({ email: user?.email });
      }
    };
    load();
  }, [user]);

  // === Logout ===
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setProfile(null);
      navigate("/"); // redirige al home
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
    { name: "Emprendimientos", href: createPageUrl("Emprendimientos"), icon: Store },
    { name: "Delivery", href: createPageUrl("Delivery"), icon: UtensilsCrossed },
  ];

  // === Badges de rol ===
  const RolePill = () => {
    const role = profile?.role_type;
    if (!role) return null;
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
    return null;
  };

  // === Texto de descripción de rol ===
  const RoleText = () => {
    const role = profile?.role_type;
    if (role === "superadmin") return <p className="text-xs text-purple-600 mt-1">Super Administrador del sistema</p>;
    if (role === "admin") return <p className="text-xs text-amber-600 mt-1">Administrador local</p>;
    return <p className="text-xs text-slate-500 mt-1"></p>;
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(400px_200px_at_10%_-10%,#dbeafe_0%,transparent_60%),radial-gradient(600px_300px_at_110%_10%,#e9d5ff_0%,transparent_60%)]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20 group-hover:scale-105 transition-transform">
                <Store className="w-6 h-6 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
                    Ciudad Digital
                  </span>
                </h1>
                <p className="text-xs text-slate-500">Tu ciudad en un solo lugar</p>
              </div>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-1">
              {mainNavigation.map((item) => {
                const Icon = item.icon;
                // 👇 Inicio exacto, otros con startsWith
                const isActive =
                  item.name === "Inicio"
                    ? location.pathname === "/" || location.pathname === "/home"
                    : location.pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-2xl transition-all ${
                      isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Right (perfil o login) */}
            <div className="flex items-center gap-3">
              {user ? (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      {/* 👇 botón focusable (antes era un <div>) */}
      <button type="button" className="flex items-center gap-2 cursor-pointer outline-none">
        <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center shadow-md">
          <User className="w-4 h-4 text-white" />
        </div>
        <div className="hidden sm:block text-left">
         <div className="text-sm font-semibold leading-none">
  {profile?.full_name
    ? profile.full_name
    : user?.displayName
      ? user.displayName
      : profile?.email || "Usuario"}
</div>

          <div className="mt-1">
            <RolePill />
            <RoleText />
          </div>
        </div>
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="end" className="w-56">
      <div className="px-3 py-2 text-sm">
        <p className="font-medium">{profile?.email || user.email}</p>
        <div className="mt-2">
          <RolePill />
          <RoleText />
        </div>
      </div>

      <DropdownMenuSeparator />

      {(profile?.role_type === "admin" || profile?.role_type === "superadmin") && (
        <>
          <DropdownMenuItem asChild>
            <Link to={createPageUrl("AdminPanel")}>
              <Settings className="w-4 h-4" /> <span className="ml-2">Panel de Admin</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={createPageUrl("GestionarRestaurante")}>
              <ChefHat className="w-4 h-4" /> <span className="ml-2">Mi Restaurante</span>
            </Link>
          </DropdownMenuItem>
        </>
      )}

      {profile?.role_type === "superadmin" && (
        <DropdownMenuItem asChild>
          <Link to={createPageUrl("SuperAdminPanel")}>
            <Shield className="w-4 h-4" /> <span className="ml-2">Panel SuperAdmin</span>
          </Link>
        </DropdownMenuItem>
      )}

      <DropdownMenuItem asChild>
        <Link to={createPageUrl("MisPedidos")}>
          <Package className="w-4 h-4" /> <span className="ml-2">Mis Pedidos</span>
        </Link>
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      {/* 👇 En Radix use onSelect en vez de onClick */}
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          handleLogout();
        }}
        className="text-red-600"
      >
        <LogOut className="w-4 h-4" /> <span className="ml-2">Cerrar Sesión</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
) : (
  <Link to="/login">
    <Button variant="primary" size="md">Iniciar Sesión</Button>
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
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-xl">
            <nav className="px-4 py-3 space-y-1">
              {mainNavigation.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.name === "Inicio"
                    ? location.pathname === "/" || location.pathname === "/home"
                    : location.pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                      isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                    }`}
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
            <div>
              <h3 className="font-bold text-lg mb-3">Ciudad Digital</h3>
              <p className="text-slate-400 text-sm">
                Conectamos tu ciudad: empleos, alquileres, ventas, emprendimientos y delivery.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-3">Enlaces</h3>
              <div className="space-y-2 text-sm">
                <Link to={createPageUrl("Empleos")} className="block text-slate-400 hover:text-white">Empleos</Link>
                <Link to={createPageUrl("Alquileres")} className="block text-slate-400 hover:text-white">Alquileres</Link>
                <Link to={createPageUrl("Delivery")} className="block text-slate-400 hover:text-white">Delivery</Link>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-3">Contacto</h3>
              <p className="text-slate-400 text-sm">
                ¿Querés ser Admin y publicar? Escribinos para más info.
              </p>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-6 text-center text-slate-500 text-sm">
            © {new Date().getFullYear()} Ciudad Digital — Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
