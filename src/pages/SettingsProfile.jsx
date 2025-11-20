// src/pages/SettingsProfile.jsx
import React, { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  updateProfile,
  deleteUser,
  signOut,
} from "firebase/auth";
import { auth, db } from "@/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { uploadToCloudinary } from "@/lib/uploadImage";
import { useNavigate } from "react-router-dom";

import { Card, CardContent } from "@/ui/card";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea"; // por si después querés bio
import { toast } from "sonner";
import {
  Camera,
  Upload,
  Save,
  User,
  Phone,
  Trash2,
  AlertTriangle,
} from "lucide-react";

// 🔹 IMPORTAMOS EL DIALOG
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/ui/dialog";

export default function SettingsProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // estado del formulario
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState("");

  // auth + carga de perfil
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        navigate("/login");
        return;
      }
      try {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);

        // si no existe, crearlo mínimo
        if (!snap.exists()) {
          await setDoc(ref, {
            email: u.email || null,
            full_name: u.displayName || "",
            phone_number: u.phoneNumber || "",
            photo_url: u.photoURL || "",
            role_type: "usuario",
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          });
        }

        const data = (await getDoc(ref)).data();
        setDisplayName(data?.full_name || u.displayName || "");
        setPhoneNumber(data?.phone_number || u.phoneNumber || "");
        setPhotoURL(data?.photo_url || u.photoURL || "");
      } catch (e) {
        console.error(e);
        toast.error("No se pudo cargar tu perfil");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [navigate]);

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setPhotoURL(url);
      toast.success("Foto actualizada");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo subir la imagen");
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleAddPhotoByURL = () => {
    const url = photoUrlInput.trim();
    if (!url) return;
    try {
      new URL(url);
      setPhotoURL(url);
      setPhotoUrlInput("");
      toast.success("Foto actualizada desde URL");
    } catch {
      toast.error("URL inválida");
    }
  };

  const validatePhone = (v) => {
    // Validación simple: 7-20 dígitos aceptando +, espacios y guiones
    const clean = v.replace(/[^\d+]/g, "");
    return clean.length >= 7 && clean.length <= 20;
  };

  const saveChanges = async () => {
    const u = auth.currentUser;
    if (!u) return;

    if (phoneNumber && !validatePhone(phoneNumber)) {
      toast.error("Número de teléfono inválido");
      return;
    }

    setSaving(true);
    try {
      // Actualizar Auth profile
      await updateProfile(u, {
        displayName: displayName || u.displayName || "",
        photoURL: photoURL || null,
      }).catch(() => {
        /* algunos proveedores bloquean, no es crítico */
      });

      // Actualizar Firestore
      const ref = doc(db, "users", u.uid);
      await updateDoc(ref, {
        full_name: displayName || "",
        phone_number: phoneNumber || "",
        photo_url: photoURL || "",
        updated_at: serverTimestamp(),
      });

      toast.success("Datos guardados");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  // 🔹 Lógica real de borrado (sin window.confirm)
  const handleDeleteAccount = async () => {
    const u = auth.currentUser;
    if (!u) {
      toast.error("No hay usuario autenticado");
      return;
    }

    setDeleting(true);
    try {
      // 1) Borrar documento en Firestore (SIN .catch)
      const userRef = doc(db, "users", u.uid);
      await deleteDoc(userRef); // si falla, salta al catch grande

      // 2) Borrar usuario de Auth
      await deleteUser(u);

      // 3) Cerrar sesión y redirigir
      await signOut(auth).catch(() => {});
      toast.success("Tu cuenta fue eliminada correctamente");
      setDeleteDialogOpen(false);
      navigate("/"); // o "/login"
    } catch (e) {
      console.error(e);
      if (e.code === "auth/requires-recent-login") {
        toast.error(
          "Por seguridad, vuelve a iniciar sesión y luego intenta borrar la cuenta de nuevo."
        );
        setDeleteDialogOpen(false);
        navigate("/login");
      } else {
        toast.error("No se pudo eliminar la cuenta. Intenta nuevamente.");
      }
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-300 border-t-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-slate-100 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Banner */}
        <div className="bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 text-white rounded-2xl shadow mb-8">
          <div className="px-6 py-6 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur grid place-items-center">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                Configuración de cuenta
              </h1>
              <p className="text-white/80 text-sm">
                Actualizá tu nombre, teléfono y foto de perfil
              </p>
            </div>
          </div>
        </div>

        <Card className="rounded-2xl shadow-sm bg-white/90 backdrop-blur mb-6">
          <CardContent className="p-6 space-y-6">
            {/* Foto de perfil */}
            <section>
              <Label className="text-sm font-semibold mb-2 block">
                Foto de perfil
              </Label>

              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 grid place-items-center">
                  {photoURL ? (
                    <img
                      src={photoURL}
                      alt="avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8 text-slate-400" />
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <div>
                    <input
                      id="photo-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadFile}
                    />
                    <Button
                      variant="outline"
                      onClick={() =>
                        document.getElementById("photo-input").click()
                      }
                      disabled={photoUploading}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      {photoUploading ? "Subiendo..." : "Subir archivo"}
                    </Button>
                  </div>

                  <div className="flex gap-2 w-full">
                    <Input
                      placeholder="Pegar URL de imagen (https://...)"
                      value={photoUrlInput}
                      onChange={(e) => setPhotoUrlInput(e.target.value)}
                    />
                    <Button variant="outline" onClick={handleAddPhotoByURL}>
                      <Upload className="w-4 h-4 mr-2" />
                      Usar URL
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            {/* Nombre y teléfono */}
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Nombre y apellido</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                />
              </div>

              {/* Teléfono */}
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Teléfono</Label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    id="phoneNumber"
                    className="pl-9"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+54 9 3764 123456"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Colocá característica y número sin espacios ni guiones.
                </p>
              </div>
            </section>

            <div className="pt-2 flex justify-end">
              <Button onClick={saveChanges} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Zona peligrosa: borrar cuenta con modal */}
        <Card className="rounded-2xl shadow-sm bg-red-50/90 border border-red-200">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-red-100 grid place-items-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-red-700">
                  Zona peligrosa
                </h2>
                <p className="text-sm text-red-600/80">
                  Borrar tu cuenta eliminará tu usuario y datos de forma
                  permanente. Esta acción no se puede deshacer.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Dialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="destructive" disabled={deleting}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deleting ? "Eliminando..." : "Borrar cuenta"}
                  </Button>
                </DialogTrigger>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      ¿Seguro que querés borrar tu cuenta?
                    </DialogTitle>
                    <DialogDescription>
                      Esta acción es permanente y eliminará tu usuario y tus
                      datos asociados. No vas a poder recuperar la cuenta
                      después.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="mt-4 flex flex-col sm:flex-row justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setDeleteDialogOpen(false)}
                      disabled={deleting}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteAccount}
                      disabled={deleting}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {deleting ? "Eliminando..." : "Confirmar borrado"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
