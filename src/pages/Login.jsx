import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/firebase";
import { ensureUserDoc } from "@/lib/ensureUserDoc"; // ⬅️ importar helper
import { Card, CardContent } from "@/ui/card";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location?.state?.from?.pathname || "/";

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (auth.currentUser) navigate(from, { replace: true });
  }, [navigate, from]);

  const onSubmit = async ({ email, password }) => {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserDoc(cred.user); // ✅ también guardará el número si existe
    navigate(from, { replace: true });
  } catch (e) {
    alert(e?.message || "No se pudo iniciar sesión");
  }
};

  const loginWithGoogle = async () => {
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      await ensureUserDoc(cred.user);           // ⬅️ asegura /users/{uid}
      navigate(from, { replace: true });
    } catch (e) {
      alert(e?.message || "Error con Google");
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-b from-background to-muted/30 p-4">
      <Card className="w-full max-w-sm border-0 shadow-lg">
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold mb-1">Ingresá a tu cuenta</h1>
          <p className="text-sm text-muted-foreground mb-5">Publicá empleos, alquileres y más.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                {...register("email", { required: "Email requerido" })}
              />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register("password", {
                  required: "Contraseña requerida",
                  minLength: { value: 6, message: "Mínimo 6 caracteres" },
                })}
              />
              {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
            </div>
            <Button disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>

          <div className="mt-4">
            <Button variant="outline" className="w-full" onClick={loginWithGoogle}>
              Continuar con Google
            </Button>
          </div>

          <div className="mt-6 text-center text-sm">
            ¿No tenés cuenta? <Link to="/registro" className="underline">Crear cuenta</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
