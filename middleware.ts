import NextAuth from 'next-auth'
import { authConfig } from './auth.config'

export default NextAuth(authConfig).auth

export const config = {
  // api/visit-ingest is a server-to-server endpoint guarded by its own shared
  // secret, so it must bypass the session check like the other public routes.
  matcher: ['/((?!api/auth|api/webhooks|api/signup|api/visit-ingest|_next/static|_next/image|favicon.ico).*)'],
}
