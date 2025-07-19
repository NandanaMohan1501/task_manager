import './globals.css'

export const metadata = {
  title: 'Task Manager',
  description: 'Simple task management app',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}