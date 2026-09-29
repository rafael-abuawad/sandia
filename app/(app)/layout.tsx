import { AppChrome } from "@/components/app-chrome";
import { PrivyAppProviders } from "@/components/providers-privy";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PrivyAppProviders>
      <AppChrome>{children}</AppChrome>
    </PrivyAppProviders>
  );
}
