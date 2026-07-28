"use client";
import { useRouter, usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Inicio", href: "/", icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
  { label: "Explorar", href: "/auctions", icon: "M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" },
  { label: "Vender", href: "/seller", icon: "M12 5v14M5 12h14", sell: true },
  { label: "Actividad", href: "/activity", icon: "M3 12h4l3 8 4-16 3 8h4" },
  { label: "Cuenta", href: "/account", icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
];

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav className="lv-nav">
      {NAV_ITEMS.map(item => {
        const active = item.href === "/"
          ? pathname === "/"
          : pathname.startsWith(item.href);

        return (
          <button
            key={item.label}
            onClick={() => router.push(item.href)}
            aria-current={active ? "page" : undefined}
            className={`lv-nav__item${active ? " lv-nav__item--active" : ""}`}
          >
            {item.sell ? (
              <span className="lv-nav__sell">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d={item.icon}/>
                </svg>
              </span>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth={active ? 2.4 : 1.9} strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon}/>
              </svg>
            )}
            <span className="lv-nav__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
