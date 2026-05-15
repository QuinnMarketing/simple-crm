export interface EmailTemplate {
  id: string
  name: string
  description: string
  emoji: string
  category: string
  subject: string
  bodyHtml: string
  bodyText: string
}

const btn = (url: string, label: string) =>
  `<p style="text-align:center;margin:28px 0 8px;">` +
  `<a href="${url}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;` +
  `padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">${label}</a></p>`

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  // ── WELCOME ─────────────────────────────────────────────────────────────────
  {
    id: 'welcome',
    name: 'Welcome',
    description: 'Greet a new lead or client and set expectations',
    emoji: '👋',
    category: 'Onboarding',
    subject: 'Welcome to {{business_name}}, {{name}}!',
    bodyHtml: `<h2>Welcome, {{name}}!</h2>
<p>We're really glad you reached out. At <strong>{{business_name}}</strong>, we're here to help you every step of the way.</p>
<p>Here's what happens next:</p>
<ul>
  <li>We'll review your enquiry and be in touch shortly</li>
  <li>One of our team members will reach out to discuss your needs</li>
  <li>We'll put together a tailored solution just for you</li>
</ul>
<p>In the meantime, feel free to reply to this email with any questions — we're always happy to chat.</p>
<p>Talk soon,<br><strong>The {{business_name}} Team</strong></p>`,
    bodyText: `Welcome, {{name}}!\n\nWe're really glad you reached out. At {{business_name}}, we're here to help you every step of the way.\n\nHere's what happens next:\n- We'll review your enquiry and be in touch shortly\n- One of our team members will reach out to discuss your needs\n- We'll put together a tailored solution just for you\n\nFeel free to reply with any questions.\n\nTalk soon,\nThe {{business_name}} Team`,
  },

  // ── FOLLOW-UP ────────────────────────────────────────────────────────────────
  {
    id: 'followup',
    name: 'Follow-Up',
    description: 'Reconnect with a lead who hasn\'t responded',
    emoji: '📩',
    category: 'Sales',
    subject: 'Just checking in, {{name}}',
    bodyHtml: `<p>Hi {{name}},</p>
<p>I wanted to follow up on my previous message. I know life gets busy, so I just wanted to make sure my email didn't slip through the cracks.</p>
<p>We'd love the opportunity to help you with <strong>{{service}}</strong>. Even if now isn't the right time, I'm happy to answer any questions or point you in the right direction.</p>
<p>Would you be open to a quick 10-minute chat this week?</p>
${btn('#', 'Book a Call')}
<p>No pressure at all — just let me know either way.</p>
<p>Cheers,<br><strong>{{business_name}}</strong></p>`,
    bodyText: `Hi {{name}},\n\nI wanted to follow up on my previous message — just making sure it didn't slip through the cracks.\n\nWe'd love to help you with {{service}}. Would you be open to a quick 10-minute chat this week?\n\nNo pressure at all — just let me know either way.\n\nCheers,\n{{business_name}}`,
  },

  // ── QUOTE FOLLOW-UP ───────────────────────────────────────────────────────────
  {
    id: 'quote_followup',
    name: 'Quote Follow-Up',
    description: 'Chase a quote that hasn\'t been accepted yet',
    emoji: '📋',
    category: 'Sales',
    subject: 'Your quote from {{business_name}} — any questions?',
    bodyHtml: `<p>Hi {{name}},</p>
<p>I hope you've had a chance to review the quote we sent over. I wanted to check in and see if you had any questions or if there's anything you'd like us to adjust.</p>
<p>We're committed to getting this right for you, so please don't hesitate to reach out if you'd like to talk through the details or explore different options.</p>
${btn('#', 'View Your Quote')}
<p>We're ready to get started as soon as you give us the green light — just reply to this email or give us a call.</p>
<p>Kind regards,<br><strong>{{business_name}}</strong></p>`,
    bodyText: `Hi {{name}},\n\nI hope you've had a chance to review the quote we sent over. Any questions or anything you'd like adjusted?\n\nWe're committed to getting this right for you — just reply or give us a call.\n\nKind regards,\n{{business_name}}`,
  },

  // ── SPECIAL OFFER ─────────────────────────────────────────────────────────────
  {
    id: 'special_offer',
    name: 'Special Offer',
    description: 'Announce a limited-time promotion or discount',
    emoji: '🏷️',
    category: 'Promotions',
    subject: 'Exclusive offer for you, {{name}} 🎁',
    bodyHtml: `<p>Hi {{name}},</p>
<p>We've got something special just for you. For a <strong>limited time</strong>, we're offering an exclusive deal to our valued clients and enquiries.</p>
<h2>[Your Offer Here]</h2>
<p>Whether you've been thinking about booking for a while or just want to take advantage of a great deal, now is the perfect time.</p>
${btn('#', 'Claim Your Offer')}
<p><em>This offer is available for a limited time only — don't miss out!</em></p>
<p>Questions? Just hit reply — we'd love to help.</p>
<p>Cheers,<br><strong>{{business_name}}</strong></p>`,
    bodyText: `Hi {{name}},\n\nWe've got something special just for you — a limited-time exclusive offer.\n\n[Your Offer Here]\n\nThis is available for a limited time only — don't miss out!\n\nQuestions? Just hit reply.\n\nCheers,\n{{business_name}}`,
  },

  // ── EOFY OFFER ────────────────────────────────────────────────────────────────
  {
    id: 'eofy',
    name: 'EOFY Offer',
    description: 'End of financial year promotion (June)',
    emoji: '📊',
    category: 'Seasonal',
    subject: 'EOFY is here — time to act, {{name}}',
    bodyHtml: `<p>Hi {{name}},</p>
<p>The end of the financial year is almost here, and it's a great time to <strong>invest in your business</strong> before 30 June.</p>
<p>If you've been putting off booking with us, now's the perfect time — you may be able to claim it as a tax deduction this financial year.</p>
<h2>EOFY Special</h2>
<p>[Your EOFY offer or service description here]</p>
${btn('#', 'Book Before 30 June')}
<p>Don't leave it too late — our calendar fills up fast around EOFY. Reach out today and we'll get you sorted before the deadline.</p>
<p>Cheers,<br><strong>{{business_name}}</strong></p>`,
    bodyText: `Hi {{name}},\n\nThe end of the financial year is almost here — a great time to invest in your business before 30 June.\n\n[Your EOFY offer here]\n\nDon't leave it too late — reply today and we'll get you sorted before the deadline.\n\nCheers,\n{{business_name}}`,
  },

  // ── CHRISTMAS ─────────────────────────────────────────────────────────────────
  {
    id: 'christmas',
    name: 'Christmas',
    description: 'Seasonal Christmas message with optional offer',
    emoji: '🎄',
    category: 'Seasonal',
    subject: 'Merry Christmas from {{business_name}} 🎄',
    bodyHtml: `<p>Hi {{name}},</p>
<p>From everyone here at <strong>{{business_name}}</strong>, we'd like to wish you and your loved ones a wonderful Christmas and a safe, happy holiday season.</p>
<p>It's been a fantastic year, and we're truly grateful for your support and trust. We look forward to continuing to serve you in the new year.</p>
<h2>🎁 A little gift from us</h2>
<p>[Optional: add a special holiday offer, voucher code, or heartfelt message here]</p>
${btn('#', 'Claim Your Holiday Offer')}
<p>We'll be taking a short break from <strong>[date]</strong> and back on <strong>[date]</strong>. For urgent enquiries, reach us at <strong>{{email}}</strong>.</p>
<p>Merry Christmas and Happy New Year!<br><strong>The {{business_name}} Team</strong></p>`,
    bodyText: `Hi {{name}},\n\nFrom everyone at {{business_name}}, we wish you a wonderful Christmas and a safe, happy holiday season.\n\nThank you for your support this year — we look forward to continuing to serve you in the new year.\n\n[Optional holiday offer here]\n\nMerry Christmas and Happy New Year!\nThe {{business_name}} Team`,
  },

  // ── BLACK FRIDAY ──────────────────────────────────────────────────────────────
  {
    id: 'black_friday',
    name: 'Black Friday',
    description: 'Black Friday or Cyber Monday sale announcement',
    emoji: '🛍️',
    category: 'Seasonal',
    subject: 'Black Friday deal inside, {{name}} 🖤',
    bodyHtml: `<p>Hi {{name}},</p>
<p>Black Friday is here, and we're making it count. For a very limited time, we're offering one of our biggest deals of the year — exclusively for people like you.</p>
<h2>🖤 Black Friday Deal</h2>
<p>[Your offer — e.g. 20% off all services, free consultation, bonus package, etc.]</p>
<p><strong>Available this weekend only.</strong> Once it's gone, it's gone.</p>
${btn('#', 'Grab the Deal Now')}
<p>Questions? Just reply to this email — we're here to help.</p>
<p>Cheers,<br><strong>{{business_name}}</strong></p>`,
    bodyText: `Hi {{name}},\n\nBlack Friday is here and we're offering one of our biggest deals of the year.\n\n[Your offer here]\n\nAvailable this weekend only — once it's gone, it's gone.\n\nCheers,\n{{business_name}}`,
  },

  // ── RE-ENGAGEMENT ─────────────────────────────────────────────────────────────
  {
    id: 'reengagement',
    name: 'Win-Back',
    description: 'Re-engage leads or clients who have gone quiet',
    emoji: '🔁',
    category: 'Retention',
    subject: 'We miss you, {{name}} — still interested?',
    bodyHtml: `<p>Hi {{name}},</p>
<p>It's been a while since we've heard from you, and we just wanted to check in.</p>
<p>Things may have changed since we last spoke, and we'd love to know if there's still something we can help you with. We've also made some improvements since then that you might find useful:</p>
<ul>
  <li>[Improvement or new service 1]</li>
  <li>[Improvement or new service 2]</li>
  <li>[Improvement or new service 3]</li>
</ul>
${btn('#', 'Let\'s Reconnect')}
<p>If you're no longer interested, no hard feelings at all — just let us know and we'll stop reaching out.</p>
<p>Hope to hear from you,<br><strong>{{business_name}}</strong></p>`,
    bodyText: `Hi {{name}},\n\nIt's been a while since we've heard from you — we just wanted to check in.\n\nThings may have changed, and we'd love to know if there's still something we can help you with.\n\nIf you're no longer interested, no hard feelings — just let us know.\n\nHope to hear from you,\n{{business_name}}`,
  },

  // ── REVIEW REQUEST ────────────────────────────────────────────────────────────
  {
    id: 'review_request',
    name: 'Review Request',
    description: 'Ask happy clients to leave a Google or Facebook review',
    emoji: '⭐',
    category: 'Social Proof',
    subject: '{{name}}, would you mind leaving us a review?',
    bodyHtml: `<p>Hi {{name}},</p>
<p>We hope you're really happy with the work we did for you. It was a pleasure to help, and we'd love to keep doing more of it.</p>
<p>If you've got a minute, would you be willing to leave us a quick review? It makes a huge difference for a small business like ours, and it helps other people find us when they need help.</p>
${btn('#', 'Leave a Google Review')}
<p>It only takes 2–3 minutes and means the world to us. If there was anything we could have done better, please reply to this email — we'd love to hear your feedback.</p>
<p>Thank you so much,<br><strong>{{business_name}}</strong></p>`,
    bodyText: `Hi {{name}},\n\nWe hope you're really happy with the work we did for you. It was a pleasure to help.\n\nIf you've got a minute, would you be willing to leave us a quick review? It makes a huge difference for a small business like ours.\n\n[Your review link here]\n\nIt only takes 2–3 minutes and means the world to us.\n\nThank you so much,\n{{business_name}}`,
  },

  // ── REFERRAL ──────────────────────────────────────────────────────────────────
  {
    id: 'referral',
    name: 'Referral Ask',
    description: 'Ask satisfied clients to refer a friend or colleague',
    emoji: '🤝',
    category: 'Growth',
    subject: 'Know someone who could use our help, {{name}}?',
    bodyHtml: `<p>Hi {{name}},</p>
<p>We really enjoyed working with you, and we hope we made a genuine difference.</p>
<p>We're growing our business mainly through referrals from people like you — it's how we keep our focus on quality rather than advertising. So we wanted to ask: <strong>do you know anyone who could benefit from what we do?</strong></p>
<p>If you refer someone who becomes a client, we'd love to say thank you with:</p>
<ul>
  <li>[Referral reward — e.g. $50 off your next booking, a gift card, etc.]</li>
</ul>
${btn('#', 'Refer a Friend')}
<p>Even just sharing our details with someone who might need help means a lot to us.</p>
<p>Thank you for your support,<br><strong>{{business_name}}</strong></p>`,
    bodyText: `Hi {{name}},\n\nWe really enjoyed working with you and hope we made a difference.\n\nDo you know anyone who could benefit from what we do? If you refer someone who becomes a client, we'd love to say thank you with [your referral reward].\n\nEven just sharing our details means a lot to us.\n\nThank you for your support,\n{{business_name}}`,
  },

  // ── NEWSLETTER ────────────────────────────────────────────────────────────────
  {
    id: 'newsletter',
    name: 'Newsletter',
    description: 'Regular update with news, tips and useful content',
    emoji: '📰',
    category: 'Content',
    subject: '[Month] update from {{business_name}}',
    bodyHtml: `<p>Hi {{name}},</p>
<p>Here's your regular update from <strong>{{business_name}}</strong>. We hope this finds you well!</p>

<h2>What's new</h2>
<p>[Share a recent project, achievement, or company update here]</p>

<h2>Tip of the month</h2>
<p>[Share a useful tip, insight, or piece of advice relevant to your industry]</p>

<h2>From the team</h2>
<p>[A personal note, staff spotlight, or behind-the-scenes update]</p>

${btn('#', 'Read More on Our Website')}

<p>As always, if there's anything we can help you with, just hit reply.</p>
<p>Until next time,<br><strong>The {{business_name}} Team</strong></p>`,
    bodyText: `Hi {{name}},\n\nHere's your regular update from {{business_name}}.\n\nWhat's new:\n[Recent update]\n\nTip of the month:\n[Useful tip]\n\nFrom the team:\n[Personal note]\n\nAs always, just reply if there's anything we can help with.\n\nUntil next time,\nThe {{business_name}} Team`,
  },

  // ── NEW SERVICE ───────────────────────────────────────────────────────────────
  {
    id: 'new_service',
    name: 'New Service',
    description: 'Announce a new product, service or capability',
    emoji: '🚀',
    category: 'Announcements',
    subject: 'We just launched something new, {{name}}!',
    bodyHtml: `<p>Hi {{name}},</p>
<p>We're excited to share some news — we've just launched <strong>[New Service Name]</strong>!</p>
<p>[Describe what it is and the problem it solves in 2–3 sentences. Be specific about who it's for and what makes it different.]</p>
<h2>Why we built this</h2>
<p>[Tell the story — what customer need or gap did you see? Keeps it relatable.]</p>
<h2>What you get</h2>
<ul>
  <li>[Key benefit 1]</li>
  <li>[Key benefit 2]</li>
  <li>[Key benefit 3]</li>
</ul>
${btn('#', 'Find Out More')}
<p>As one of our existing leads or clients, you're among the first to hear about this. We'd love to hear your thoughts — just reply to this email.</p>
<p>Excited to share this with you,<br><strong>{{business_name}}</strong></p>`,
    bodyText: `Hi {{name}},\n\nWe're excited to share that we've just launched [New Service Name]!\n\n[What it is and who it's for]\n\nKey benefits:\n- [Benefit 1]\n- [Benefit 2]\n- [Benefit 3]\n\nYou're among the first to hear about this. We'd love your thoughts — just reply to this email.\n\nExcited to share this with you,\n{{business_name}}`,
  },

  // ── APPOINTMENT REMINDER ──────────────────────────────────────────────────────
  {
    id: 'appointment_reminder',
    name: 'Appointment Reminder',
    description: 'Remind a client about an upcoming appointment',
    emoji: '🗓️',
    category: 'Operational',
    subject: 'Reminder: your appointment with {{business_name}}',
    bodyHtml: `<p>Hi {{name}},</p>
<p>Just a friendly reminder about your upcoming appointment with <strong>{{business_name}}</strong>.</p>
<p><strong>Date:</strong> [Date]<br>
<strong>Time:</strong> [Time]<br>
<strong>Location:</strong> [Address or "Online via Zoom"]</p>
<p>If you need to reschedule or have any questions beforehand, please get in touch as soon as possible — we're happy to help.</p>
${btn('#', 'Reschedule if Needed')}
<p>Looking forward to seeing you!</p>
<p>Warm regards,<br><strong>{{business_name}}</strong></p>`,
    bodyText: `Hi {{name}},\n\nJust a friendly reminder about your upcoming appointment with {{business_name}}.\n\nDate: [Date]\nTime: [Time]\nLocation: [Address or Online]\n\nIf you need to reschedule, please get in touch as soon as possible.\n\nLooking forward to seeing you!\n\nWarm regards,\n{{business_name}}`,
  },
]

export const TEMPLATE_CATEGORIES = [
  ...new Set(EMAIL_TEMPLATES.map((t) => t.category)),
]
