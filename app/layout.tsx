import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Innovasense Real Estate AI',
  description: 'AI-powered real estate assistant',
  manifest: '/manifest.json',
  themeColor: '#9966FF',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Innovasense'
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  icons: {
    icon: '/icons/InnovaSense_Logo_Icon_Final.png',
    shortcut: '/icons/InnovaSense_Logo_Icon_Final.png',
    apple: '/icons/InnovaSense_Logo_Icon_Final.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="application-name" content="Innovasense" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Innovasense" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/icons/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#9966FF" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#9966FF" />

        <link rel="apple-touch-icon" href="/icons/InnovaSense_Logo_Icon_Final.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/InnovaSense_Logo_Icon_Final.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/InnovaSense_Logo_Icon_Final.png" />
        <link rel="mask-icon" href="/icons/InnovaSense_Logo_Icon_Final.png" color="#9966FF" />
        <link rel="shortcut icon" href="/icons/InnovaSense_Logo_Icon_Final.png" />
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
