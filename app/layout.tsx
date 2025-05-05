import './globals.css';

export const metadata = {
  title: 'Lora - AI Assistant',
  description: 'Your personal AI assistant',
  icons: {
    // Leave this empty to prevent Next.js from looking for a favicon in the app directory
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  );
}
