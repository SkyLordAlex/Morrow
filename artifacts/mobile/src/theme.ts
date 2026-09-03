// Design tokens ported 1:1 from artifacts/study-planner/src/index.css.
// The web app stores these as HSL triples for Tailwind; React Native has no
// CSS variables, so they are resolved to hex here. If you change a colour in
// index.css, change it here too — these are the same design system.

export const colors = {
  background: '#EAF5F2',
  foreground: '#1F2B3D',
  border: '#CEDED9',
  borderSoft: 'rgba(206, 222, 217, 0.7)',

  card: '#F5FAF9',
  cardBorder: '#D4E3DE',

  primary: '#2B6960',
  primaryForeground: '#FFFCF0',

  secondary: '#F9C058',
  secondaryForeground: '#1F2B3D',

  muted: '#DDE9E6',
  mutedForeground: '#637E77',

  accent: '#EC8169',
  destructive: '#CC362E',
  input: '#C2D6CF',

  sidebar: '#223F3B',
  sidebarForeground: '#DCEFE8',
  sidebarBorder: '#3A5A54',
  sidebarAccent: '#30544E',

  success: '#6DAF89',
} as const;

// Assignment accent swatches — same five the API hands back on
// `assignment.accent`.
export const accentStyles: Record<
  string,
  { ink: string; soft: string; line: string }
> = {
  amber: { ink: '#B36A1E', soft: '#FFF0C9', line: '#E3B35D' },
  coral: { ink: '#B84E49', soft: '#FFE2D7', line: '#E99B87' },
  blue: { ink: '#347A8D', soft: '#DDEFF1', line: '#8FC4C8' },
  violet: { ink: '#75617E', soft: '#EEE5F2', line: '#B6A0BF' },
  sage: { ink: '#4E826B', soft: '#DDEDE4', line: '#9CC4AF' },
  green: { ink: '#4E826B', soft: '#DDEDE4', line: '#9CC4AF' },
};

export function accentFor(value: string | undefined) {
  if (!value) return accentStyles.amber;
  return accentStyles[value.toLowerCase()] ?? accentStyles.amber;
}

// Font family names as registered by @expo-google-fonts in app/_layout.tsx.
export const fonts = {
  sans: 'Manrope_500Medium',
  sansBold: 'Manrope_700Bold',
  sansHeavy: 'Manrope_800ExtraBold',
  serif: 'Newsreader_500Medium',
  serifSemi: 'Newsreader_600SemiBold',
  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

// iOS-flavoured shadow. RN needs elevation for Android, so both are set.
export const shadow = {
  card: {
    shadowColor: '#2B6960',
    shadowOpacity: 0.07,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  raised: {
    shadowColor: '#2B6960',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
} as const;
