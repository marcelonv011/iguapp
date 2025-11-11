// src/pages/Registro.jsx
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "@/firebase";
import { ensureUserDoc } from "@/lib/ensureUserDoc";

import { Card, CardContent } from "@/ui/card";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";

import { User, Phone, Mail, Lock, ArrowRight } from "lucide-react";

export default function Registro() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location?.state?.from?.pathname || "/";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm({
    defaultValues: { full_name: "", phone_number: "", email: "", password: "" },
  });

  const password = watch("password");

  useEffect(() => {
    if (auth.currentUser) navigate(from, { replace: true });
  }, [navigate, from]);

  const onSubmit = async ({ full_name, phone_number, email, password }) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // si tu ensureUserDoc admite overrides, los pasamos:
      await ensureUserDoc(cred.user, { full_name, phone_number });
      navigate(from, { replace: true });
    } catch (e) {
      alert(e?.message || "No se pudo crear la cuenta");
    }
  };

  const registerWithGoogle = async () => {
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      await ensureUserDoc(cred.user);
      navigate(from, { replace: true });
    } catch (e) {
      alert(e?.message || "Error con Google");
    }
  };

  // helper mínimo de fuerza (solo visual)
  const strength =
    !password ? 0 : password.length >= 12 ? 3 : password.length >= 8 ? 2 : 1;

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Fondo con gradientes suaves */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(900px_400px_at_-10%_-10%,#dbeafe_0%,transparent_60%),radial-gradient(900px_400px_at_110%_10%,#e9d5ff_0%,transparent_60%)]" />
      <div className="absolute right-[-10%] bottom-[-30%] w-[520px] h-[520px] rounded-full bg-indigo-500/10 blur-3xl -z-10" />

      <div className="grid min-h-screen place-items-center p-4">
        <Card className="w-full max-w-md border-0 shadow-xl backdrop-blur bg-white/80 rounded-2xl">
          <CardContent className="p-6 sm:p-8">
            {/* Marca */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl grid place-items-center bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md">
                <span className="font-bold">CD</span>
              </div>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
                  Ciudad Digital
                </h2>
                <p className="text-xs text-slate-500">Tu ciudad en un solo lugar</p>
              </div>
            </div>

            <div className="mb-5">
              <h1 className="text-2xl font-bold">Crear cuenta</h1>
              <p className="text-sm text-muted-foreground">
                Registrate para publicar empleos, alquileres y más.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Nombre completo */}
              <div className="space-y-2">
                <Label htmlFor="full_name">Nombre completo</Label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <Input
                    id="full_name"
                    placeholder="Juan Pérez"
                    className="pl-9"
                    {...register("full_name", { required: "Nombre requerido" })}
                  />
                </div>
                {errors.full_name && (
                  <p className="text-xs text-red-600">{errors.full_name.message}</p>
                )}
              </div>

              {/* Teléfono (opcional) */}
              <div className="space-y-2">
                <Label htmlFor="phone_number">Teléfono</Label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <Input
                    id="phone_number"
                    type="tel"
                    placeholder="+54 9 3764 123456"
                    className="pl-9"
                    {...register("phone_number", {
                      pattern: {
                        value: /^[0-9+()\-\s]{6,20}$/,
                        message: "Formato inválido",
                      },
                    })}
                  />
                </div>
                {errors.phone_number && (
                  <p className="text-xs text-red-600">
                    {errors.phone_number.message}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    className="pl-9"
                    {...register("email", { required: "Email requerido" })}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-600">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-9"
                    {...register("password", {
                      required: "Contraseña requerida",
                      minLength: { value: 6, message: "Mínimo 6 caracteres" },
                    })}
                  />
                </div>

                {/* Indicador simple de fuerza */}
                <div className="h-1 rounded bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      strength === 0
                        ? "w-0"
                        : strength === 1
                        ? "w-1/3 bg-red-500"
                        : strength === 2
                        ? "w-2/3 bg-yellow-500"
                        : "w-full bg-green-600"
                    }`}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Usá 8+ caracteres. Mejor si combinás mayúsculas, números y símbolos.
                </p>

                {errors.password && (
                  <p className="text-xs text-red-600">{errors.password.message}</p>
                )}
              </div>

              <Button disabled={isSubmitting} className="w-full rounded-xl">
                {isSubmitting ? "Creando cuenta..." : "Registrarme"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>

            {/* Separador */}
            <div className="flex items-center gap-3 my-5">
              <div className="h-px bg-slate-200 flex-1" />
              <span className="text-xs text-slate-500">o</span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>

            {/* Google */}
            <Button
              variant="outline"
              className="w-full rounded-xl"
              onClick={registerWithGoogle}
            >
              <svg
                className="w-4 h-4 mr-2"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 488 512"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M488 261.8c0-17.8-1.6-35-4.6-51.6H249v97.7h134.5c-5.8 31.2-23.2 57.6-49.5 75.4v62h80.1c46.9-43.2 73.9-106.9 73.9-183.5z"
                />
                <path
                  fill="currentColor"
                  d="M249 492c66.6 0 122.5-22 163.4-59.9l-80.1-62c-22.2 15-50.6 23.8-83.3 23.8-63.9 0-118-43.2-137.3-101.3H29.9v63.6C70.6 438.5 153.8 492 249 492z"
                />
                <path
                  fill="currentColor"
                  d="M111.7 292.6c-4.7-14-7.3-28.9-7.3-44.2s2.6-30.2 7.3-44.2V140.6H29.9C10.8 179.7 0 223.7 0 268.4s10.8 88.7 29.9 127.8l81.8-63.6z"
                />
                <path
                  fill="currentColor"
                  d="M249 97.9c36.3 0 68.9 12.5 94.7 37l71.1-71.1C371.4 22.3 315.6 0 249 0 153.8 0 70.6 53.5 29.9 140.6l81.8 63.6C131 141.1 185.1 97.9 249 97.9z"
                />
              </svg>
              Registrarme con Google
            </Button>

            {/* Footer */}
            <div className="mt-6 text-center text-sm">
              ¿Ya tenés cuenta?{" "}
              <Link to="/login" className="underline font-medium">
                Iniciar sesión
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
