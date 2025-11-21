// src/pages/SugerenciasReclamos.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/ui/card";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Textarea } from "@/ui/textarea";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import { toast } from "sonner";
import { MessageCircle, Mail, User } from "lucide-react";

export default function SugerenciasReclamos() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    type: "reclamo",
    message: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.message) {
      toast.error("Por favor completá tu email y el mensaje.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );

      if (!res.ok) throw new Error("Error enviando el formulario");

      toast.success("¡Mensaje enviado! Te responderemos a la brevedad.");

      setForm({ name: "", email: "", type: "reclamo", message: "" });
    } catch {
      toast.error("No pudimos enviar tu mensaje. Probá otra vez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10 bg-gradient-to-br from-slate-50 to-slate-100">
      <Card className="w-full max-w-2xl shadow-xl border-slate-300/60 backdrop-blur-lg bg-white/95 rounded-3xl">
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-900 text-white mb-3 shadow-lg">
              <MessageCircle className="w-8 h-8" />
            </div>

            <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">
              Sugerencias y Reclamos
            </h1>
            <p className="text-slate-600 mt-1">
              Tu opinión nos ayuda a mejorar ConectCity.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 mt-4">
            {/* Nombre */}
            <div className="space-y-2">
              <Label htmlFor="name" className="font-medium flex gap-2 items-center">
                <User className="w-4 h-4 text-slate-500" />
                Nombre (opcional)
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="Tu nombre"
                value={form.name}
                onChange={handleChange}
                className="rounded-xl"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="font-medium flex gap-2 items-center">
                <Mail className="w-4 h-4 text-slate-500" />
                Correo electrónico
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="tuemail@ejemplo.com"
                value={form.email}
                onChange={handleChange}
                className="rounded-xl"
              />
              <p className="text-xs text-slate-500 ml-1">
                Te contactaremos si necesitamos más información.
              </p>
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <Label htmlFor="type" className="font-medium">
                Tipo de mensaje
              </Label>
              <select
                id="type"
                name="type"
                value={form.type}
                onChange={handleChange}
                className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white shadow-sm"
              >
                <option value="reclamo">Reclamo / inconveniente</option>
                <option value="sugerencia">Sugerencia de mejora</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            {/* Mensaje */}
            <div className="space-y-2">
              <Label htmlFor="message" className="font-medium">
                Mensaje
              </Label>
              <Textarea
                id="message"
                name="message"
                required
                rows={6}
                placeholder="Escribinos qué pasó o qué te gustaría mejorar..."
                value={form.message}
                onChange={handleChange}
                className="rounded-xl"
              />
            </div>

            {/* Botones */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                className="rounded-xl"
              >
                Volver
              </Button>

              <Button type="submit" disabled={loading} className="rounded-xl">
                {loading ? "Enviando..." : "Enviar"}
              </Button>
            </div>

            <p className="text-[12px] text-slate-500 mt-4 text-right">
              Los mensajes se envían a{" "}
              <span className="font-semibold">conectcity1@gmail.com</span>.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
