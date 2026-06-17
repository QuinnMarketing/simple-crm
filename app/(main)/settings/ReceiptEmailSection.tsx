'use client'
import { useState, useEffect } from 'react'
import { Copy, Mail, CheckCircle2, AlertCircle } from 'lucide-react'

export default function ReceiptEmailSection() {
  const [receiptEmail, setReceiptEmail] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/account/receipt-email')
      .then(r => r.json())
      .then(data => {
        if (data.receiptEmail) {
          setReceiptEmail(data.receiptEmail)
        } else {
          setError(data.error || 'Failed to load receipt email')
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  function copyToClipboard() {
    if (receiptEmail) {
      navigator.clipboard.writeText(receiptEmail)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Email Receipt Submission</h3>
        <p className="text-sm text-slate-600">
          Send receipt images directly to your account email address. They'll be automatically processed with OCR and stored in your receipt inbox for assignment to projects.
        </p>
      </div>

      {loading ? (
        <div className="animate-pulse bg-slate-100 h-12 rounded-lg" />
      ) : error ? (
        <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      ) : receiptEmail ? (
        <>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
              Your Receipt Email Address
            </label>
            <div className="flex items-center gap-3">
              <code className="flex-1 text-sm font-mono text-slate-900 break-all">{receiptEmail}</code>
              <button
                onClick={copyToClipboard}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition-colors"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-green-600">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Setup Instructions
              </h4>
              <div className="space-y-3 text-sm text-slate-600">
                <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                  <p className="font-medium text-slate-900">Option 1: Mailgun (Recommended)</p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600">
                    <li>Go to <a href="https://app.mailgun.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Mailgun.com</a></li>
                    <li>In "Receiving", click "Create Route"</li>
                    <li>Filter: <code className="bg-white px-2 py-1 rounded text-xs">catch_all()</code></li>
                    <li>Action: <code className="bg-white px-2 py-1 rounded text-xs">forward("https://simple-crm-steel.vercel.app/api/receipts/email")</code></li>
                    <li>Send emails to your receipt address — they'll be automatically processed</li>
                  </ol>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                  <p className="font-medium text-slate-900">Option 2: Postmark</p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600">
                    <li>Go to <a href="https://postmarkapp.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Postmark</a> → Server Settings</li>
                    <li>Enable "Inbound Hook" in the Inbound tab</li>
                    <li>Webhook URL: <code className="bg-white px-2 py-1 rounded text-xs">https://simple-crm-steel.vercel.app/api/receipts/email</code></li>
                    <li>Verify your domain for inbound emails</li>
                  </ol>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                  <p className="font-medium text-slate-900">Option 3: SendGrid</p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600">
                    <li>Settings → Inbound Parse → Add Host</li>
                    <li>Hostname: your receipt email domain</li>
                    <li>POST URL: <code className="bg-white px-2 py-1 rounded text-xs">https://simple-crm-steel.vercel.app/api/receipts/email</code></li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-blue-900">💡 Sending Receipts</p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Attach receipt images (JPG, PNG, PDF)</li>
                <li>• Subject optional: e.g., "Receipt: $50 Vendor: Acme"</li>
                <li>• OCR automatically extracts amount, vendor, date</li>
                <li>• Receipts appear in Settings → Pending Receipts inbox</li>
                <li>• Assign to project to create expense</li>
              </ul>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
