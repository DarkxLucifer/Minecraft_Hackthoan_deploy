"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import VisionXLogo from "@/components/VisionXLogo";
import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/context/AuthContext";
import { LogOut, LayoutDashboard } from "lucide-react";

type RekorNavProps = {
  theme?: "light" | "dark";
};

export default function RekorNav({ theme = "light" }: RekorNavProps) {
  const router = useRouter();
  const { user, officer, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close menus on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
        setContactOpen(false);
        setAuthOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.warn("Sign out warning:", err);
    }
    router.push("/");
    router.refresh();
  };

  const isAuthenticated = Boolean(user || officer);

  return (
    <>
      <nav
        className={`rekor-navbar theme-${theme} ${scrolled ? "scrolled" : ""}`}
        aria-label="Main Navigation"
      >
        <div className="rekor-nav-container">
          {/* Logo */}
          <Link href="/" className="rekor-brand-link" aria-label="VisionX Home">
            <VisionXLogo size="md" />
          </Link>

          {/* Center Navigation Links */}
          <div className="rekor-nav-menu desktop-only">
            <a href="#about" className="rekor-nav-link">
              About
            </a>
            <a href="#demo" className="rekor-nav-link">
              Solutions
            </a>
            <a href="#pipeline" className="rekor-nav-link">
              Pipeline
            </a>
          </div>

          {/* Right Action Buttons */}
          <div className="rekor-nav-actions">
            {isAuthenticated ? (
              <div className="rekor-auth-user-bar flex items-center gap-2 sm:gap-3">
                <Link
                  href="/dashboard"
                  className="rekor-launch-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-black text-white text-[11px] sm:text-xs font-bold tracking-wider hover:bg-neutral-800 transition-all shadow-sm"
                  title="Open Surveillance Command Dashboard"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
                  <span>DASHBOARD</span>
                  <span className="text-emerald-400" aria-hidden="true">→</span>
                </Link>

                <button
                  type="button"
                  className="rekor-signout-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white hover:bg-rose-50 text-neutral-600 hover:text-rose-600 border border-neutral-200 hover:border-rose-300 text-[11px] sm:text-xs font-bold tracking-wider uppercase transition-all cursor-pointer shadow-xs"
                  onClick={handleSignOut}
                  title="Sign out of operator session"
                  aria-label="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-500" />
                  <span>SIGN OUT</span>
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="rekor-contact-btn"
                  onClick={() => setContactOpen(true)}
                >
                  Contact
                </button>

                {/* Launch VisionX Button */}
                <button
                  type="button"
                  className="rekor-launch-btn"
                  onClick={() => setAuthOpen(true)}
                  aria-label="Launch VisionX Platform"
                >
                  <span>LAUNCH VISIONX</span>
                  <span className="launch-arrow" aria-hidden="true">→</span>
                </button>
              </>
            )}

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              className="rekor-mobile-toggle mobile-only"
              aria-label="Toggle mobile menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((v) => !v)}
            >
              <span className={`bar ${mobileMenuOpen ? "open" : ""}`} />
              <span className={`bar ${mobileMenuOpen ? "open" : ""}`} />
            </button>
          </div>
        </div>

        {/* Mobile Slide-down Menu */}
        {mobileMenuOpen && (
          <div className="rekor-mobile-drawer">
            <div className="rekor-mobile-links">
              <a href="#about" onClick={() => setMobileMenuOpen(false)}>About</a>
              <a href="#demo" onClick={() => setMobileMenuOpen(false)}>Solutions</a>
              <a href="#pipeline" onClick={() => setMobileMenuOpen(false)}>Pipeline</a>
              {isAuthenticated ? (
                <div className="rekor-auth-mobile-bar flex flex-col gap-2.5 pt-3 border-t border-neutral-200">
                  <Link
                    href="/dashboard"
                    className="w-full py-3 px-4 rounded-full bg-black text-white text-xs font-bold tracking-wider flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <LayoutDashboard className="w-4 h-4 text-emerald-400" />
                    <span>OPEN DASHBOARD →</span>
                  </Link>
                  <button
                    type="button"
                    className="w-full py-2.5 px-4 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold tracking-wider flex items-center justify-center gap-2 cursor-pointer hover:bg-rose-100 transition-colors"
                    onClick={async () => {
                      setMobileMenuOpen(false);
                      await handleSignOut();
                    }}
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>SIGN OUT</span>
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="rekor-launch-btn mobile-full"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setAuthOpen(true);
                    }}
                  >
                    LAUNCH VISIONX →
                  </button>
                  <button
                    type="button"
                    className="rekor-contact-btn mobile-full"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setContactOpen(true);
                    }}
                  >
                    Contact Us
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Auth Modal (Login / Sign Up) */}
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />

      {/* Contact / Book Demo Modal */}
      {contactOpen && (
        <div className="rekor-contact-modal-overlay" onClick={() => setContactOpen(false)}>
          <div
            className="rekor-contact-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="contact-title"
          >
            <div className="contact-modal-head">
              <div>
                <span className="contact-kicker">VISIONX MOBILITY INTELLIGENCE</span>
                <h3 id="contact-title">Connect with VisionX Intelligence Experts</h3>
              </div>
              <button
                type="button"
                className="contact-close-btn"
                onClick={() => setContactOpen(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <form
              className="contact-form"
              onSubmit={(e) => {
                e.preventDefault();
                alert("Thank you. A VisionX solutions architect will contact your agency within 24 hours.");
                setContactOpen(false);
              }}
            >
              <div className="form-group">
                <label htmlFor="contact-name">Full Name</label>
                <input id="contact-name" type="text" required placeholder="Officer / Director Name" />
              </div>

              <div className="form-group">
                <label htmlFor="contact-email">Agency Email</label>
                <input id="contact-email" type="email" required placeholder="name@agency.gov.in" />
              </div>

              <div className="form-group">
                <label htmlFor="contact-agency">Department / Municipality</label>
                <input id="contact-agency" type="text" required placeholder="e.g. Delhi Traffic Police / NHAI" />
              </div>

              <div className="form-group">
                <label htmlFor="contact-use-case">Primary Operational Objective</label>
                <select id="contact-use-case">
                  <option>Multi-Camera ANPR & Trajectory Tracking</option>
                  <option>Highway Speed & Bottleneck Heatmap</option>
                  <option>Watchlist & Stolen Vehicle Hotlist Alerting</option>
                  <option>Pilot Demonstration (Hackathon / Proof of Concept)</option>
                </select>
              </div>

              <button type="submit" className="contact-submit-btn">
                REQUEST MISSION BRIEFING →
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
