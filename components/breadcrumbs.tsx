import Link from "next/link";
import { jsonLdScript, siteOrigin } from "@/lib/seo";

export type BreadcrumbItem = {
  href: string;
  label: string;
};

export function stockBreadcrumbItems(symbol?: string): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [
    { href: "/", label: "Home" },
    { href: "/stocks", label: "Stocks" },
  ];
  if (symbol) {
    items.push({ href: `/stocks/${encodeURIComponent(symbol)}`, label: symbol });
  }
  return items;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const origin = siteOrigin();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: new URL(item.href, origin).toString(),
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.href}-${item.label}`} className="flex items-center gap-2">
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {last ? (
                <span className="text-foreground" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="underline-offset-2 hover:text-foreground hover:underline"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
    </nav>
  );
}
