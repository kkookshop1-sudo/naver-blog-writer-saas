import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Naver Blog Writer",
  description: "네이버 SEO 블로그 글과 해시태그를 생성하는 SaaS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
