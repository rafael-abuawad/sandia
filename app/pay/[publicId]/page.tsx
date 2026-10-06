import type { Metadata } from "next";
import { PayFlow } from "@/components/pay-flow";
import { pageMetadata } from "@/lib/seo";

type PayPageProps = { params: Promise<{ publicId: string }> };

export async function generateMetadata({ params }: PayPageProps): Promise<Metadata> {
  const { publicId } = await params;
  return pageMetadata({
    title: "Pay a request",
    description: "Pay this Sandia request. USDG settles on Robinhood Chain.",
    path: `/pay/${publicId}`,
    index: false,
  });
}

export default async function PayPage({ params }: PayPageProps) {
  const { publicId } = await params;
  return <PayFlow publicId={publicId} />;
}
