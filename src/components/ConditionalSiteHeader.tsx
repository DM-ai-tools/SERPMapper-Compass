"use client";

import { usePathname } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";

/**
 * Hides the global marketing header on full-screen Compass report views so the
 * report can carry its own Traffic Radius + Compass chrome (matches Figma / screenshots).
 */
export default function ConditionalSiteHeader() {
  const pathname = usePathname();
  if (pathname === "/tool" || (pathname && pathname.startsWith("/report/"))) {
    return null;
  }
  return <SiteHeader />;
}
