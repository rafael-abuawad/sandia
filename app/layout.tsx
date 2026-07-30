import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { IBM_Plex_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";
import "./globals.css";

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Payrequest",
  description:
    "Create USD payment requests and receive stablecoins on Robinhood Chain via Across Protocol.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jar = await cookies();
  const initialSessionToken = jar.get(SESSION_COOKIE_NAME)?.value ?? null;

  return (
    <html lang="en" className={`${mono.variable} h-full`}>
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&f[]=clash-display@500,600,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <Providers initialSessionToken={initialSessionToken}>{children}</Providers>
      </body>
    </html>
  );
}
