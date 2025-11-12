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
import Registro from "@/pages/Registro.jsx"; // 👈 nuevo import
import AdminPanel from "@/pages/AdminPanel.jsx";
import SuperAdminPanel from "@/pages/SuperAdminPanel.jsx";
import SettingsProfile from "@/pages/SettingsProfile.jsx";
import Empleos from "@/pages/Empleos.jsx";
import JobDetails from "@/pages/JobDetails";
import Alquileres from "@/pages/Alquileres";
import ProtectedRoute from "@/components/ProtectedRoute.jsx";

import "./index.css";

const qc = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              {/* 🌐 Públicas */}
              <Route path="/" element={<Home />} />
              <Route path="/empleos" element={<Empleos />} />
              <Route path="/alquileres" element={<Alquileres />} />
              <Route path="/ventas" element={<div>Ventas</div>} />
              <Route path="/emprendimientos" element={<div>Emprendimientos</div>} />
              <Route path="/delivery" element={<div>Delivery</div>} />
              <Route path="/restaurant" element={<div>Restaurant</div>} />
              <Route path="/login" element={<Login />} />
              <Route path="/registro" element={<Registro />} /> {/* ✅ nueva ruta */}
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
            </Routes>
          </Layout>
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
