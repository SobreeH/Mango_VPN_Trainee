/// <reference types="vite/client" />

interface MangoRuntimeEnv {
  VITE_API_URL?: string;
  VITE_AGENT_URL?: string;
}

interface Window {
  __MANGO_ENV__?: MangoRuntimeEnv;
}
