// Country flag chip — emoji flag + ISO code in a tight monospace pill.
// Falls back gracefully when the country isn't recognised.

export const FLAGS: Record<string, string> = {
  DE: "🇩🇪",
  CA: "🇨🇦",
  UK: "🇬🇧",
  GB: "🇬🇧",
  JP: "🇯🇵",
  US: "🇺🇸",
  PT: "🇵🇹",
  FR: "🇫🇷",
  ES: "🇪🇸",
  IT: "🇮🇹",
  NL: "🇳🇱",
  IN: "🇮🇳",
  CN: "🇨🇳",
};

export function countryFlag(code: string): string | undefined {
  return FLAGS[code.toUpperCase()];
}

// Map ISO country to a representative IANA timezone + display city. Used to
// surface a "what time is it for the client right now" hint next to their
// phone number, so operators don't dial into the middle of the night.
const COUNTRY_TZ: Record<string, { tz: string; city: string }> = {
  DE: { tz: "Europe/Berlin",    city: "Berlin" },
  CA: { tz: "America/Toronto",  city: "Toronto" },
  UK: { tz: "Europe/London",    city: "London" },
  GB: { tz: "Europe/London",    city: "London" },
  JP: { tz: "Asia/Tokyo",       city: "Tokyo" },
  US: { tz: "America/New_York", city: "New York" },
  PT: { tz: "Europe/Lisbon",    city: "Lisbon" },
  FR: { tz: "Europe/Paris",     city: "Paris" },
  ES: { tz: "Europe/Madrid",    city: "Madrid" },
  IT: { tz: "Europe/Rome",      city: "Rome" },
  NL: { tz: "Europe/Amsterdam", city: "Amsterdam" },
  IN: { tz: "Asia/Kolkata",     city: "Mumbai" },
  CN: { tz: "Asia/Shanghai",    city: "Shanghai" },
};

export interface CountryTimeHint {
  city: string;
  time: string;          // "14:32"
  isOffHours: boolean;   // true outside 08:00–21:00 local
}

export function countryTimeHint(code: string, now: Date = new Date()): CountryTimeHint | null {
  const entry = COUNTRY_TZ[code.toUpperCase()];
  if (!entry) return null;
  try {
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: entry.tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);
    const hour = parseInt(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: entry.tz,
        hour: "2-digit",
        hour12: false,
      }).format(now),
      10,
    );
    const isOffHours = !Number.isFinite(hour) || hour < 8 || hour >= 21;
    return { city: entry.city, time, isOffHours };
  } catch {
    return null;
  }
}

interface CountryChipProps {
  code: string;
}

export function CountryChip({ code }: CountryChipProps) {
  const flag = FLAGS[code.toUpperCase()];
  return (
    <span className="inline-flex items-center gap-1 h-[18px] px-1.5 rounded-[5px] bg-secondary/40 ring-1 ring-inset ring-border/60 font-mono text-[10px] tabular-nums text-muted-foreground shrink-0">
      {flag && <span className="text-[11px] leading-none">{flag}</span>}
      <span>{code.toUpperCase()}</span>
    </span>
  );
}
