"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import VisionXLogo from "@/components/VisionXLogo";
import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/context/AuthContext";
import { LogOut, LayoutDashboard } from "lucide-react";

type RekorNavProps = {
  theme?: "light" | "dark";
};

export default function RekorNav({ theme = "light" }: RekorNavProps) {
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
              <div className="rekor-auth-user-bar">
                <Link
                  href="/dashboard"
                  className="rekor-launch-btn"
                  title="Open Surveillance Command Dashboard"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
                  <span>DASHBOARD</span>
                  <span className="launch-arrow" aria-hidden="true">→</span>
                </Link>

                <div className="rekor-user-pill" title={officer?.email || user?.email || "Operator Session"}>
                  <span className="user-online-dot" />
                  <span className="user-agency-tag">{officer?.badgeId || "OFFICER"}</span>
                </div>

                <button
                  type="button"
                  className="rekor-signout-btn"
                  onClick={() => signOut()}
                  title="Sign out of operator session"
                  aria-label="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
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
                <div className="rekor-auth-mobile-bar">
                  <div className="rekor-user-pill mobile-full">
                    <span className="user-online-dot" />
                    <span className="user-agency-tag">{officer?.badgeId || "OFFICER"} · ONLINE</span>
                  </div>
                  <Link
                    href="/dashboard"
                    className="rekor-launch-btn mobile-full"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <LayoutDashboard className="w-4 h-4 text-emerald-400" />
                    <span>OPEN DASHBOARD →</span>
                  </Link>
                  <button
                    type="button"
                    className="rekor-signout-btn mobile-full"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      signOut();
                    }}
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out ({officer?.badgeId || "Officer"})</span>
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
