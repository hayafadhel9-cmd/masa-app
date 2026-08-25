import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "Held — Downtown & DIFC reservations",
  description: "Book fine-dining tables in Downtown Dubai & DIFC, held with a no-show guarantee.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-sand">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
