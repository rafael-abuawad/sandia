import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { jsonLdScript, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Sandia",
  description:
    "Create a USD payment link or send USDG. Payers settle from their own chain, and USDG arrives on Robinhood Chain.",
  path: "/",
  absolute: true,
});

const homeFaqs = [
  {
    question: "Do payers need a Sandia account?",
    answer:
      "No. A payer opens the payment link and settles from their own wallet. They do not create a Sandia account.",
  },
  {
    question: "Where does the payment arrive?",
    answer: "USDG arrives on Robinhood Chain. The payer can start from another chain.",
  },
  {
    question: "When can I trade a stock token?",
    answer: "A stock trade is offered only after a live quote says that market is open.",
  },
  {
    question: "What is Earn?",
    answer: "Earn is where you deposit, withdraw, and redeem USDG.",
  },
] as const;

const homeFaqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: homeFaqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export default function HomePage() {
  return (
    <div className="pr-stack pr-page--hero mx-auto">
      <section className="pr-panel pr-panel--hero pr-home-hero pr-animate-in">
        <div className="pr-hero-layout">
          <p className="pr-eyebrow pr-animate-in">Sandia</p>
          <div className="pr-hero-logo pr-animate-in pr-animate-in-delay-2" aria-hidden="true">
            <Image
              src="/logo.svg"
              alt=""
              width={148}
              height={199}
              className="pr-hero-logo-image"
              preload
              unoptimized
            />
          </div>
          <div className="pr-hero-copy max-w-2xl space-y-6">
            <h1 className="pr-display pr-animate-in pr-animate-in-delay-1 text-3xl sm:text-5xl">
              Request dollars. Receive USDG on Robinhood Chain.
            </h1>
            <p className="pr-lede pr-animate-in pr-animate-in-delay-2">
              Create a payment link or send USDG. Switch modes from the navigation to get started.
            </p>
            <div className="pr-animate-in pr-animate-in-delay-3 flex flex-wrap gap-3 pbs-2">
              <Button asChild size="lg">
                <Link href="/requests/new">Create a request</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/send">Send USDG</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/dashboard">Your requests</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="pr-grid-3">
        {[
          {
            title: "Request",
            body: "Create a USD payment link. Payers settle from their own chain, and USDG arrives on Robinhood Chain. No Sandia account required.",
            links: [{ href: "/requests/new", label: "Create a request" }],
          },
          {
            title: "Send",
            body: "Push USDG to one recipient or a batch, with a review step before anything is sent.",
            links: [{ href: "/send", label: "Send USDG" }],
          },
          {
            title: "Stocks and earn",
            body: "Stock trades appear only after a live quote says they are open. Deposit, withdraw, and redeem USDG from Earn.",
            links: [
              { href: "/stocks", label: "Stocks" },
              { href: "/earn", label: "Earn" },
            ],
          },
        ].map((item) => (
          <div key={item.title} className="pr-feature">
            <h2 className="pr-feature-title">{item.title}</h2>
            <p>{item.body}</p>
            <div className="mbs-3 flex flex-wrap gap-x-4 gap-y-1">
              {item.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-foreground underline underline-offset-2"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-4" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="pr-display text-2xl">
          Questions
        </h2>
        <div className="space-y-4">
          {homeFaqs.map((faq) => (
            <div key={faq.question} className="pr-feature">
              <h3 className="pr-feature-title">{faq.question}</h3>
              <p>{faq.answer}</p>
            </div>
          ))}
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(homeFaqJsonLd) }}
        />
      </section>

      <footer className="text-sm text-muted">Sandia © 2026</footer>
    </div>
  );
}
