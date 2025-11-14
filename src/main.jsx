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

import "./index.css";

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
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
              <Route path="/alquileres/:id" element={<AlquilerDetalle />} /> {/* 👈 NUEVA */}
              <Route path="/ventas" element={<Ventas />} />
              <Route path="/emprendimientos" element={<div>Emprendimientos</div>} />
              <Route path="/delivery" element={<div>Delivery</div>} />
              <Route path="/restaurant" element={<div>Restaurant</div>} />
              <Route path="/login" element={<Login />} />
              <Route path="/registro" element={<Registro />} />
              <Route path="/configuracion" element={<SettingsProfile />} />
              <Route path="/empleos/:slugOrId" element={<JobDetails />} />

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
              <Route path="*" element={<div style={{ padding: 24 }}>Página no encontrada</div>} />
            </Routes>
          </Layout>
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
