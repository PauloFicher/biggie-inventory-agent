import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Biggie Inventory Agent | AI Automation',
  description: 'Agente de IA para gestion inteligente de inventario en Biggie (Grupo Azeta)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
