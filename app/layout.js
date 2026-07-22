import "./globals.css";

export const metadata = {
  title: "Masa — Downtown & DIFC reservations",
  description: "Book fine-dining tables in Downtown Dubai & DIFC, held with a no-show guarantee.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-sand">{children}</body>
    </html>
  );
}
