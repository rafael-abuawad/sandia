import { AppSidebar } from "@/components/app-sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row md:items-start">
      <AppSidebar />
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
