"use client";

import { LanguageProvider } from "../lib/LanguageContext";

export default function Providers({ children }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}
