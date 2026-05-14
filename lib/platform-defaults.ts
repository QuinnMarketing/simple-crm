import type { SmtpConfig } from './email'

export function getSmtpDefaults(): SmtpConfig {
  return {
    host: process.env.SMTP_HOST ?? '',
    port: process.env.SMTP_PORT ?? '587',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? '',
  }
}

export function getGoogleAdsDefaults(): Record<string, string> {
  return {
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '',
    clientId: process.env.GOOGLE_ADS_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? '',
    refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN ?? '',
  }
}

/** Merge saved config with defaults — saved values win, defaults fill empty fields */
export function mergeSmtp(saved: Partial<SmtpConfig> | null | undefined): SmtpConfig {
  const d = getSmtpDefaults()
  return {
    host: saved?.host || d.host,
    port: saved?.port || d.port,
    user: saved?.user || d.user,
    pass: saved?.pass || d.pass,
    from: saved?.from || d.from,
  }
}

export function mergeGoogleAds(saved: Record<string, string> | null | undefined): Record<string, string> {
  const d = getGoogleAdsDefaults()
  const merged: Record<string, string> = { ...d }
  if (saved) {
    for (const [k, v] of Object.entries(saved)) {
      if (v) merged[k] = v
    }
  }
  return merged
}
