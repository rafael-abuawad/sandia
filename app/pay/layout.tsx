export default function PayLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="pr-shell flex min-h-full flex-1 items-start justify-center py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:py-16"
    >
      <div className="w-full max-w-xl">{children}</div>
    </main>
  );
}
