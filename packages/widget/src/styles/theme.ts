export interface ThemeColors {
  primary: string;
  primaryForeground: string;
  background: string;
  foreground: string;
  bubbleBackground: string;
  userBubbleBackground: string;
  userBubbleForeground: string;
}

export function buildThemeVars(colors: ThemeColors): string {
  return `:host {
  --kody-primary: ${colors.primary};
  --kody-primary-fg: ${colors.primaryForeground};
  --kody-bg: ${colors.background};
  --kody-fg: ${colors.foreground};
  --kody-bubble-bg: ${colors.bubbleBackground};
  --kody-user-bubble-bg: ${colors.userBubbleBackground};
  --kody-user-bubble-fg: ${colors.userBubbleForeground};
}
`;
}
