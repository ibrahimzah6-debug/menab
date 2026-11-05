import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getI18n } from "@/lib/i18n/server";
// Fonts ship with the app, so builds never depend on downloading them.
import "@fontsource-variable/rubik";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Menab",
  description: "From brief to delivery, made with AI, shot for real, or both.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { uiLocale, dir } = await getI18n();
  const saved = (await cookies()).get("menab-theme")?.value;
  // Light is the default; each person can pick dark or follow their system in Settings.
  const theme = saved === "dark" || saved === "system" ? saved : "light";
  return (
    <html lang={uiLocale} dir={dir} data-theme={theme}>
      <body>{children}</body>
    </html>
  );
}
