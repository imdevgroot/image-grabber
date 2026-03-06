import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Image Grabber — NuPeeks",
  description: "Scrape and download images from any website or Pexels",

  openGraph: {
    title: 'Image Grabber',
    description: 'Batch download images by keyword',
    url: 'https://image-grabber-nupeeks.vercel.app',
    siteName: 'Image Grabber',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Image Grabber' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Image Grabber',
    description: 'Batch download images by keyword',
    images: ['/opengraph-image'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
