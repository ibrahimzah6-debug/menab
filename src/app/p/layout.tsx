import { AppFrame } from "@/components/app-frame";

export default async function ProjectLayout({ children }: { children: React.ReactNode }) {
  return <AppFrame>{children}</AppFrame>;
}
