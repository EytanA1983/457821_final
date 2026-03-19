/**
 * Accessibility (a11y) Utilities
 *
 * WCAG 2.1 AA Compliance helpers:
 * - Contrast ratio calculations
 * - ARIA attribute helpers
 * - Keyboard navigation utilities
 * - Screen reader announcements
 */

/**
 * Contrast ratio calculation for WCAG compliance
 * WCAG AA requires:
 * - 4.5:1 for normal text
 * - 3:1 for large text (18pt+ or 14pt bold)
 */

// Convert hex to RGB
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Calculate relative luminance
export function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Calculate contrast ratio between two colors
export function getContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);

  if (!rgb1 || !rgb2) return 0;

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

// Check if contrast meets WCAG AA standards
export function meetsContrastAA(
  foreground: string,
  background: string,
  isLargeText = false
): boolean {
  const ratio = getContrastRatio(foreground, background);
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

// Check if contrast meets WCAG AAA standards
export function meetsContrastAAA(
  foreground: string,
  background: string,
  isLargeText = false
): boolean {
  const ratio = getContrastRatio(foreground, background);
  return isLargeText ? ratio >= 4.5 : ratio >= 7;
}

/**
 * Screen Reader Live Region Announcer
 * Creates an ARIA live region for dynamic announcements
 */
let announcer: HTMLDivElement | null = null;

export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  if (typeof document === 'undefined') return;

  // Create announcer element if it doesn't exist
  if (!announcer) {
    announcer = document.createElement('div');
    announcer.setAttribute('aria-live', priority);
    announcer.setAttribute('aria-atomic', 'true');
    announcer.setAttribute('role', 'status');
    announcer.className = 'sr-only'; // Screen reader only
    announcer.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `;
    document.body.appendChild(announcer);
  }

  // Update priority if needed
  announcer.setAttribute('aria-live', priority);

  // Clear and set message (trigger announcement)
  announcer.textContent = '';
  setTimeout(() => {
    if (announcer) announcer.textContent = message;
  }, 100);
}

/**
 * Keyboard navigation helpers
 */

// Check if key is an action key (Enter or Space)
export function isActionKey(event: React.KeyboardEvent): boolean {
  return event.key === 'Enter' || event.key === ' ';
}

// Handle keyboard activation for custom buttons
export function handleKeyboardActivation(
  event: React.KeyboardEvent,
  callback: () => void
): void {
  if (isActionKey(event)) {
    event.preventDefault();
    callback();
  }
}

// Trap focus within a container (for modals)
export function trapFocus(container: HTMLElement): () => void {
  const focusableElements = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);
  firstElement?.focus();

  // Return cleanup function
  return () => container.removeEventListener('keydown', handleKeyDown);
}

/**
 * ARIA helpers
 */

// Generate unique IDs for ARIA relationships
let idCounter = 0;
export function generateAriaId(prefix = 'aria'): string {
  return `${prefix}-${++idCounter}`;
}

// Create ARIA describedby relationship
export function createAriaDescribedBy(
  descriptions: Array<{ id: string; text: string }>
): { ids: string; elements: Array<{ id: string; text: string }> } {
  const ids = descriptions.map(d => d.id).join(' ');
  const elements = descriptions.map(d => ({
    id: d.id,
    text: d.text
  }));
  return { ids, elements };
}

/**
 * Focus management
 */

// Skip link component for keyboard users
export const SKIP_LINK_ID = 'main-content';

// Restore focus to a specific element
export function restoreFocus(element: HTMLElement | null): void {
  if (element && typeof element.focus === 'function') {
    element.focus();
  }
}

// Get the first focusable element in a container
export function getFirstFocusable(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
}

/**
 * Reduced motion preference
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Color blindness safe colors
 * These color combinations are distinguishable for most color vision deficiencies
 */
export const colorBlindSafeColors = {
  // Blue and orange (safe for most types)
  primary: '#2563EB',    // Blue
  secondary: '#F97316',  // Orange

  // For success/error states
  success: '#059669',    // Teal-green (not pure green)
  error: '#DC2626',      // Red (with additional indicators)
  warning: '#D97706',    // Amber
  info: '#2563EB',       // Blue

  // Neutral
  neutral: '#6B7280',    // Gray
};

/**
 * Validate color contrast for theme colors
 */
export function validateThemeContrast(theme: {
  background: string;
  text: string;
  primary: string;
}): {
  textOnBackground: { ratio: number; passes: boolean };
  primaryOnBackground: { ratio: number; passes: boolean };
} {
  const textRatio = getContrastRatio(theme.text, theme.background);
  const primaryRatio = getContrastRatio(theme.primary, theme.background);

  return {
    textOnBackground: {
      ratio: textRatio,
      passes: textRatio >= 4.5
    },
    primaryOnBackground: {
      ratio: primaryRatio,
      passes: primaryRatio >= 4.5
    }
  };
}

import React from 'react';

/**
 * VisuallyHidden component - hides content visually but keeps it accessible
 */
export const VisuallyHidden: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: 0,
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: 0,
    }}
  >
    {children}
  </span>
);
