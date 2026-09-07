/** Public support address. Keep in one place so Cloudflare email_off wraps every render. */
export const SUPPORT_EMAIL = "support@inboxwingman.com";

/**
 * Cloudflare Scrape Shield rewrites bare emails / mailto into
 * `/cdn-cgi/l/email-protection` (a 404). Ahrefs then flags every legal page.
 * `<!--email_off-->` is Cloudflare's documented opt-out.
 */
export function SupportEmail({
  className = "underline",
  link = true,
}: {
  className?: string;
  link?: boolean;
}) {
  const safeClass = className.replace(/[^a-zA-Z0-9 _:-]/g, "");
  const inner = link
    ? `<a href="mailto:${SUPPORT_EMAIL}" class="${safeClass}">${SUPPORT_EMAIL}</a>`
    : SUPPORT_EMAIL;
  return (
    <span
      dangerouslySetInnerHTML={{
        __html: `<!--email_off-->${inner}<!--/email_off-->`,
      }}
    />
  );
}
