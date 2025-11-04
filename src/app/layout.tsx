import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NotificationProvider } from "@/contexts/NotificationContext";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "KPS System",
  description: "Pest Control Management System",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KPS System",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/icons/180.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/167.png", sizes: "167x167", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#8b5cf6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="KPS System" />
        
        {/* Apple Touch Icons */}
        <link rel="apple-touch-icon" href="/icons/180.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/152.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/167.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/180.png" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ServiceWorkerRegistration />
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </body>
    </html>
  );
}
