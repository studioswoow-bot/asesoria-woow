import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import AppWrapper from "@/components/layout/AppWrapper";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "WooW Studio Manager - Panel Principal",
  description: "Gestión de perfiles de modelos",
  icons: {
    icon: "/logo-studio.webp",
    shortcut: "/logo-studio.webp",
    apple: "/logo-studio.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
      </head>
      <body className={`${inter.variable} ${poppins.variable} font-sans antialiased`}>
         <AppWrapper>{children}</AppWrapper>
      </body>
    </html>
  );
}
