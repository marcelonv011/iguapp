// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Layout from "@/layouts/Layout.jsx";
import Home from "@/pages/Home.jsx";
import "./index.css";

const qc = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
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
            <Route path="/login" element={<div>Login</div>} />
            <Route path="/admin" element={<div>Panel Admin</div>} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
