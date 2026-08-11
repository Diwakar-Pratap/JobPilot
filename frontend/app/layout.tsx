import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'JobPilot — AI-Powered Job Application Platform',
  description: 'Your autonomous AI career assistant. Find, match, and apply to jobs automatically with AI.',
  keywords: 'job search, AI job application, automated apply, career platform, resume parsing',
  authors: [{ name: 'JobPilot' }],
  openGraph: {
    title: 'JobPilot — AI-Powered Job Application Platform',
    description: 'Your autonomous AI career assistant that finds, matches, and applies to jobs automatically.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
