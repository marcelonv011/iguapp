import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/firebase";

export async function fetchFeaturedPublications() {
  const ref = collection(db, "publications");
  const q = query(ref,
    where("featured", "==", true),
    where("status", "==", "active"),
    orderBy("created_date", "desc"),
    limit(6)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchFeaturedRestaurants() {
  const ref = collection(db, "restaurants");
  const q = query(ref,
    where("is_open", "==", true),
    orderBy("rating", "desc"),
    limit(4)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
