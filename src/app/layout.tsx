import type { Metadata } from "next";
import { JetBrains_Mono, Rubik } from "next/font/google";
import { getI18n } from "@/lib/i18n/server";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin", "arabic"],
  weight: ["400", "500", "600"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Menab",
  description: "From brief to delivery, made with AI, shot for real, or both.",
  icons: { icon: "/brand/menab-mark-ink.png" },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale, dir } = await getI18n();
  return (
    <html lang={locale} dir={dir} data-theme="light" className={`${rubik.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
