import React from "react";
import DashboardNav from "@/components/DashboardNav";
import DashboardAuthGuard from "@/components/DashboardAuthGuard";
import VisionXLogo from "@/components/VisionXLogo";

export const metadata = {
  title: "Vision X • Surveillance Intelligence Platform",
  description: "Automated Number Plate Recognition, CCTV Timeline Spotting & Transit Intelligence",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardAuthGuard>
      <div className="min-h-screen bg-[#FAFAFA] text-[#000000] font-sans selection:bg-black selection:text-white flex flex-col justify-between">
        <div>
          <DashboardNav />
          {children}
        </div>

        {/* ─────── Footer from Landing Page ─────── */}
        <footer className="border-t border-black/10 py-8 px-6 bg-white mt-20">
          <div
            className="wrap max-w-7xl mx-auto"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <VisionXLogo size="sm" />
              <span className="text-xs font-mono text-[#5E5E59]">
                ADVANCED MOBILITY &amp; ROADWAY INTELLIGENCE
              </span>
            </div>
          </div>
        </footer>
      </div>
    </DashboardAuthGuard>
  );
}
