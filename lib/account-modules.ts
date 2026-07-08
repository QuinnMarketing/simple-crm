import { prisma } from './prisma'
import { MODULES, DEFAULT_ON_KEYS, type ModuleKey } from './modules'

const ALL_KEYS = MODULES.map(m => m.key)

type ScopedUser = { role?: string | null; accountId?: string | null; accountIds?: string[] | null }

/**
 * Resolves the set of enabled module keys for an account: start from the
 * default-on set, then apply the account's AccountModule overrides. The legacy
 * `featTakeoffs` boolean is honoured as an override for the `takeoffs` module
 * so nothing regresses before the admin UI writes real rows.
 *
 * Master admins get every module (they administer all accounts).
 */
export async function getEnabledModules(user: ScopedUser, accountId: string | null): Promise<Set<ModuleKey>> {
  if (user.role === 'master_admin') return new Set(ALL_KEYS)
  if (!accountId) return new Set(DEFAULT_ON_KEYS)
  return getEnabledModulesForAccount(accountId)
}

export async function getEnabledModulesForAccount(accountId: string): Promise<Set<ModuleKey>> {
  const [account, overrides] = await Promise.all([
    prisma.account.findUnique({ where: { id: accountId }, select: { featTakeoffs: true } }),
    prisma.accountModule.findMany({ where: { accountId }, select: { moduleKey: true, enabled: true } }),
  ])

  const enabled = new Set<ModuleKey>(DEFAULT_ON_KEYS)

  // Legacy flag: treat an on featTakeoffs as a takeoffs override, unless an
  // explicit AccountModule row for takeoffs exists (that wins below).
  if (account?.featTakeoffs) enabled.add('takeoffs')

  const overrideKeys = new Set(overrides.map(o => o.moduleKey))
  for (const o of overrides) {
    if (!ALL_KEYS.includes(o.moduleKey as ModuleKey)) continue
    if (o.enabled) enabled.add(o.moduleKey as ModuleKey)
    else enabled.delete(o.moduleKey as ModuleKey)
  }
  // If takeoffs has an explicit row, it already applied above and overrode the
  // legacy flag; nothing more to do. (Guard kept for clarity.)
  void overrideKeys

  return enabled
}

/** True if a module is enabled for the resolved account. */
export async function isModuleEnabled(user: ScopedUser, accountId: string | null, key: ModuleKey): Promise<boolean> {
  const enabled = await getEnabledModules(user, accountId)
  return enabled.has(key)
}
