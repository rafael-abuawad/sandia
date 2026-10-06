export const author = {
  name: "Rafael Abuawad",
  jobTitle: "Founder",
  bio: "Rafael Abuawad is the founder of Sandia. He is an EVM protocol engineer specializing in Vyper, DeFi, security-oriented testing, and onchain UX.",
  sameAs: "https://x.com/rabuawad_",
  image: "https://github.com/rafael-abuawad.png",
  path: "/about",
} as const;

export function authorJsonLd(pageUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: author.name,
    jobTitle: author.jobTitle,
    description: author.bio,
    image: author.image,
    sameAs: [author.sameAs],
    url: pageUrl,
  };
}
