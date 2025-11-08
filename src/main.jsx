import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext"; 
import { Toaster } from "sonner";
import Layout from "@/layouts/Layout.jsx";
import Home from "@/pages/Home.jsx";
import Login from "@/pages/Login.jsx"; 
import ProtectedRoute from "@/components/ProtectedRoute.jsx"; 
import SuperAdminPanel from "@/pages/SuperAdminPanel.jsx";
import "./index.css";

const qc = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <AuthProvider> {/* 👈 envuelve todo */}
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/empleos" element={<div>Empleos</div>} />
              <Route path="/alquileres" element={<div>Alquileres</div>} />
              <Route path="/ventas" element={<div>Ventas</div>} />
              <Route path="/emprendimientos" element={<div>Emprendimientos</div>} />
              <Route path="/delivery" element={<div>Delivery</div>} />
              <Route path="/restaurant" element={<div>Restaurant</div>} />
              <Route path="/login" element={<Login />} />
              <Route path="/superadmin" element={<SuperAdminPanel />} />


              {/* Ejemplo de ruta protegida */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <div>Panel Admin</div>
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
