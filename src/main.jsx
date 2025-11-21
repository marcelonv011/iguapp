// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { AuthProvider } from "@/contexts/AuthContext";
import Layout from "@/layouts/Layout.jsx";
import Home from "@/pages/Home.jsx";
import Login from "@/pages/Login.jsx";
import Registro from "@/pages/Registro.jsx";
import AdminPanel from "@/pages/AdminPanel.jsx";
import SuperAdminPanel from "@/pages/SuperAdminPanel.jsx";
import SettingsProfile from "@/pages/SettingsProfile.jsx";
import Empleos from "@/pages/Empleos.jsx";
import JobDetails from "@/pages/JobDetails";
import Alquileres from "@/pages/Alquileres";
import AlquilerDetalle from "@/pages/AlquilerDetalle.jsx";
import ProtectedRoute from "@/components/ProtectedRoute.jsx";
import ScrollToTop from "@/components/ScrollToTop.jsx";
import Ventas from "@/pages/Ventas.jsx";
import VentaDetails from "@/pages/VentaDetails";
import Emprendimientos from "@/pages/Emprendimientos";
import EmprendimientoDetails from "@/pages/EmprendimientoDetails";
import Delivery from "@/pages/Delivery.jsx";
import GestionarRestaurante from "@/pages/GestionarRestaurante";
import RestaurantMenu from "@/pages/RestaurantMenu.jsx";
import MisPedidos from "@/pages/MisPedidos";
import Planes from "@/pages/Planes";

import "./index.css";
import SugerenciasReclamos from "./pages/SugerenciasReclamos";

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      // Siempre consideramos los datos "viejos"
      staleTime: 0,
      // Cada vez que se monta la página, vuelve a leer de Firestore
      refetchOnMount: "always",
      // Si volvés a la pestaña, vuelve a leer
      refetchOnWindowFocus: "always",
      // Si se reconecta internet, vuelve a leer
      refetchOnReconnect: "always",
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Layout>
            <Routes>
              {/* 🌐 Públicas */}
              <Route path="/" element={<Home />} />
              <Route path="/empleos" element={<Empleos />} />
              <Route path="/alquileres" element={<Alquileres />} />
              <Route
                path="/alquileres/:id"
                element={<AlquilerDetalle />}
              />{" "}
              {/* 👈 NUEVA */}
              <Route path="/ventas" element={<Ventas />} />
              <Route path="/ventas/:id" element={<VentaDetails />} />
              <Route path="/emprendimientos" element={<Emprendimientos />} />
              <Route
                path="/emprendimientos/:id"
                element={<EmprendimientoDetails />}
              />
              <Route path="/delivery" element={<Delivery />} />
              <Route
                path="/delivery/:restaurantId"
                element={<RestaurantMenu />}
              />
              <Route
                path="/mi-restaurante"
                element={
                  <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
                    <GestionarRestaurante />
                  </ProtectedRoute>
                }
              />
              <Route path="/mis-pedidos" element={<MisPedidos />} />
              <Route path="/login" element={<Login />} />
              <Route path="/registro" element={<Registro />} />
              <Route path="/configuracion" element={<SettingsProfile />} />
              <Route path="/empleos/:slugOrId" element={<JobDetails />} />
              <Route
                path="/planes-publicar"
                element={
                  <div className="min-h-screen grid place-items-center text-center p-6">
                    <h1 className="text-2xl font-bold text-slate-800">
                      🚫 Página temporalmente deshabilitada
                    </h1>
                    <p className="text-slate-600 mt-2 max-w-md">
                      Los planes aún no están disponibles. Todo es gratis por
                      ahora 🙂
                    </p>
                  </div>
                }
              />
              <Route
                path="/sugerencias-reclamos"
                element={<SugerenciasReclamos />}
              />
              {/* 🔒 Protegidas */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
                    <AdminPanel />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/superadmin"
                element={
                  <ProtectedRoute allowedRoles={["superadmin"]}>
                    <SuperAdminPanel />
                  </ProtectedRoute>
                }
              />
              {/* 404 */}
              <Route
                path="*"
                element={
                  <div style={{ padding: 24 }}>Página no encontrada</div>
                }
              />
            </Routes>
          </Layout>
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
