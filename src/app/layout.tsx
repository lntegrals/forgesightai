import type { Metadata } from "next";
import { Sidebar } from "@/components/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "ForgeSight AI — Manufacturing Quoting Copilot",
  description: "AI-assisted RFQ processing with deterministic pricing and full explainability",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <TooltipProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-hidden bg-background">
              {children}
            </main>
          </div>
          <Toaster richColors position="bottom-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
