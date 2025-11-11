// src/pages/JobDetails.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  setDoc,
  deleteDoc,
  serverTimestamp,
  increment,
  addDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/firebase";
import {
  Briefcase,
  MapPin,
  Clock,
  DollarSign,
  Share2,
  Flag,
  Bookmark,
  BookmarkCheck,
  Building2,
  Phone,
  Mail,
  MessageCircle,
} from "lucide-react";
import { Card, CardContent } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/dialog";
import { Textarea } from "@/ui/textarea";
import { toast } from "sonner";

const toDateSafe = (v) => {
  if (!v) return null;
  if (v?.toDate) return v.toDate();
  if (v?.seconds) return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d) ? null : d;
};

const money = (n) =>
  typeof n === "number" ? `AR$ ${n.toLocaleString()}` : null;

export default function JobDetails() {
  const { slugOrId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [job, setJob] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isFav, setIsFav] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let found = null;
        const q1 = query(
          collection(db, "publications"),
          where("slug", "==", slugOrId),
          limit(1)
        );
        const snap1 = await getDocs(q1);
        if (!snap1.empty) {
          found = { id: snap1.docs[0].id, ...snap1.docs[0].data() };
        } else {
          const d = await getDoc(doc(db, "publications", slugOrId));
          if (d.exists()) found = { id: d.id, ...d.data() };
        }
        setJob(found);

        if (found) {
          if (auth.currentUser) {
            const favRef = doc(
              db,
              "users",
              auth.currentUser.uid,
              "favorites",
              found.id
            );
            const favSnap = await getDoc(favRef);
            setIsFav(favSnap.exists());
          }

          const qRel = query(
            collection(db, "publications"),
            where("category", "==", "empleo"),
            where("status", "==", "active"),
            limit(12)
          );
          const snapRel = await getDocs(qRel);
          const list = snapRel.docs
            .map((x) => ({ id: x.id, ...x.data() }))
            .filter((x) => x.id !== found.id)
            .filter((x) => {
              const sameLoc = found.location && x.location === found.location;
              const sameType =
                found.employment_type &&
                x.employment_type === found.employment_type;
              const sameMode =
                found.work_mode && x.work_mode === found.work_mode;
              return sameLoc || sameType || sameMode;
            })
            .slice(0, 6);
          setRelated(list);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [slugOrId]);

  const createdAt = useMemo(() => toDateSafe(job?.created_date), [job]);

  const salaryText = useMemo(() => {
    const { salary_min, salary_max, price } = job || {};
    if (salary_min && salary_max)
      return `${money(salary_min)} – ${money(salary_max)}`;
    if (salary_min) return `Desde ${money(salary_min)}`;
    if (salary_max) return `Hasta ${money(salary_max)}`;
    if (typeof price === "number") return money(price);
    return "A convenir";
  }, [job]);

  const share = async () => {
    const url = window.location.href;
    const title = job?.title || "Empleo";
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Enlace copiado");
      }
    } catch {}
  };

  const openWhatsApp = () => {
    const phone = (job?.whatsapp || job?.contact_phone || "").replace(
      /\D/g,
      ""
    );
    if (!phone) return;
    const msg = encodeURIComponent(
      `Hola, me interesa el empleo "${job?.title}"`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  const toggleFavorite = async () => {
    if (!user) {
      toast.error("Iniciá sesión para guardar favoritos");
      navigate("/login", { replace: true, state: { from: location } });
      return;
    }
    if (!job) return;
    setFavLoading(true);
    try {
      const favRef = doc(db, "users", user.uid, "favorites", job.id);
      if (isFav) {
        await deleteDoc(favRef);
        setIsFav(false);
        toast("Quitado de favoritos");
      } else {
        await setDoc(favRef, {
          publication_id: job.id,
          category: job.category || "empleo",
          title: job.title || "",
          created_at: serverTimestamp(),
        });
        setIsFav(true);
        toast.success("Guardado en favoritos");
      }
    } catch (e) {
      console.error(e);
      toast.error("No se pudo actualizar el favorito");
    } finally {
      setFavLoading(false);
    }
  };

  const submitReport = async () => {
    if (!user) {
      toast.error("Iniciá sesión para reportar");
      return;
    }
    if (!job) return;
    try {
      await addDoc(collection(db, "reports"), {
        publication_id: job.id,
        publication_title: job.title || "",
        owner_email: job.created_by || null,
        reporter_uid: user.uid,
        reporter_email: user.email,
        comment: (reportText || "").trim(),
        created_at: serverTimestamp(),
        status: "open",
      });
      try {
        await setDoc(
          doc(db, "publications", job.id),
          { reports_count: increment(1), last_report_at: serverTimestamp() },
          { merge: true }
        );
      } catch {}
      setReportOpen(false);
      setReportText("");
      toast.success("Reporte enviado");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo enviar el reporte");
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="h-8 w-64 bg-slate-200 rounded animate-pulse mb-4"></div>
        <div className="h-5 w-40 bg-slate-200 rounded animate-pulse mb-2"></div>
        <div className="h-32 w-full bg-slate-100 rounded animate-pulse"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-6xl mx-auto p-6 text-center">
        <p className="text-slate-600">
          La publicación no existe o fue eliminada.
        </p>
        <Link to="/empleos">
          <Button className="mt-4">Volver a empleos</Button>
        </Link>
      </div>
    );
  }

  const mainImage =
    Array.isArray(job.images) && job.images.length ? job.images[0] : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      {/* Imagen principal arriba (más chica y centrada) */}
      {mainImage && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className="overflow-hidden rounded-xl shadow-sm">
            <img
              src={mainImage}
              alt={job.title}
              className="w-full h-32 md:h-40 lg:h-48 object-cover object-center rounded-xl"
            />
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero */}
        <Card className="overflow-hidden border-2 border-blue-100 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-11 h-11 rounded-xl bg-blue-100 grid place-items-center">
                    <Briefcase className="w-6 h-6 text-blue-600" />
                  </div>
                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
                    {job.title}
                  </h1>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-3 text-slate-600">
                  {job.company && (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="w-4 h-4" /> {job.company}
                    </span>
                  )}
                  {job.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-4 h-4" /> {job.location}
                    </span>
                  )}
                  {toDateSafe(job.created_date) && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-4 h-4" />{" "}
                      {toDateSafe(job.created_date)?.toLocaleDateString()}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {job.employment_type && (
                    <Badge variant="secondary" className="rounded-full">
                      {(job.employment_type || "").replace(/\b\w/g, (m) =>
                        m.toUpperCase()
                      )}
                    </Badge>
                  )}
                  {job.work_mode && (
                    <Badge variant="outline" className="rounded-full">
                      {job.work_mode === "remote"
                        ? "Remoto"
                        : job.work_mode === "hybrid"
                        ? "Híbrido"
                        : "Presencial"}
                    </Badge>
                  )}
                  <Badge className="bg-green-600">
                    <DollarSign className="w-3 h-3 mr-1" /> {salaryText}
                  </Badge>
                  {isFav && <Badge className="bg-blue-600">★ Favorito</Badge>}
                </div>
              </div>

              {/* Acciones (toolbar bonito y responsivo) */}
              <div className="flex flex-col gap-3 sm:items-end w-full sm:w-auto">
                {/* Toolbar superior: compartir + favorito */}
                <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={share}
                    className="rounded-full px-4 shadow-sm hover:shadow transition-all"
                    title="Compartir"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Compartir
                  </Button>

                  <Button
                    size="sm"
                    onClick={toggleFavorite}
                    disabled={favLoading}
                    className={`rounded-full px-4 shadow-sm transition-all hover:shadow
        ${
          isFav
            ? "bg-blue-600 hover:bg-blue-700 text-white"
            : "border border-slate-200 hover:bg-slate-50"
        }`}
                    title={
                      isFav ? "Quitar de favoritos" : "Agregar a favoritos"
                    }
                  >
                    {isFav ? (
                      <BookmarkCheck className="w-4 h-4 mr-2" />
                    ) : (
                      <Bookmark className="w-4 h-4 mr-2" />
                    )}
                    Favorito
                  </Button>
                </div>

                {/* Acciones principales */}
                <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                  {(job.whatsapp || job.contact_phone) && (
                    <Button
                      onClick={openWhatsApp}
                      className="rounded-full px-5 shadow-sm bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 focus:ring-2 focus:ring-emerald-300 transition-all"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Postular por WhatsApp
                    </Button>
                  )}

                  {job.contact_email && (
                    <a
                      href={`mailto:${
                        job.contact_email
                      }?subject=${encodeURIComponent(
                        "Postulación: " + job.title
                      )}`}
                    >
                      <Button className="rounded-full px-5 shadow-sm bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-300 transition-all">
                        <Mail className="w-4 h-4 mr-2" />
                        Enviar CV
                      </Button>
                    </a>
                  )}

                  {job.contact_phone && (
                    <a href={`tel:${job.contact_phone}`}>
                      <Button
                        variant="outline"
                        className="rounded-full px-5 shadow-sm border-slate-200 hover:bg-slate-50 transition-all"
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        Llamar
                      </Button>
                    </a>
                  )}

                  {/* Reportar como link sutil */}
                  <Dialog open={reportOpen} onOpenChange={setReportOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        className="rounded-full px-4 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Flag className="w-4 h-4 mr-2" />
                        Reportar
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Reportar publicación</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <p className="text-sm text-slate-600">
                          Contanos brevemente el motivo del reporte. El dueño
                          verá este reporte en su panel.
                        </p>
                        <Textarea
                          rows={4}
                          placeholder="Ej: Información falsa, contacto no responde, contenido inapropiado, etc."
                          value={reportText}
                          onChange={(e) => setReportText(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setReportOpen(false)}
                            className="rounded-full"
                          >
                            Cancelar
                          </Button>
                          <Button
                            onClick={submitReport}
                            className="rounded-full"
                          >
                            Enviar
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Galería (si hay más imágenes) */}
        {Array.isArray(job.images) && job.images.length > 1 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {job.images.slice(1).map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`img-${i + 1}`}
                className="w-full h-48 object-cover rounded-xl border"
              />
            ))}
          </div>
        )}

        {/* Descripción + lateral */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardContent className="p-6 space-y-6">
              <section>
                <h2 className="text-lg font-semibold mb-2">Descripción</h2>
                <p className="text-slate-700 whitespace-pre-line">
                  {job.description}
                </p>
              </section>

              {(job.requirements || job.responsibilities || job.benefits) && (
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {job.requirements && (
                    <div>
                      <h3 className="font-semibold mb-1">Requisitos</h3>
                      <ul className="list-disc ml-5 text-slate-700">
                        {String(job.requirements)
                          .split("\n")
                          .map((li, i) => (
                            <li key={i}>{li}</li>
                          ))}
                      </ul>
                    </div>
                  )}
                  {job.responsibilities && (
                    <div>
                      <h3 className="font-semibold mb-1">Responsabilidades</h3>
                      <ul className="list-disc ml-5 text-slate-700">
                        {String(job.responsibilities)
                          .split("\n")
                          .map((li, i) => (
                            <li key={i}>{li}</li>
                          ))}
                      </ul>
                    </div>
                  )}
                  {job.benefits && (
                    <div>
                      <h3 className="font-semibold mb-1">Beneficios</h3>
                      <ul className="list-disc ml-5 text-slate-700">
                        {String(job.benefits)
                          .split("\n")
                          .map((li, i) => (
                            <li key={i}>{li}</li>
                          ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}
            </CardContent>
          </Card>

          {/* Caja lateral */}
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6 space-y-2">
                <h3 className="font-semibold mb-2">Contacto</h3>
                {job.company && (
                  <p className="text-slate-700">
                    <strong>Empresa:</strong> {job.company}
                  </p>
                )}
                {job.contact_email && (
                  <p className="text-slate-700">
                    <strong>Email:</strong> {job.contact_email}
                  </p>
                )}
                {job.contact_phone && (
                  <p className="text-slate-700">
                    <strong>Teléfono:</strong> {job.contact_phone}
                  </p>
                )}
                {(job.instagram || job.website) && (
                  <div className="pt-2 space-x-3">
                    {job.website && (
                      <a
                        className="underline"
                        href={job.website}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Sitio web
                      </a>
                    )}
                    {job.instagram && (
                      <a
                        className="underline"
                        href={`https://instagram.com/${job.instagram.replace(
                          /^@/,
                          ""
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Instagram
                      </a>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {related.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-3">Empleos relacionados</h3>
                  <div className="space-y-3">
                    {related.map((r) => (
                      <Link
                        key={r.id}
                        to={`/empleos/${r.slug || r.id}`}
                        className="block p-3 rounded-md hover:bg-slate-50 border"
                      >
                        <div className="font-medium text-slate-900">
                          {r.title}
                        </div>
                        <div className="text-sm text-slate-600 flex items-center gap-2">
                          <Briefcase className="w-3 h-3" />
                          {r.company || "—"} · {r.location || "Sin ubicación"}
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
