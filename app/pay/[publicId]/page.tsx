"use client";

import { use } from "react";
import { PayFlow } from "@/components/pay-flow";

export default function PayPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = use(params);
  return <PayFlow publicId={publicId} />;
}
