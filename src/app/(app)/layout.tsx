import { AppFrame } from "@/components/app-frame";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppFrame>
      <main className="flex-1 min-w-0 px-6 py-8 md:px-12 md:py-10">{children}</main>
    </AppFrame>
  );
}
