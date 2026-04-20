import type {Metadata} from 'next';
import { Orbitron, Rajdhani } from 'next/font/google';
import './globals.css';

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
  weight: ['400', '700'],
});

const rajdhani = Rajdhani({
  subsets: ['latin'],
  variable: '--font-rajdhani',
  weight: ['300', '500', '700'],
});

export const metadata: Metadata = {
  title: 'SNR-MART | Amazon-nya Blockchain Indonesia',
  description: 'SNR-MART | Amazon-nya Blockchain Indonesia',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="id" className={`${orbitron.variable} ${rajdhani.variable}`}>
      <body className="font-rajdhani text-white min-h-screen relative tracking-wide bg-[radial-gradient(circle_at_50%_50%,_#151515_0%,_#050505_100%)]" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
