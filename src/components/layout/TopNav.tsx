import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronDown,
  Search,
  Bell,
  Menu,
  X,
} from "lucide-react";

export const TopNav: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { label: "Overview", href: "/", hasDropdown: false },
    { label: "Live Interview", href: "/interview/session-001", hasDropdown: false },
    { label: "Reports & History", href: "/sessions", hasDropdown: false },
  ];

  return (
    <header className="bg-navBg border-b border-border px-4 sm:px-6 py-3 w-full">
      <div className="flex items-center justify-between">
        {/* Left: Logo & Brand */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img
              src="/synterview-logo.svg"
              alt="Synterview Logo"
              className="w-7 h-7 object-contain transition-transform group-hover:scale-105"
            />
            <span className="font-bold text-lg text-textPrimary tracking-tight">
              Synterview
            </span>
          </Link>
        </div>

        {/* Center: Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-7">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.href;
            return (
              <Link
                key={link.label}
                to={link.href}
                className={`text-sm font-medium transition-colors flex items-center gap-1 ${
                  isActive
                    ? "text-primary font-semibold"
                    : "text-textSecondary hover:text-textPrimary"
                }`}
              >
                <span>{link.label}</span>
                {link.hasDropdown && (
                  <ChevronDown className="w-3.5 h-3.5 text-textSecondary/70 mt-0.5" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right: Search, Notification Badge, User Avatar */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Search Input */}
          <div className="hidden sm:flex items-center relative">
            <Search className="w-4 h-4 text-textMuted absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search..."
              className="rounded-full border border-border pl-9 pr-3 py-1.5 text-xs sm:text-sm w-36 lg:w-44 bg-gray-50/80 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary transition-all text-textPrimary placeholder:text-textMuted"
            />
          </div>

          {/* Notifications with 99+ Badge */}
          <div className="relative cursor-pointer p-1 rounded-full hover:bg-gray-100 transition-colors">
            <Bell className="w-5 h-5 text-textSecondary hover:text-textPrimary transition-colors" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.2 leading-tight shadow-sm">
              99+
            </span>
          </div>

          {/* User Profile Avatar */}
          <div className="relative group cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-primary text-white text-xs font-bold flex items-center justify-center shadow-sm ring-2 ring-white">
              TS
            </div>
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            className="md:hidden p-1 rounded-md text-textSecondary hover:text-textPrimary hover:bg-gray-100"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-3 pt-3 border-t border-border flex flex-col gap-2.5 pb-2 animate-fadeIn">
          {/* Mobile Search */}
          <div className="flex sm:hidden items-center relative mb-1">
            <Search className="w-4 h-4 text-textMuted absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full rounded-full border border-border pl-9 pr-3 py-1.5 text-xs bg-gray-50 focus:bg-white focus:outline-none"
            />
          </div>

          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-medium text-textSecondary hover:text-textPrimary py-1.5 px-2 rounded-md hover:bg-gray-50 flex items-center justify-between"
            >
              <span>{link.label}</span>
              {link.hasDropdown && <ChevronDown className="w-3.5 h-3.5" />}
            </a>
          ))}
        </div>
      )}
    </header>
  );
};
