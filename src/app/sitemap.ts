import type { MetadataRoute } from "next";

const BASE = "https://www.inboxwingman.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    "",
    "/login",
    "/features",
    "/use-cases",
    "/compare",
    "/docs",
    "/about",
    "/roadmap",
    "/contact",
    "/privacy",
    "/terms",
    "/security",
    "/dpa",
    "/subprocessors",
    "/data-request",
  ];
  return pages.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.6,
  }));
}
