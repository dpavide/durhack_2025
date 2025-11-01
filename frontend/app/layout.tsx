export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-zinc-50 flex justify-center items-center min-h-screen">
        {children}
      </body>
    </html>
  );
}
