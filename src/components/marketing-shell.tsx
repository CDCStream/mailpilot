import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function MarketingShell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-full flex-col bg-white">
      <SiteHeader ctaHref="/login" ctaLabel="Get started" />
      <main
        className={`mx-auto w-full flex-1 px-6 py-14 ${wide ? "max-w-5xl" : "max-w-2xl"}`}
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
