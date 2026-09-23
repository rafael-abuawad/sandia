import { AppChrome } from "@/components/app-chrome";
import { ZerodevProviders } from "@/components/providers-zerodev";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ZerodevProviders>
      <AppChrome>{children}</AppChrome>
    </ZerodevProviders>
  );
}
