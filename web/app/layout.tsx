import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SoulClaw",
  description: "Your AI soul, on-chain forever.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistMono.variable} font-mono antialiased bg-black text-white min-h-screen`}>
        <Providers>
          <nav className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
            <a href="/" className="text-xl font-bold tracking-wider text-violet-400">
              SOULCLAW
            </a>
            <div className="flex items-center gap-6">
              <a href="/backup" className="text-sm text-zinc-400 hover:text-white transition-colors">
                Backup
              </a>
              <a href="/restore" className="text-sm text-zinc-400 hover:text-white transition-colors">
                Restore
              </a>
              <a href="/my-souls" className="text-sm text-zinc-400 hover:text-white transition-colors">
                My Souls
              </a>
            </div>
          </nav>
          <main className="max-w-4xl mx-auto px-6 py-12">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
