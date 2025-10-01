import './globals.css';

export const metadata = {
    title: 'MusicApp',
    description: 'A music streaming application',
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
        <head>
            <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
        </head>
        <body className="bg-gray-900 text-white">{children}</body>
        </html>
    );
}
