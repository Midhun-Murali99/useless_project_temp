import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Doomsday | Object Doom Predictor",
  description: "Predict the inevitable doom of everyday objects.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
