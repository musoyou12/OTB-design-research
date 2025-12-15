export const ENV = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  COMFY_ENDPOINT: process.env.COMFY_ENDPOINT || "http://127.0.0.1:8188",
  ENABLE_COMFY_HTTP: process.env.ENABLE_COMFY_HTTP === "true",
  MODE: process.env.MODE || "dry"
};
