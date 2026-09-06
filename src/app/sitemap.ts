import type { MetadataRoute } from "next";
import { ALTERNATIVES } from "@/lib/alternatives";
import { getAllArticles } from "@/lib/blog";
import { FREE_TOOLS } from "@/lib/free-tools";

const BASE = "https://www.inboxwingman.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = [
    "",
    "/features",
    "/use-cases",
    "/compare",
    "/alternatives",
    "/docs",
    "/about",
    "/roadmap",
    "/contact",
    "/privacy",
    "/terms",
    "/refund",
    "/security",
    "/security/secrets",
    "/dpa",
    "/subprocessors",
    "/data-request",
    "/blog",
    "/tools",
    "/llms.txt",
    "/llms-full.txt",
  ];

  const staticEntries: MetadataRoute.Sitemap = pages.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.6,
  }));

  const articleEntries: MetadataRoute.Sitemap = (await getAllArticles()).map((a) => ({
    url: `${BASE}/blog/${a.slug}`,
    lastModified: new Date((a.updated ?? a.date) + "T00:00:00Z"),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const toolEntries: MetadataRoute.Sitemap = FREE_TOOLS.map((t) => ({
    url: `${BASE}/tools/${t.slug}`,
    lastModified: new Date((t.updated ?? t.date) + "T00:00:00Z"),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const alternativeEntries: MetadataRoute.Sitemap = ALTERNATIVES.map((a) => ({
    url: `${BASE}/alternatives/${a.slug}`,
    lastModified: new Date((a.updated ?? a.date) + "T00:00:00Z"),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...staticEntries, ...articleEntries, ...toolEntries, ...alternativeEntries];
}
