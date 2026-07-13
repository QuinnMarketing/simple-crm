import { CheckCircle2, XCircle } from 'lucide-react'

export const metadata = { title: 'Payment' }

export default async function PayResultPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; invoice?: string; kind?: string }>
}) {
  const { status, invoice, kind } = await searchParams
  const success = status === 'success'
  const isDeposit = kind === 'deposit'

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        {success ? (
          <>
            <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Payment received</h1>
            <p className="text-slate-600 text-sm">
              {isDeposit
                ? 'Your deposit has been paid and your booking is confirmed.'
                : 'Thank you — your payment has been processed successfully.'}
              {invoice ? <> Reference: <span className="font-medium">{invoice}</span>.</> : null}
            </p>
            <p className="text-slate-400 text-xs mt-4">A receipt has been sent by Stripe to your email.</p>
          </>
        ) : (
          <>
            <XCircle className="w-14 h-14 text-slate-300 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Payment cancelled</h1>
            <p className="text-slate-600 text-sm">
              No payment was taken{invoice ? <> for <span className="font-medium">{invoice}</span></> : null}. You can close this window and try again, or contact the business if you need help.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
