import type { Metadata, Viewport } from "next"
import { Space_Grotesk, DM_Sans, Geist_Mono } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { RegisterSW } from "@/components/pwa/register-sw"
import { APP_NAME } from "@/lib/app-config"
import "./globals.css"

const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] })
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Built by Sequential Analytics LLC",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sequential lime accent — update theme-color per project */}
        <meta name="theme-color" content="#0a0a0a" />
        {/* Add favicon files to /public/icons/ per project */}
      </head>
      <body className={`${spaceGrotesk.variable} ${dmSans.variable} ${geistMono.variable} font-[family-name:var(--font-dm-sans)] antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          {children}
          <RegisterSW />
        </ThemeProvider>
      </body>
    </html>
  )
}
