import Image from "next/image";

type BrandLogoProps = {
  /** Display size in CSS pixels. Defaults to 36 (nav). */
  size?: number;
  className?: string;
  /** Preload the light logo only — dark is hidden on the default theme. */
  priority?: boolean;
};

/**
 * Light + dark logo pair. Dark variant shows when `dark` is on <html>
 * (ready for a future dark-mode toggle). Uses 96px masters for crisp nav sizes.
 */
export function BrandLogo({ size = 36, className = "", priority = false }: BrandLogoProps) {
  return (
    <span
      className={`relative inline-block shrink-0 overflow-hidden rounded-[22%] ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/logo-96.png"
        alt=""
        width={size}
        height={size}
        className="block size-full dark:hidden"
        priority={priority}
      />
      <Image
        src="/logo-96-dark.png"
        alt=""
        width={size}
        height={size}
        className="hidden size-full dark:block"
      />
    </span>
  );
}
