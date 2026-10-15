import Link from "next/link";

/** The bridge (setu) mark: an arch over a scale's beam. */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#13305c" />
      <path d="M6 21c3.2-6.4 6.5-9.6 10-9.6s6.8 3.2 10 9.6" stroke="#e8963c" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M6 21h20M10 21v-3.2M16 21v-6.4M22 21v-3.2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function Logo({ href = "/", sub }: { href?: string; sub?: string }) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-2.5">
      <LogoMark />
      <span className="leading-none">
        <span className="block font-serif text-lg font-semibold tracking-tight text-ink">NyayaSetu</span>
        {sub && <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-saffron-700">{sub}</span>}
      </span>
    </Link>
  );
}
