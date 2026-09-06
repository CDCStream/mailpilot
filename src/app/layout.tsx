import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CookieConsent } from "@/components/cookie-consent";
import { GaConversions } from "@/components/ga-conversions";
import { GoogleTag } from "@/components/google-tag";
import { PageViewTracker } from "@/components/page-view-tracker";
import { AHREFS_KEY } from "@/lib/ahrefs";
import { jsonLd, organizationLd, SITE_NAME, SITE_URL } from "@/lib/seo";
import "./globals.css";

const organizationJson = jsonLd({
  "@context": "https://schema.org",
  ...organizationLd(),
});
const websiteJson = jsonLd({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  publisher: { "@id": `${SITE_URL}/#organization` },
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.inboxwingman.com"),
  title: "Inbox Wingman — Your Gmail, triaged and drafted by AI",
  description:
    "AI email assistant for Gmail — for freelance developers and small studios. Surface clients and deadlines, quiet bots, draft in your voice. Works inside Gmail, nothing to install, never sends without you. No credit card for the 14-day trial.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-zinc-900">
        {AHREFS_KEY ? (
          // Ahrefs reads data-key from document.currentScript — must be a static tag.
          // eslint-disable-next-line @next/next/no-sync-scripts
          <script src="https://analytics.ahrefs.com/analytics.js" data-key={AHREFS_KEY} async />
        ) : null}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: organizationJson }}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: websiteJson }} />
        <GoogleTag />
        <PageViewTracker />
        <GaConversions />
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
