---
name: Workproof "Trust & Clarity" Design System
description: A professional, high-trust visual language for decentralized escrow. Designed to feel reliable, technical, and clean—moving away from typical flashy Web3 aesthetics toward a polished service platform feel.

colors:
  # Primary palette for trust and action
  primary: "#3B82F6" # Trust Blue
  on-primary: "#FFFFFF"
  primary-container: "#DBEAFE"
  on-primary-container: "#1E40AF"

  # Backgrounds and surfaces (Soft Blue/White tints)
  surface: "#F9F9FF" # Soft Off-white/Blue tint
  on-surface: "#111827"
  surface-bright: "#FFFFFF"
  surface-container-low: "#F3F4F6"
  surface-container: "#FFFFFF" # Pure white for cards
  
  # Accents and feedback
  secondary: "#64748B" # Professional Slate
  on-secondary: "#FFFFFF"
  error: "#EF4444"
  success: "#10B981"
  outline: "#E5E7EB" # Subtle 1px borders
  outline-variant: "#D1D5DB"

typography:
  # Professional and readable
  headlines:
    font: "Hanken Grotesk"
    weight: "Bold"
    tracking: "-0.02em"
  body:
    font: "Inter"
    weight: "Regular"
  data:
    font: "JetBrains Mono" # Technical precision for addresses/hashes
    weight: "Medium"

layout:
  # Spacing and structure
  spacing-scale: "4px"
  gutter: "16px"
  max-width: "container-max"
  roundness: "ROUND_FOUR" # 12px corners for modern approachability
  elevation: "FLAT" # Use subtle borders (1px) instead of heavy shadows

components:
  top-app-bar:
    style: "High-blur, persistent, minimalist"
    background: "surface-bright / 80% opacity"
    border: "1px border-b outline"
  bottom-nav:
    style: "Professional labels and icons"
    active-color: "primary"
    inactive-color: "secondary"
  cards:
    style: "Pure white surface, 1px outline, 12px radius"
  buttons:
    primary: "Full width on mobile, trust-blue, bold Hanken Grotesk labels"
    secondary: "Ghost or outlined styles to maintain de-cluttered feel"

principles:
  - Trust over Flash: No neon colors or high-contrast dark modes.
  - Information Hierarchy: Use whitespace to separate content rather than boxes or shadows.
  - Technical Transparency: Mask addresses where possible but keep the JetBrains Mono font to signal "on-chain" reality.
  - Page Separation: Singular focus for every route (Landing, Jobs, Activity, Leaderboard).
---