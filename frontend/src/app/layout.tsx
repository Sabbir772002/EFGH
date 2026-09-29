// Root layout — Dhaka Tesla Pool
// Sets up Outfit font, global dark styles, and page metadata.

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Dhaka Tesla Pool',
    template: '%s | Dhaka Tesla Pool',
  },
  description:
    'Real-time carpooling across Dhaka — Bijoy Sarani to Kuril Flyover. ' +
    'Book a seat, split the fare, ride smart.',
  keywords: ['dhaka', 'carpooling', 'tesla', 'pool', 'ride sharing', 'bangladesh'],
  openGraph: {
    title: 'Dhaka Tesla Pool',
    description: 'Real-time carpooling across Dhaka',
    type: 'website',
  },
};

// Root layout: wraps every page in the app.
// Font is applied via globals.css (Outfit from Google Fonts).
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
