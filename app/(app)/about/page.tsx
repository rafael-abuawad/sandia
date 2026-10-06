import type { Metadata } from "next";
import Image from "next/image";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { author, authorJsonLd } from "@/lib/author";
import { jsonLdScript, pageMetadata, siteOrigin } from "@/lib/seo";

const pageUrl = new URL(author.path, siteOrigin()).toString();

export const metadata: Metadata = {
  ...pageMetadata({
    title: author.name,
    description: author.bio,
    path: author.path,
  }),
  authors: [{ name: author.name, url: author.sameAs }],
};

export default function AboutPage() {
  return (
    <div className="pr-page">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: author.path, label: "About" },
        ]}
      />
      <article className="flex flex-col gap-4">
        <Image
          src={author.image}
          alt={author.name}
          width={96}
          height={96}
          className="size-24 rounded-full"
          unoptimized
        />
        <div>
          <p className="pr-eyebrow">{author.jobTitle}</p>
          <h1 className="pr-display text-3xl">{author.name}</h1>
        </div>
        <p className="text-muted">{author.bio}</p>
        <a
          href={author.sameAs}
          rel="me noreferrer"
          className="text-sm text-foreground underline underline-offset-2"
        >
          {author.name} on X
        </a>
      </article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(authorJsonLd(pageUrl)) }}
      />
    </div>
  );
}
