import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { jsonLdScript, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Sandia",
  description:
    "Trade crypto and stock perpetuals on Hyperliquid from your phone. Get paid from any chain straight into your Hyperliquid USDC balance.",
  path: "/",
  absolute: true,
});

const homeFaqs = [
  {
    question: "Where does my money live?",
    answer:
      "In your own Hyperliquid account, as USDC. Sandia signs in with your email and creates the wallet that owns it.",
  },
  {
    question: "Do payers need a Sandia account?",
    answer:
      "No. A payer opens your payment link and pays from their own wallet on Base, Arbitrum, Ethereum, HyperEVM and other chains. Across delivers USDC to your Hyperliquid account.",
  },
  {
    question: "What can I trade?",
    answer:
      "Crypto perpetuals like BTC, ETH and SOL, and stock perpetuals like Tesla, Nvidia and Apple, long or short with leverage. All orders run on Hyperliquid.",
  },
  {
    question: "What does Sandia charge?",
    answer:
      "Hyperliquid's trading fee plus a small Sandia builder fee on each trade. Sending USDC to another Hyperliquid account is free.",
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
              Trade crypto and stocks. Get paid from any chain.
            </h1>
            <p className="pr-lede pr-animate-in pr-animate-in-delay-2">
              One USDC balance on Hyperliquid. Go long or short in two taps, send dollars for free,
              and share a link anyone can pay from their own chain.
            </p>
            <div className="pr-animate-in pr-animate-in-delay-3 flex flex-wrap gap-3 pbs-2">
              <Button asChild size="lg">
                <Link href="/trade">Start trading</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/requests/new">Get paid</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="pr-grid-3">
        {[
          {
            title: "Trade",
            body: "Crypto and stock perpetuals on Hyperliquid. Pick a market, choose long or short, set leverage, done.",
            links: [
              { href: "/trade", label: "Crypto" },
              { href: "/trade?tab=stocks", label: "Stocks" },
            ],
          },
          {
            title: "Request",
            body: "Share a USD payment link. Payers settle from their own chain and USDC lands in your Hyperliquid account.",
            links: [{ href: "/requests/new", label: "Create a request" }],
          },
          {
            title: "Send",
            body: "Send USDC to any Hyperliquid address, one person or many. Transfers are instant and free.",
            links: [{ href: "/send", label: "Send USDC" }],
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
