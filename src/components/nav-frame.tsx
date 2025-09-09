"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import dynamic from "next/dynamic";

const Header = dynamic(() => import("./header"), { ssr: false });

export default function NavFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideHeader = pathname === "/signin" || pathname === "/register";
  return (
    <>
      {!hideHeader && <Header />}
      {children}
    </>
  );
}
