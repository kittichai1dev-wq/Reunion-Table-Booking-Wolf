import type { Metadata, Viewport } from 'next';
import { Bai_Jamjuree, IBM_Plex_Sans_Thai, IBM_Plex_Mono } from 'next/font/google';
import Nav from '@/components/Nav';
import ConfigGate from '@/components/ConfigGate';
import './globals.css';

const display = Bai_Jamjuree({ subsets: ['latin', 'thai'], weight: ['500', '600', '700'], variable: '--font-display' });
const body = IBM_Plex_Sans_Thai({ subsets: ['latin', 'thai'], weight: ['400', '500', '600'], variable: '--font-body' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['500'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'เทพศิรินทร์ Reunion',
  description: 'จองที่นั่งงานคืนสู่เหย้า โรงเรียนเทพศิรินทร์ · Group QR · เช็กอินหน้างาน',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#1b2a5c' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <div className="wrap">
          <Nav />
          <main>
            <ConfigGate>{children}</ConfigGate>
          </main>
          <footer>
            <p className="notice">
              ต้นแบบสำหรับนำเสนอ (DEMO) ไม่มีการรับชำระเงินจริง ปุ่มยืนยันชำระเงินใช้จำลองการตรวจยอดของเจ้าหน้าที่เท่านั้น
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
