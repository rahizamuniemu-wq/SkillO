import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required for file uploads.");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function uploadMaterialFile(file: File) {
  const fileName = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;

  const { data, error } = await supabase.storage
    .from("materials")
    .upload(fileName, file);

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from("materials")
    .getPublicUrl(data.path);

  return {
    url: publicUrlData.publicUrl,
    size: `${(file.size / 1024).toFixed(1)} KB`,
    type: file.name.split(".").pop() || "doc",
    label: file.name,
    source: "supabase" as const,
  };
}
