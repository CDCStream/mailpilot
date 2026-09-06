"use client";

import Script from "next/script";
import { ADS_ID, CONSENT_KEY, GA_ID } from "@/lib/gtag";

/**
 * Loads gtag.js with Consent Mode v2 defaults (denied until the banner).
 * Gated on public env ids so local/dev is a no-op.
 */
export function GoogleTag() {
  const primaryId = GA_ID || ADS_ID;
  if (!primaryId) return null;

  return (
    <>
      <Script
        id="gtag-src"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${primaryId}`}
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          var granted = false;
          try { granted = localStorage.getItem('${CONSENT_KEY}') === 'granted'; } catch (e) {}
          gtag('consent', 'default', {
            analytics_storage: granted ? 'granted' : 'denied',
            ad_storage: granted ? 'granted' : 'denied',
            ad_user_data: granted ? 'granted' : 'denied',
            ad_personalization: granted ? 'granted' : 'denied',
            wait_for_update: 500
          });
          gtag('js', new Date());
          ${GA_ID ? `gtag('config', '${GA_ID}', { anonymize_ip: true, send_page_view: true });` : ""}
          ${ADS_ID ? `gtag('config', '${ADS_ID}');` : ""}
        `}
      </Script>
    </>
  );
}
