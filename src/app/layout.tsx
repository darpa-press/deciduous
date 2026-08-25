import type { Metadata } from "next";
import "./globals.css";
import { Search } from "@/components/Search";
import { LoginLink } from "@/components/LoginLink";
import { PaneTitleSync } from "@/components/PaneTitleSync";

export const metadata: Metadata = {
    // The legacy app set this via react-helmet in App.js; per-piece titles are
    // composed in the pane route once it lands.
    title: "Deciduous",
    description: "A framework for online codices of artwork.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html lang="en" className="h-full">
            <body className="h-full">
                {children}
                <Search />
                <LoginLink loggedIn={false} />
                <PaneTitleSync />
            </body>
        </html>
    );
}
