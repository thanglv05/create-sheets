import './globals.css';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { ColorSchemeScript, MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { Inter } from 'next/font/google';
import type { Metadata } from 'next';

const inter = Inter({ subsets: ['latin', 'vietnamese'] });

export const metadata: Metadata = {
  title: 'Auto Sheet Automation',
  description: 'Auto Sheet Google Sheets Automation System',
};

const theme = createTheme({
  fontFamily: inter.style.fontFamily,
  primaryColor: 'indigo',
  defaultRadius: 'md',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning className={inter.className}>
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
      </head>
      <body>
        <MantineProvider defaultColorScheme="dark" theme={theme}>
          <Notifications position="bottom-right" zIndex={1000} />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
