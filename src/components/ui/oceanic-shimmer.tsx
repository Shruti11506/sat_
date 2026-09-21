import React from "react";

// GradientBackground — "Oceanic Shimmer", made with the 21st.dev Gradient
// Builder and exported as live CSS (the builder's own Copy-CSS background,
// plus its soften-blur and grain passes). Zero dependencies: one <div> that
// fills its parent. Drop it behind your content:
// <div className="relative h-96"><GradientBackground className="absolute inset-0" /></div>
// Remix the source recipe (colors, mode, finish) in the editor:
// https://21st.dev/community/gradients/editor?from=edd345b3-bbfc-488d-9798-87a22acf7276

export interface GradientBackgroundProps {
  className?: string;
  /**
   * 'light-white' (luminous soft-white shimmer for light theme) | 
   * 'dark-blue' (executive obsidian black & royal oceanic blue shimmer for dark theme) |
   * 'oceanic' (original deep navy)
   */
  variant?: 'light-white' | 'dark-blue' | 'oceanic';
}

export function GradientBackground({ className, variant = 'light-white' }: GradientBackgroundProps) {
  const isLight = variant === 'light-white';
  const isDarkBlue = variant === 'dark-blue';

  const backgroundColor = isLight 
    ? '#dbeefd' 
    : isDarkBlue 
    ? '#02050e' 
    : '#123A6B';

  // Curated Multi-Stop Shimmer Gradients:
  // - light-white: Soft cloud-white with rich oceanic blue tones
  // - dark-blue: Deep obsidian base with rich oceanic sapphire blue in the below/lower region
  // - oceanic: Classic deep navy
  const backgroundGradients = isLight
    ? `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.15'/></svg>"), radial-gradient(150% 48.4% at 41.58% 6%, rgba(255, 255, 255, 0.94) 0%, rgba(255, 255, 255, 0) 53%), radial-gradient(150% 48.4% at 42.42% 33%, rgba(142, 204, 244, 0.92) 0%, rgba(142, 204, 244, 0) 53%), radial-gradient(150% 48.4% at 51.19% 67%, rgba(68, 148, 224, 0.78) 0%, rgba(68, 148, 224, 0) 53%), radial-gradient(150% 48.4% at 53.67% 94%, rgba(28, 86, 153, 0.55) 0%, rgba(28, 86, 153, 0) 53%)`
    : isDarkBlue
    ? `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.12'/></svg>"), radial-gradient(140% 45% at 50% 0%, rgba(18, 48, 102, 0.38) 0%, rgba(2, 5, 14, 0) 60%), radial-gradient(110% 38% at 50% 28%, rgba(6, 14, 30, 0.30) 0%, rgba(2, 5, 14, 0) 55%), radial-gradient(130% 60% at 50% 75%, rgba(24, 70, 150, 0.65) 0%, rgba(4, 12, 28, 0) 65%), radial-gradient(150% 65% at 50% 90%, rgba(16, 52, 120, 0.55) 0%, rgba(2, 5, 14, 0) 75%)`
    : `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.215'/></svg>"), radial-gradient(150% 48.4% at 41.58% 6%, rgba(234, 247, 251, 0.92) 0%, rgba(234, 247, 251, 0) 53%), radial-gradient(150% 48.4% at 42.42% 33%, rgba(127, 198, 230, 0.92) 0%, rgba(127, 198, 230, 0) 53%), radial-gradient(150% 48.4% at 51.19% 67%, rgba(46, 124, 192, 0.92) 0%, rgba(46, 124, 192, 0) 53%), radial-gradient(150% 48.4% at 53.67% 94%, rgba(18, 58, 107, 0.92) 0%, rgba(18, 58, 107, 0) 53%)`;

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        height: "100%",
        containerType: "size",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor,
          backgroundImage: backgroundGradients,
          backgroundSize: "120px 120px, auto, auto, auto, auto",
          backgroundBlendMode: "overlay, normal, normal, normal, normal",
        }}
      />
    </div>
  );
}

export default GradientBackground;
