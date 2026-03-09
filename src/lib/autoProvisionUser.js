// src/lib/autoProvisionUser.js
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase";

const toJsDate = (v) => {
  if (!v) return null;
  if (v?.toDate) return v.toDate();
  if (v?.seconds) return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d) ? null : d;
};

const hasActiveSub = (subs = []) => {
  const now = Date.now();
  return subs.some((s) => {
    const end = toJsDate(s.end_date);
    return s.status === "active" && end && end.getTime() > now;
  });
};

export async function autoProvisionUser(user) {
    
  if (!user?.uid || !user?.email) return;

  const cfgRef = doc(db, "settings", "autoProvision");
  const userRef = doc(db, "users", user.uid);

  const [cfgSnap, userSnap] = await Promise.all([
    getDoc(cfgRef),
    getDoc(userRef),
  ]);

  const cfg = cfgSnap.exists() ? cfgSnap.data() : null;
  console.log("autoProvision cfg:", cfg);

  if (!cfg?.enabled) return;

  const userData = userSnap.exists() ? userSnap.data() : {};
  console.log("autoProvision userData:", userData);

  if (userData?.auto_provision_done) return;

  const updates = {
    updated_at: serverTimestamp(),
  };

  if (cfg.make_admin) {
    updates.role_type = "admin";
  }

  const qSubs = query(
    collection(db, "subscriptions"),
    where("user_email", "==", user.email)
  );
  const subsSnap = await getDocs(qSubs);
  const allSubs = subsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const pubSubs = allSubs.filter((s) => s.product_type === "publications");
  const restSubs = allSubs.filter((s) => s.product_type === "restaurant");

  const start = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + 1);

  if (cfg.grant_publications_month && !hasActiveSub(pubSubs)) {
    await addDoc(collection(db, "subscriptions"), {
      user_email: user.email,
      product_type: "publications",
      plan_tier: "basic",
      plan_type: "mensual",
      publications_limit: Number(cfg.publications_limit ?? 3),
      publications_used: 0,
      amount: 0,
      start_date: start,
      end_date: end,
      status: "active",
      payment_id: "auto_free_publications",
      billing_status: "trial",
      created_at: serverTimestamp(),
    });

    updates.free_publications_granted = true;
  }

  if (cfg.grant_restaurant_month && !hasActiveSub(restSubs)) {
    await addDoc(collection(db, "subscriptions"), {
      user_email: user.email,
      product_type: "restaurant",
      plan_tier: "restaurant_basic",
      plan_type: "restaurant_mensual",
      amount: 0,
      start_date: start,
      end_date: end,
      status: "active",
      payment_id: "auto_free_restaurant",
      billing_status: "trial",
      created_at: serverTimestamp(),
    });

    updates.free_restaurant_granted = true;
  }

  updates.auto_provision_done = true;

  await setDoc(userRef, updates, { merge: true });
  console.log("autoProvision aplicado");
}