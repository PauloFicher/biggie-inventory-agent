import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Biggie Inventory Agent - Grupo Azeta',
  description: 'Agente de IA para gestion de inventario en Biggie',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
