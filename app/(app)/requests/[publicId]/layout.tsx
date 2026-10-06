import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

type RequestLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ publicId: string }>;
};

export async function generateMetadata({ params }: RequestLayoutProps): Promise<Metadata> {
  const { publicId } = await params;
  return pageMetadata({
    title: "Payment request",
    description: "A payment request you created in Sandia.",
    path: `/requests/${publicId}`,
    index: false,
  });
}

export default function RequestLayout({ children }: RequestLayoutProps) {
  return children;
}
