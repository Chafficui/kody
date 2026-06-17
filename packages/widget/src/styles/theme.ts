export interface ThemeColors {
  primary: string;
  primaryForeground: string;
  background: string;
  foreground: string;
  bubbleBackground: string;
  userBubbleBackground: string;
  userBubbleForeground: string;
}

const DARK_DEFAULTS = {
  background: "#1a1a2e",
  foreground: "#e4e4e7",
  bubbleBackground: "#2a2a3e",
};

export function buildThemeVars(
  colors: ThemeColors,
  options?: { theme?: string; borderRadius?: number; fontFamily?: string },
): string {
  const theme = options?.theme ?? "light";
  const radius = options?.borderRadius ?? 12;
  const font = options?.fontFamily;

  const fontVar = font ? `\n  --kody-font: ${font};` : "";

  const lightVars = `:host {
  --kody-primary: ${colors.primary};
  --kody-primary-fg: ${colors.primaryForeground};
  --kody-bg: ${colors.background};
  --kody-fg: ${colors.foreground};
  --kody-bubble-bg: ${colors.bubbleBackground};
  --kody-user-bubble-bg: ${colors.userBubbleBackground};
  --kody-user-bubble-fg: ${colors.userBubbleForeground};
  --kody-radius: ${radius}px;${fontVar}
}
`;

  const darkVars = `:host {
  --kody-primary: ${colors.primary};
  --kody-primary-fg: ${colors.primaryForeground};
  --kody-bg: ${DARK_DEFAULTS.background};
  --kody-fg: ${DARK_DEFAULTS.foreground};
  --kody-bubble-bg: ${DARK_DEFAULTS.bubbleBackground};
  --kody-user-bubble-bg: ${colors.userBubbleBackground};
  --kody-user-bubble-fg: ${colors.userBubbleForeground};
  --kody-radius: ${radius}px;${fontVar}
}
`;

  if (theme === "dark") {
    return darkVars;
  }

  if (theme === "auto") {
    return `${lightVars}
@media (prefers-color-scheme: dark) {
${darkVars}}
`;
  }

  return lightVars;
}
