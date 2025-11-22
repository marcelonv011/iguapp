// src/pages/Login.jsx
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth, db } from "@/firebase";
import { ensureUserDoc } from "@/lib/ensureUserDoc";
import { doc, getDoc } from "firebase/firestore";
import { Card, CardContent } from "@/ui/card";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { toast } from "sonner";

import { Mail, Lock, ArrowRight } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location?.state?.from?.pathname || "/";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { email: "", password: "" } });

  useEffect(() => {
    if (auth.currentUser) navigate(from, { replace: true });
  }, [navigate, from]);

  const onSubmit = async ({ email, password }) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await ensureUserDoc(cred.user);
      navigate(from, { replace: true });
    } catch (e) {
      if (e?.code === "auth/user-not-found") {
        toast.error(
          "No encontramos una cuenta con ese email. Si todavía no te registraste, creá tu cuenta primero."
        );
      } else if (
        e?.code === "auth/wrong-password" ||
        e?.code === "auth/invalid-credential"
      ) {
        toast.error("Email o contraseña incorrectos.");
      } else {
        console.error(e);
        toast.error("No se pudo iniciar sesión. Intentá de nuevo.");
      }
    }
  };

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const user = cred.user;

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        await auth.signOut();
        toast.error(
          "Para usar Google por primera vez, primero completá el registro y aceptá los Términos."
        );
        navigate("/registro", { state: { from } });
        return;
      }

      await ensureUserDoc(user);
      navigate(from, { replace: true });
    } catch (e) {
      console.error(e);
      toast.error("No se pudo iniciar sesión con Google. Intentá de nuevo.");
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
      {/* Fondo */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(900px_400px_at_-10%_-10%,#dbeafe_0%,transparent_60%),radial-gradient(900px_400px_at_110%_10%,#e9d5ff_0%,transparent_60%)]" />
      <div className="absolute right-[-10%] bottom-[-30%] w-[520px] h-[520px] rounded-full bg-indigo-500/10 blur-3xl -z-10" />

      {/* Contenedor central */}
      <div className="w-full max-w-xl px-4">
        <Card className="w-full max-w-sm mx-auto border-0 shadow-xl backdrop-blur bg-white/90 rounded-2xl">
          <CardContent className="p-6 sm:p-8">
            {/* Header con logo dentro del Card (sin fondo alrededor) */}
            <div className="flex flex-col items-center text-center mb-6">
              <img
                src="/conectcity-logo.png"
                alt="ConectCity"
                className="
                  w-40 h-40
                  sm:w-40 sm:h-40
                  object-contain
                  drop-shadow-[0_8px_20px_rgba(59,130,246,0.45)]
                  animate-[pulse_3s_ease-in-out_infinite]
                "
              />

              <h1 className="mt-3 text-2xl font-extrabold text-slate-900 tracking-tight">
                ConectCity
              </h1>

              <p className="text-slate-600 font-medium -mt-1">
                Tu ciudad en un solo lugar
              </p>
            </div>

            {/* Título del formulario */}
            <div className="mb-5 text-left">
              <h2 className="text-xl font-bold text-slate-900">
                Ingresá a tu cuenta
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Publicá empleos, alquileres y más.
              </p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                      minLength: {
                        value: 6,
                        message: "Mínimo 6 caracteres",
                      },
                    })}
                  />
                </div>
                {errors.password && (
                  <p className="text-xs text-red-600">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <Button
                disabled={isSubmitting}
                className="w-full rounded-xl mt-2 bg-slate-900 hover:bg-slate-800"
              >
                {isSubmitting ? "Ingresando..." : "Ingresar"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>

            {/* Separador */}
            <div className="flex items-center gap-3 my-6">
              <div className="h-px bg-slate-200 flex-1" />
              <span className="text-xs text-slate-500">o</span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>

            {/* Google */}
            <Button
              variant="outline"
              className="w-full rounded-xl border-slate-200 bg-white/60 hover:bg-slate-50"
              onClick={loginWithGoogle}
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
              Continuar con Google
            </Button>

            {/* Footer */}
            <div className="mt-6 text-center text-sm">
              ¿No tenés cuenta?{" "}
              <Link to="/registro" className="underline font-medium">
                Crear cuenta
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
