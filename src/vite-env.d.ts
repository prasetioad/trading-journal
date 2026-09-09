/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional — set in .env.local for DEV-ONLY direct browser calls to Claude.
   *  Production runs the AI batch from a Supabase Edge Function instead. */
  readonly VITE_ANTHROPIC_API_KEY?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
