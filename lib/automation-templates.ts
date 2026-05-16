import type { AutomationDefinition } from './automation-types'

export interface AutomationTemplate {
  id: string
  name: string
  description: string
  category: 'sales' | 'nurture' | 'operations' | 'appointments'
  emoji: string
  definition: AutomationDefinition
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'lead-welcome',
    name: 'New lead welcome email',
    description: 'Instantly send a warm confirmation email when a new lead comes in',
    category: 'sales',
    emoji: '👋',
    definition: {
      trigger: { triggerType: 'lead_created', config: {} },
      steps: [
        {
          id: 's1',
          type: 'action',
          actionType: 'send_email',
          label: 'Welcome email',
          config: {
            to: '{{email}}',
            subject: 'Thanks for your enquiry, {{name}}!',
            body: `<p>Hi {{name}},</p>
<p>Thank you for reaching out! We've received your enquiry{{service ? " about " + service : ""}} and one of our team members will be in touch with you shortly.</p>
<p>In the meantime, feel free to reply to this email if you have any questions.</p>
<p>Talk soon!</p>`,
          },
        },
      ],
    },
  },
  {
    id: 'quote-followup',
    name: 'Quote follow-up sequence',
    description: 'Follow up on unanswered quotes after 3 days, then again after 7',
    category: 'sales',
    emoji: '📋',
    definition: {
      trigger: { triggerType: 'pending_quote', config: { days: 3 } },
      steps: [
        {
          id: 's1',
          type: 'action',
          actionType: 'send_email',
          label: 'First follow-up',
          config: {
            to: '{{email}}',
            subject: 'Following up on your quote, {{name}}',
            body: `<p>Hi {{name}},</p>
<p>I just wanted to follow up on the quote we sent you. Have you had a chance to review it?</p>
<p>If you have any questions or would like to discuss anything, please don't hesitate to reach out.</p>
<p>Best regards</p>`,
          },
        },
      ],
    },
  },
  {
    id: 'win-notification',
    name: 'Won deal notification',
    description: 'Notify the team and update lead notes when a deal is marked as won',
    category: 'sales',
    emoji: '🏆',
    definition: {
      trigger: { triggerType: 'lead_status_changed', config: { toStatus: 'won' } },
      steps: [
        {
          id: 's1',
          type: 'action',
          actionType: 'add_note',
          label: 'Log win',
          config: { content: 'Deal marked as Won.' },
        },
        {
          id: 's2',
          type: 'action',
          actionType: 'notify_team',
          label: 'Notify team',
          config: {
            subject: '🏆 New deal won: {{name}}',
            body: `<p>Great news! A deal has just been marked as Won.</p>
<p><strong>Lead:</strong> {{name}}<br>
<strong>Service:</strong> {{service}}<br>
<strong>Source:</strong> {{source}}</p>`,
          },
        },
      ],
    },
  },
  {
    id: 'appointment-confirmation',
    name: 'Appointment confirmation',
    description: 'Send a confirmation email when an appointment is booked',
    category: 'appointments',
    emoji: '📅',
    definition: {
      trigger: { triggerType: 'appointment_created', config: {} },
      steps: [
        {
          id: 's1',
          type: 'action',
          actionType: 'send_email',
          label: 'Booking confirmation',
          config: {
            to: '{{email}}',
            subject: 'Your appointment is confirmed, {{name}}!',
            body: `<p>Hi {{name}},</p>
<p>Your appointment has been confirmed:</p>
<p>📅 <strong>{{date}}</strong><br>
🕐 <strong>{{time}}</strong><br>
📍 <strong>{{location}}</strong></p>
<p>If you need to reschedule, please reply to this email.</p>
<p>Looking forward to seeing you!</p>`,
          },
        },
      ],
    },
  },
  {
    id: 'idle-followup',
    name: 'Idle lead re-engagement',
    description: 'Reach out automatically when a lead has had no activity for 7 days',
    category: 'nurture',
    emoji: '💤',
    definition: {
      trigger: { triggerType: 'idle_lead', config: { days: 7, statuses: ['new', 'contacted', 'qualified'] } },
      steps: [
        {
          id: 's1',
          type: 'action',
          actionType: 'send_email',
          label: 'Re-engagement email',
          config: {
            to: '{{email}}',
            subject: 'Still interested, {{name}}?',
            body: `<p>Hi {{name}},</p>
<p>I noticed we haven't connected in a while. I just wanted to check in and see if you're still looking for help with {{service}}.</p>
<p>If the timing wasn't right before, no worries at all. We'd love to help whenever you're ready.</p>
<p>Feel free to reply to this email or give us a call.</p>
<p>Best regards</p>`,
          },
        },
      ],
    },
  },
  {
    id: 'qualified-nurture',
    name: 'Qualified lead nurture',
    description: 'Send a follow-up email 2 days after a lead is qualified, then notify the team',
    category: 'nurture',
    emoji: '🌱',
    definition: {
      trigger: { triggerType: 'lead_status_changed', config: { toStatus: 'qualified' } },
      steps: [
        {
          id: 's1',
          type: 'action',
          actionType: 'send_email',
          label: 'Qualified confirmation',
          config: {
            to: '{{email}}',
            subject: 'Next steps for {{name}}',
            body: `<p>Hi {{name}},</p>
<p>Thanks for taking the time to chat with us. We're excited about the opportunity to work together on {{service}}.</p>
<p>Our team will be in touch shortly to discuss the next steps.</p>
<p>Best regards</p>`,
          },
        },
        {
          id: 's2',
          type: 'delay',
          label: 'Wait 2 days',
          duration: 2,
          unit: 'days',
        },
        {
          id: 's3',
          type: 'action',
          actionType: 'notify_team',
          label: 'Remind team to follow up',
          config: {
            subject: '⏰ Follow up with {{name}} today',
            body: `<p>This is a reminder to follow up with <strong>{{name}}</strong> ({{email}}) who was qualified 2 days ago.</p>
<p>Service: {{service}}</p>`,
          },
        },
      ],
    },
  },
]

export const TEMPLATE_CATEGORIES = [
  { id: 'all', label: 'All templates' },
  { id: 'sales', label: 'Sales' },
  { id: 'nurture', label: 'Nurture' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'operations', label: 'Operations' },
]
