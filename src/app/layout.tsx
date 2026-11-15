import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Suspense } from "react";
import { Footer } from "@/components/shell/Footer";
import { Header, HeaderFallback } from "@/components/shell/Header";
import { APP_NAME } from "@/lib/brand";
import { THEME_KEY } from "@/lib/theme-key";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description:
    "Compare and harmonize MODIS and VIIRS active-fire detections from NASA FIRMS: where the two sensors agree, where only one sees a hotspot, and how each month compares with the record.",
};

const themeScript = `try{if(localStorage.getItem(${JSON.stringify(THEME_KEY)})==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark" className={poppins.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <div className="app">
          <Suspense fallback={<HeaderFallback />}>
            <Header />
          </Suspense>
          {children}
          <Footer />
        </div>
      </body>
    </html>
  );
}
