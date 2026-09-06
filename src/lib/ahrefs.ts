export const AHREFS_KEY = process.env.NEXT_PUBLIC_AHREFS_KEY || "3x1DvUrthpB4QAyR77MYiQ";

/** Inject Ahrefs Web Analytics after consent. Must be a real script node so
 *  analytics.js can read `data-key` from `document.currentScript`. */
export function loadAhrefs(): void {
  if (typeof document === "undefined" || !AHREFS_KEY) return;
  if (document.querySelector("script[data-ahrefs='1']")) return;
  const script = document.createElement("script");
  script.src = "https://analytics.ahrefs.com/analytics.js";
  script.async = true;
  script.dataset.key = AHREFS_KEY;
  script.dataset.ahrefs = "1";
  document.body.appendChild(script);
}
