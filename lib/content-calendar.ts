export type EventCategory = 'holiday' | 'sales' | 'awareness' | 'business'

export const CATEGORY_META: Record<EventCategory, { label: string; textColor: string; bgColor: string; borderColor: string }> = {
  holiday:   { label: 'Holiday',   textColor: 'text-rose-700',   bgColor: 'bg-rose-50',   borderColor: 'border-rose-200' },
  sales:     { label: 'Sales',     textColor: 'text-amber-700',  bgColor: 'bg-amber-50',  borderColor: 'border-amber-200' },
  awareness: { label: 'Awareness', textColor: 'text-violet-700', bgColor: 'bg-violet-50', borderColor: 'border-violet-200' },
  business:  { label: 'Business',  textColor: 'text-sky-700',    bgColor: 'bg-sky-50',    borderColor: 'border-sky-200' },
}

export interface PostTemplate {
  label: string
  content: string
}

export interface UpcomingEvent {
  id: string
  name: string
  emoji: string
  category: EventCategory
  date: Date
  daysUntil: number
  suggestedScheduleAt: Date
  monthYear: string
  templates: PostTemplate[]
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month, day)
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1)
  const diff = (weekday - first.getDay() + 7) % 7
  return new Date(year, month, 1 + diff + (n - 1) * 7)
}

function lastWeekday(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month + 1, 0)
  const diff = (last.getDay() - weekday + 7) % 7
  return new Date(year, month, last.getDate() - diff)
}

// ── Event definitions ─────────────────────────────────────────────────────────

interface EventDef {
  id: string
  name: string
  emoji: string
  category: EventCategory
  leadDays: number
  suggestedHour: number
  templates: PostTemplate[]
  getDates: (year: number) => Date[]
}

