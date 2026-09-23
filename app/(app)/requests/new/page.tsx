import Link from "next/link";
import { CreateRequestForm } from "@/components/create-request-form";

export default function NewRequestPage() {
  return (
    <div className="pr-page">
      <div className="flex items-center justify-between gap-3">
        <h1 className="sr-only">New payment request</h1>
        <Link href="/dashboard" className="ml-auto text-sm underline underline-offset-2">
          Your requests
        </Link>
      </div>
      <CreateRequestForm />
    </div>
  );
}
