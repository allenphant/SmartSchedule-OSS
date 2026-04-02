import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'SmartSchedule - 智能排班系統',
    description: '多店面排班管理系統',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="zh-TW">
            <body>{children}</body>
        </html>
    );
}