const EVENT_DEFS: EventDef[] = [
  {
    id: 'new_years_day',
    name: "New Year's Day",
    emoji: '🎉',
    category: 'holiday',
    leadDays: 0,
    suggestedHour: 10,
    getDates: (y) => [new Date(y, 0, 1)],
    templates: [
      {
        label: 'Heartfelt',
        content: `Happy New Year! 🎉 From our entire team, wishing you an incredible year ahead filled with happiness, health, and success. Thank you for being part of our journey — we can't wait to see what this year brings! 🥂`,
      },
      {
        label: 'Business focus',
        content: `Welcome to the new year! 🎯 A fresh start means new opportunities. We're excited and ready to help you achieve your goals this year. Get in touch — let's make it your best year yet! 🚀`,
      },
    ],
  },
  {
    id: 'australia_day',
    name: 'Australia Day',
    emoji: '🇦🇺',
    category: 'holiday',
    leadDays: 0,
    suggestedHour: 10,
    getDates: (y) => [new Date(y, 0, 26)],
    templates: [
      {
        label: 'Community',
        content: `Happy Australia Day! 🇦🇺 Wishing everyone a wonderful day celebrating this amazing country. Whether you're at a barbie, the beach, or relaxing with family — enjoy every moment! 🦘`,
      },
      {
        label: 'Small business pride',
        content: `Proud to be an Australian small business! 🇦🇺 Happy Australia Day to all our wonderful clients and supporters. Today we celebrate what makes this country great — including the incredible communities and local businesses that keep it thriving. 💛💚`,
      },
    ],
  },
  {
    id: 'valentines_day',
    name: "Valentine's Day",
    emoji: '💕',
    category: 'awareness',
    leadDays: 0,
    suggestedHour: 9,
    getDates: (y) => [new Date(y, 1, 14)],
    templates: [
      {
        label: 'Community love',
        content: `Happy Valentine's Day! 💕 Today is all about showing appreciation for the people who matter most. Sending love and gratitude to our wonderful clients and community — you're the reason we do what we do! 💝`,
      },
      {
        label: 'Promo',
        content: `Love is in the air! 💖 This Valentine's Day, show someone special they're appreciated. Whether it's a treat for yourself or a gift for someone you love — we'd love to help make it memorable! ❤️`,
      },
    ],
  },
  {
    id: 'iwd',
    name: "International Women's Day",
    emoji: '🌸',
    category: 'awareness',
    leadDays: 0,
    suggestedHour: 9,
    getDates: (y) => [new Date(y, 2, 8)],
    templates: [
      {
        label: 'Celebration',
        content: `Happy International Women's Day! 🌸 Today we celebrate the extraordinary women making a difference every day — in our team, our community, and the world. Your strength, resilience, and brilliance inspire us all. Here's to you! 💪\n\n#IWD #InternationalWomensDay`,
      },
    ],
  },
  {
    id: 'good_friday',
    name: 'Good Friday',
    emoji: '🌺',
    category: 'holiday',
    leadDays: 0,
    suggestedHour: 9,
    getDates: (y) => [addDays(easterSunday(y), -2)],
    templates: [
      {
        label: 'Long weekend wishes',
        content: `Wishing everyone a peaceful Good Friday 🌺 We hope you're able to spend this long weekend with the people you love most. Stay safe on the roads and enjoy some well-deserved rest. Our team is taking a break and will be back after Easter! 🐣`,
      },
    ],
  },
  {
    id: 'easter_sunday',
    name: 'Easter',
    emoji: '🐣',
    category: 'holiday',
    leadDays: 0,
    suggestedHour: 9,
    getDates: (y) => [easterSunday(y)],
    templates: [
      {
        label: 'Family & community',
        content: `Happy Easter! 🐣🐰 Whether you're hunting eggs, indulging in chocolate, or enjoying a feast with family — we hope you have a truly wonderful Easter long weekend. From our family to yours, have a safe and happy Easter! 🌸`,
      },
      {
        label: 'Fun & light',
        content: `Hoppy Easter everyone! 🐰🥚 We hope the Easter bunny is kind to you this year! Wishing all our wonderful clients and their families a relaxing and joyful long weekend. 🍫✨\n\n#HappyEaster`,
      },
    ],
  },
  {
    id: 'anzac_day',
    name: 'ANZAC Day',
    emoji: '🌹',
    category: 'awareness',
    leadDays: 0,
    suggestedHour: 6,
    getDates: (y) => [new Date(y, 3, 25)],
    templates: [
      {
        label: 'Lest We Forget',
        content: `Lest We Forget. 🌹\n\nToday we pause to honour the courage and sacrifice of the brave men and women who served Australia and New Zealand. Their legacy lives on in all of us.\n\n#AnzacDay #LestWeForget`,
      },
    ],
  },
  {
    id: 'mothers_day',
    name: "Mother's Day",
    emoji: '💐',
    category: 'holiday',
    leadDays: 0,
    suggestedHour: 9,
    getDates: (y) => [nthWeekday(y, 4, 0, 2)], // 2nd Sunday of May
    templates: [
      {
        label: 'Heartfelt',
        content: `Happy Mother's Day! 💐 To all the incredible mums, stepmums, grandmothers, and mother figures out there — today is YOUR day. Thank you for your unconditional love, your strength, and everything you do. You are appreciated more than words can say! 💖\n\n#MothersDay`,
      },
      {
        label: 'Promo',
        content: `Happy Mother's Day to all the amazing mums! 💐 Looking for a special way to celebrate the mum in your life? We'd love to help make her day extra memorable. Get in touch today! 💖\n\n#MothersDay`,
      },
    ],
  },
  {
    id: 'eofy',
    name: 'End of Financial Year',
    emoji: '💼',
    category: 'business',
    leadDays: 14,
    suggestedHour: 9,
    getDates: (y) => [new Date(y, 5, 30)],
    templates: [
      {
        label: 'EOFY reminder',
        content: `⏰ EOFY is just around the corner!\n\nJune 30 is approaching fast — have you made the most of your tax deductions this financial year? Now is the perfect time to invest in your business before the deadline.\n\nGet in touch today — don't leave it too late! 💼\n\n#EOFY #EndOfFinancialYear #TaxTime`,
      },
      {
        label: 'Last chance',
        content: `🚨 Last chance for EOFY!\n\nThe end of financial year deadline is almost here. Whether you're investing in equipment, services, or growth — acting before June 30 could save you at tax time.\n\nReach out now before it's too late! ⚡\n\n#EOFY #TaxTime`,
      },
    ],
  },
  {
    id: 'new_fin_year',
    name: 'New Financial Year',
    emoji: '🎯',
    category: 'business',
    leadDays: 0,
    suggestedHour: 9,
    getDates: (y) => [new Date(y, 6, 1)],
    templates: [
      {
        label: 'Fresh start',
        content: `🎯 Happy New Financial Year!\n\nA fresh start, a clean slate, and new opportunities ahead. What are your big goals for the year? Whatever you're aiming for, we're here to help you achieve them.\n\nHere's to a productive and successful year! 🚀\n\n#NewFinancialYear #BusinessGoals`,
      },
    ],
  },
  {
    id: 'christmas_in_july',
    name: 'Christmas in July',
    emoji: '❄️',
    category: 'holiday',
    leadDays: 0,
    suggestedHour: 9,
    getDates: (y) => [new Date(y, 6, 25)],
    templates: [
      {
        label: 'Festive fun',
        content: `🎄 Happy Christmas in July! 🎄\n\nWho says you need to wait until December to celebrate? Whether it's a winter feast, a Yuletide gathering, or just an excuse for some festive fun — we're here for it! 🍷⛄\n\n#ChristmasInJuly`,
      },
    ],
  },
  {
    id: 'fathers_day',
    name: "Father's Day",
    emoji: '👨‍👧',
    category: 'holiday',
    leadDays: 0,
    suggestedHour: 9,
    getDates: (y) => [nthWeekday(y, 8, 0, 1)], // 1st Sunday of September (Australia)
    templates: [
      {
        label: 'Heartfelt',
        content: `Happy Father's Day! 👨‍👧‍👦 To all the amazing dads, stepdads, granddads, and father figures out there — today is your day. Thank you for your strength, guidance, and everything you do. Wishing you a wonderful Sunday surrounded by the people you love! 🎉\n\n#FathersDay`,
      },
      {
        label: 'Promo',
        content: `Happy Father's Day! 👨‍👧‍👦 Looking for the perfect way to celebrate the dad in your life? We'd love to help make his day extra special. Get in touch today! 🎁\n\n#FathersDay`,
      },
    ],
  },
  {
    id: 'halloween',
    name: 'Halloween',
    emoji: '🎃',
    category: 'holiday',
    leadDays: 0,
    suggestedHour: 9,
    getDates: (y) => [new Date(y, 9, 31)],
    templates: [
      {
        label: 'Fun',
        content: `👻 Happy Halloween! Whether you're going all out with costumes, handing out lollies, or just watching a scary movie on the couch — we hope you have a spooktacular evening! 🎃🕷️\n\n#Halloween #HappyHalloween`,
      },
    ],
  },
  {
    id: 'melbourne_cup',
    name: 'Melbourne Cup',
    emoji: '🏇',
    category: 'holiday',
    leadDays: 0,
    suggestedHour: 10,
    getDates: (y) => [nthWeekday(y, 10, 2, 1)], // 1st Tuesday of November
    templates: [
      {
        label: 'Race day',
        content: `🏇 It's the race that stops the nation!\n\nHappy Melbourne Cup Day, everyone! Whether you're trackside, at a sweepstake, or watching from the couch with a glass in hand — we hope your horse romps home! 🍾🥂\n\n#MelbourneCup #CupDay #ThatStopsTheNation`,
      },
    ],
  },
  {
    id: 'black_friday',
    name: 'Black Friday',
    emoji: '🖤',
    category: 'sales',
    leadDays: 0,
    suggestedHour: 8,
    getDates: (y) => [lastWeekday(y, 10, 5)], // Last Friday of November
    templates: [
      {
        label: 'Sale announcement',
        content: `🖤 Black Friday is here!\n\nIt's the biggest sale event of the year and we have something special in store. Don't miss out — our offers won't last long! 🛍️\n\n#BlackFriday #BlackFridayDeals #Sale`,
      },
      {
        label: 'Value focus',
        content: `Black Friday deals are LIVE! 🖤🛍️ Ready to grab something amazing? Whether it's for yourself or the perfect early Christmas gift — now is the time to act. Limited time only!\n\n#BlackFriday #BFCM #Deal`,
      },
    ],
  },
  {
    id: 'cyber_monday',
    name: 'Cyber Monday',
    emoji: '💻',
    category: 'sales',
    leadDays: 0,
    suggestedHour: 8,
    getDates: (y) => {
      const bf = lastWeekday(y, 10, 5)
      return [addDays(bf, 3)]
    },
    templates: [
      {
        label: 'Last chance',
        content: `💻 Cyber Monday is here — one last chance!\n\nDon't miss our final deals before they disappear. Whether you missed Black Friday or have been waiting — today is your last opportunity. Act fast! ⚡\n\n#CyberMonday #CyberMondayDeals #BFCM`,
      },
    ],
  },
  {
    id: 'christmas',
    name: 'Christmas',
    emoji: '🎄',
    category: 'holiday',
    leadDays: 0,
    suggestedHour: 9,
    getDates: (y) => [new Date(y, 11, 25)],
    templates: [
      {
        label: 'Warm wishes',
        content: `🎄 Merry Christmas from all of us!\n\nWishing you and your loved ones a joyful, peaceful, and magical festive season. Thank you from the bottom of our hearts for your wonderful support throughout the year — it truly means the world to us.\n\nEnjoy every precious moment! 🎅⭐`,
      },
      {
        label: 'Office hours',
        content: `Wishing everyone a very Merry Christmas! 🎄🎁 Our office will be closed over the festive season and back in the new year. Thank you for an incredible year of support — we'll see you soon! 🥂✨\n\n#MerryChristmas`,
      },
    ],
  },
  {
    id: 'boxing_day',
    name: 'Boxing Day',
    emoji: '🎁',
    category: 'holiday',
    leadDays: 0,
    suggestedHour: 9,
    getDates: (y) => [new Date(y, 11, 26)],
    templates: [
      {
        label: 'Relaxed post',
        content: `🎁 Happy Boxing Day! We hope you're recovering nicely from yesterday's festivities and enjoying a relaxing day with loved ones. For those braving the Boxing Day sales — good luck out there! 😄\n\n#BoxingDay #BoxingDaySales`,
      },
    ],
  },
  {
    id: 'new_years_eve',
    name: "New Year's Eve",
    emoji: '🥂',
    category: 'holiday',
    leadDays: 0,
    suggestedHour: 20,
    getDates: (y) => [new Date(y, 11, 31)],
    templates: [
      {
        label: 'Year wrap-up',
        content: `🥂 As we count down the final hours of the year, we just want to say — THANK YOU.\n\nThank you for your trust, your support, and for being part of our community. It's been an incredible journey and we couldn't do it without you.\n\nWishing you a safe, fun, and memorable New Year's Eve. See you next year! 🎆\n\n#NYE #NewYearsEve`,
      },
    ],
  },
]

// ── Public API ────────────────────────────────────────────────────────────────

export function getUpcomingEvents(monthsAhead = 13): UpcomingEvent[] {
  const now = new Date()
  const cutoff = new Date(now)
  cutoff.setMonth(cutoff.getMonth() + monthsAhead)

  const events: UpcomingEvent[] = []
  const years = [now.getFullYear(), now.getFullYear() + 1]

  for (const def of EVENT_DEFS) {
    for (const year of years) {
      for (const date of def.getDates(year)) {
        if (date < now || date > cutoff) continue

        const suggestedScheduleAt = new Date(date)
        suggestedScheduleAt.setDate(suggestedScheduleAt.getDate() - def.leadDays)
        suggestedScheduleAt.setHours(def.suggestedHour, 0, 0, 0)

        const daysUntil = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        events.push({
          id: `${def.id}_${year}`,
          name: def.name,
          emoji: def.emoji,
          category: def.category,
          date,
          daysUntil,
          suggestedScheduleAt,
          monthYear: date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }),
          templates: def.templates,
        })
      }
    }
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime())
}
