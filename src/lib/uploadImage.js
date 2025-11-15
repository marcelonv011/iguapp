export async function uploadToCloudinary(file) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const preset = import.meta.env.VITE_CLOUDINARY_UNSIGNED_PRESET;

  if (!cloudName || !preset) {
    throw new Error("Faltan variables VITE_CLOUDINARY_* en .env");
  }

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", preset);

  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cloudinary error: ${err}`);
  }
  const data = await res.json();
  // data.secure_url = URL https definitiva
  return data.secure_url;
}

