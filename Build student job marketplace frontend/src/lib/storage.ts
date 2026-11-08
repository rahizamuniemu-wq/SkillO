import { createClient } from "@supabase/supabase-js";

// Lazy-init: do NOT throw at module load time. Throwing on import would crash
// the entire React tree before it mounts (blank page). Instead, we only fail
// when an upload is actually attempted and the env vars are missing.
let _client: ReturnType<typeof createClient> | null = null;
function getClient() {
  if (_client) return _client;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required for file uploads.");
  }
  _client = createClient(supabaseUrl, supabaseAnonKey);
  return _client;
}

export async function uploadMaterialFile(file: File) {
  const supabase = getClient();
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
