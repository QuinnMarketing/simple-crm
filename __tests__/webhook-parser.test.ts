import { describe, it, expect } from 'vitest'
import { parseWebhookPayload } from '@/lib/webhook-parser'

describe('parseWebhookPayload', () => {
  describe('generic flat payloads', () => {
    it('extracts standard contact fields', () => {
      const lead = parseWebhookPayload({
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '0400000000',
        service: 'Concreting',
        message: 'Need a driveway',
      })
      expect(lead.name).toBe('Jane Doe')
      expect(lead.email).toBe('jane@example.com')
      expect(lead.phone).toBe('0400000000')
      expect(lead.service).toBe('Concreting')
      expect(lead.notes).toBe('Need a driveway')
    })

    it('matches key variants (spaces / hyphens / no separator / case)', () => {
      expect(parseWebhookPayload({ full_name: 'Bob' }).name).toBe('Bob')
      expect(parseWebhookPayload({ 'Full Name': 'Bob' }).name).toBe('Bob')
      expect(parseWebhookPayload({ EMAIL: 'x@y.com' }).email).toBe('x@y.com')
      expect(parseWebhookPayload({ phonenumber: '123' }).phone).toBe('123')
    })

    it('falls back to "Unknown" when no name field is present', () => {
      expect(parseWebhookPayload({ email: 'a@b.com' }).name).toBe('Unknown')
    })

    it('always includes the raw payload as formData', () => {
      const body = { name: 'Jane', email: 'j@x.com' }
      const lead = parseWebhookPayload(body)
      expect(lead.formData).toBe(JSON.stringify(body))
    })
  })

  describe('attribution extraction', () => {
    it('reads explicit flat UTM / click-id fields', () => {
      const lead = parseWebhookPayload({
        name: 'Jane',
        utm_source: 'google',
        utm_medium: 'cpc',
        gclid: 'gclid-123',
      })
      expect(lead.utmSource).toBe('google')
      expect(lead.utmMedium).toBe('cpc')
      expect(lead.gclid).toBe('gclid-123')
      expect(lead.source).toBe('google')
    })

    it('parses attribution out of the page URL query string when flat fields absent', () => {
      const lead = parseWebhookPayload({
        name: 'Jane',
        page_url:
          'https://acme.com/lp?utm_source=facebook&utm_campaign=spring&fbclid=fb-1&suburb=Bondi',
      })
      expect(lead.utmSource).toBe('facebook')
      expect(lead.utmCampaign).toBe('spring')
      expect(lead.fbclid).toBe('fb-1')
      expect(lead.suburb).toBe('Bondi')
    })

    it('prefers explicit flat fields over the page URL query string', () => {
      const lead = parseWebhookPayload({
        name: 'Jane',
        utm_source: 'linkedin',
        page_url: 'https://acme.com/lp?utm_source=facebook',
      })
      expect(lead.utmSource).toBe('linkedin')
    })
  })

  describe('Elementor payloads', () => {
    it('parses a fields array keyed by id', () => {
      const lead = parseWebhookPayload({
        form_name: 'Contact',
        fields: [
          { id: 'name', title: 'Name', value: 'Elle Menter' },
          { id: 'email', title: 'Email', value: 'elle@example.com' },
          { id: 'message', title: 'Message', value: 'Hi there' },
        ],
      })
      expect(lead.name).toBe('Elle Menter')
      expect(lead.email).toBe('elle@example.com')
      expect(lead.notes).toBe('Hi there')
    })

    it('parses a fields object (keyed) form', () => {
      const lead = parseWebhookPayload({
        form_id: 'abc',
        fields: {
          f1: { id: 'name', value: 'Keyed Person' },
          f2: { id: 'email', value: 'keyed@example.com' },
        },
      })
      expect(lead.name).toBe('Keyed Person')
      expect(lead.email).toBe('keyed@example.com')
    })
  })

  describe('Typeform payloads', () => {
    it('parses answers by type and merges hidden fields', () => {
      const lead = parseWebhookPayload({
        form_response: {
          definition: {
            fields: [
              { title: 'Name' },
              { title: 'Email' },
              { title: 'Phone' },
            ],
          },
          answers: [
            { type: 'short_text', text: 'Tay Form' },
            { type: 'email', email: 'tay@example.com' },
            { type: 'phone_number', phone_number: '0411111111' },
          ],
          hidden: { utm_source: 'google', gclid: 'g-1' },
        },
      })
      expect(lead.name).toBe('Tay Form')
      expect(lead.email).toBe('tay@example.com')
      expect(lead.phone).toBe('0411111111')
      expect(lead.utmSource).toBe('google')
      expect(lead.gclid).toBe('g-1')
    })
  })
})
