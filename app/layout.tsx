import './globals.css';

export const metadata = {
  title: 'NutriLog',
  description: 'AI meal logging app',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
