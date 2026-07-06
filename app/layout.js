import './globals.css';
import { DataProvider } from './context';

export const metadata = {
  title: 'Smart Store - Inventory & Sales Analytics',
  description: 'Professional, real-time inventory, sales analytics, and voice AI dashboard powered by Google Sheets.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📦</text></svg>" />
      </head>
      <body>
        <DataProvider>
          {children}
        </DataProvider>
      </body>
    </html>
  );
}
