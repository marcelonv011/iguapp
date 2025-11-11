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
import AdminPanel from "@/pages/AdminPanel.jsx";
import SuperAdminPanel from "@/pages/SuperAdminPanel.jsx";
import SettingsProfile from "@/pages/SettingsProfile";
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
              {/* públicas */}
              <Route path="/" element={<Home />} />
              <Route path="/empleos" element={<div>Empleos</div>} />
              <Route path="/alquileres" element={<div>Alquileres</div>} />
              <Route path="/ventas" element={<div>Ventas</div>} />
              <Route path="/emprendimientos" element={<div>Emprendimientos</div>} />
              <Route path="/delivery" element={<div>Delivery</div>} />
              <Route path="/restaurant" element={<div>Restaurant</div>} />
              <Route path="/login" element={<Login />} />
              <Route path="/configuracion" element={<SettingsProfile />} />

              {/* protegidas */}
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
