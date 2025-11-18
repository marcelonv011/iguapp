// src/lib/createReport.js
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/firebase";
import { toast } from "sonner";

export async function createReportForPublication(pub, extra = {}) {
  const user = auth.currentUser;
  if (!user) {
    toast.error("Tenés que iniciar sesión para reportar.");
    return;
  }

  const comment = window.prompt("Contanos qué está mal en esta publicación:");
  if (!comment || !comment.trim()) return;

  try {
    await addDoc(collection(db, "reports"), {
      publication_id: pub.id,
      publication_title: pub.title || "",
      owner_email: pub.created_by || pub.owner_email || null,
      reporter_uid: user.uid,
      reporter_email: user.email,
      comment: comment.trim(),
      status: "open",
      created_at: serverTimestamp(),

      // para que el SuperAdmin sepa de qué sección viene
      category: pub.category || extra.category || null,
      ...extra,
    });
    toast.success("Reporte enviado. Gracias por avisar 🙌");
  } catch (err) {
    console.error(err);
    toast.error("No se pudo enviar el reporte.");
  }
}
