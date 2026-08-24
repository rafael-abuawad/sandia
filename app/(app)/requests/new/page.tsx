import { CreateRequestForm } from "@/components/create-request-form";

export default function NewRequestPage() {
  return (
    <div className="pr-page">
      <h1 className="sr-only">New payment request</h1>
      <CreateRequestForm />
    </div>
  );
}
