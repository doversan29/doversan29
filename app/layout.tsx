import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { Suspense } from "react";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "BetPredict Pro",
  description: "AI-Powered Sports Predictions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans bg-slate-950 text-slate-200 h-screen overflow-hidden flex`}>
        <Suspense fallback={<div className="w-64 bg-slate-900 border-r border-slate-800" />}>
          <Sidebar />
        </Suspense>
        <div className="flex-1 flex flex-col h-full relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 pointer-events-none" />
          <TopBar />
          <main className="flex-1 overflow-y-auto relative z-10 p-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
