import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
// Fonts ship with the app, so builds never depend on downloading them.
import "@fontsource-variable/rubik";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Menab",
  description: "From brief to delivery, made with AI, shot for real, or both.",
  icons: { icon: "/brand/menab-mark-ink.png" },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale, dir } = await getI18n();
  return (
    <html lang={locale} dir={dir} data-theme="light">
      <body>{children}</body>
    </html>
  );
}
