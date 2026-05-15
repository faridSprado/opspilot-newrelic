import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/components/providers/query-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';

export const metadata: Metadata = {
  title: 'OpsPilot for New Relic',
  description: 'Copiloto premium en español para APM, NRQL, investigaciones y analítica visual segura en New Relic.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var storedTheme = localStorage.getItem('opspilot-theme');
                var preferredTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
                var theme = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : preferredTheme;
                document.documentElement.classList.toggle('dark', theme === 'dark');
                document.documentElement.classList.toggle('light', theme === 'light');
                document.documentElement.style.colorScheme = theme;
              } catch (_) {}
            `
          }}
        />
        <ThemeProvider>
          <QueryProvider>{children}</QueryProvider>
          <ThemeToggle />
        </ThemeProvider>
      </body>
    </html>
  );
}
