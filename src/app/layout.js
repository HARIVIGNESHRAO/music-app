import './globals.css';

export const metadata = {
    title: 'MusicApp',
    description: 'A music streaming application',
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
        <body className="bg-gray-900 text-white">{children}</body>
        </html>
    );
}