# Sequential Analytics — App Template

Battle-tested starter for business apps. Every file here has been shipped in production.

**Stack:** Next.js (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui + Supabase + Vercel

---

## What's included

### Project Config (bootstrap these first)
| File | Purpose |
|------|---------|
| `package.json` | All deps — Next 16, React 19, Supabase, shadcn, Tailwind v4, Zod, RHF, Recharts, xlsx |
| `next.config.ts` | Security headers + CSP (production-ready, ships as-is) |
| `tsconfig.json` | TypeScript strict mode + `@/*` path alias |
| `components.json` | shadcn/ui config — new-york style, RSC, Tailwind v4 |
| `postcss.config.mjs` | Tailwind v4 PostCSS config |
| `public/manifest.json` | PWA manifest — update name/short_name/theme_color |
| `public/sw.js` | Service worker — network-first nav, stale-while-revalidate assets |

### Foundation
| File | Purpose |
|------|---------|
| `src/app/globals.css` | Tailwind v4 imports, full light/dark theme, mobile fixes (iOS zoom, 44px targets) |
| `src/middleware.ts` | Session refresh on every request (Supabase JWT) |
| `src/app/layout.tsx` | Root layout — theme, PWA, Geist fonts |
| `src/app/page.tsx` | Root redirect → /dashboard |
| `src/app/not-found.tsx` | 404 page |
| `src/lib/utils.ts` | `cn()` utility (clsx + tailwind-merge) |
| `src/lib/app-config.ts` | App name, version, release notes |
| `src/lib/csv-export.ts` | Client-side CSV download |
| `src/lib/rate-limit.ts` | Upstash Redis sliding-window rate limiter |
| `src/lib/escape-ilike.ts` | Escape `%` and `_` in Postgres ILIKE search queries |
| `src/lib/format-utils.ts` | `formatDate`, `formatBool`, `formatPercent`, `formatCurrency`, `safeStr`, `freshnessColor`, `freshnessLabel` |
| `src/lib/entity-status.ts` | Status labels, badge colors, lock logic — copy/adapt per project |
| `src/types/next-pwa.d.ts` | PWA TypeScript definitions |

### Auth
| File | Purpose |
|------|---------|
| `src/app/login/page.tsx` | Email/password login |
| `src/app/forgot-password/page.tsx` | Password reset request |
| `src/app/reset-password/page.tsx` | Set new password — handles both invite flow and reset; detects new users and shows welcome message |
| `src/app/invite/accept/page.tsx` | Accept invite token → redirects to reset-password |
| `src/app/api/auth/callback/route.ts` | Supabase OAuth callback |
| `src/app/api/admin/invite/route.ts` | Generate invite links (admin only) |
| `src/app/api/admin/users/route.ts` | PATCH user role/active status |
| `src/hooks/use-user.ts` | Auth hook — profile, role, override, refresh |

### Layout
| File | Purpose |
|------|---------|
| `src/components/layout/app-shell.tsx` | Desktop + mobile wrapper, role banner |
| `src/components/layout/app-sidebar.tsx` | Desktop sidebar — **edit `navItems` array** |
| `src/components/layout/mobile-nav.tsx` | Fixed mobile bottom nav — **edit `navItems` array** |
| `src/components/session-timeout.tsx` | Auto-logout after inactivity |
| `src/components/pwa/register-sw.tsx` | Service worker registration |
| `src/app/(app)/layout.tsx` | Protected route group — wraps AppShell + Toaster |
| `src/app/(app)/error.tsx` | Error boundary — catches unhandled page errors, shows "Try Again" |
| `src/app/(app)/loading.tsx` | Loading UI — shown while server components stream |

### Protected Pages
| File | Purpose |
|------|---------|
| `src/app/(app)/dashboard/page.tsx` | Dashboard shell — replace with your content |
| `src/app/(app)/profile/page.tsx` + `profile-form.tsx` | User profile — name, avatar, password |
| `src/app/(app)/admin/users/page.tsx` | User management (admin only) |
| `src/app/(app)/help/page.tsx` | FAQ, release notes, feedback form, dev panel |
| `src/app/(app)/help/dev-panel.tsx` | Role impersonation, table viewer, feature flags |

### Components
| File | Purpose |
|------|---------|
| `src/components/ui/*` | All 25 shadcn/ui components (new-york style) |
| `src/components/admin/user-management.tsx` | Invite flow + user list + edit dialog |
| `src/components/file-upload.tsx` | Multi-file upload to Supabase Storage (images + docs) |
| `src/components/scope-filter.tsx` | `ScopeFilterSelect`, `ScopeBadge`, `filterByScope()` — personal/business tagging |
| `src/components/dashboard/kpi-card.tsx` | `KPICard` (headline metric) + `StatItem` (compact grid value) |

### API Patterns
| File | Purpose |
|------|---------|
| `src/app/api/entities/[id]/transition/route.ts` | **The full security checklist in one file.** Rate limit + auth + role check + self-action prevention + state machine validation + revalidation + fire-and-forget notify. Find/replace `entities`/`entity` to use for any workflow. |
| `src/app/api/oauth/callback/route.ts` | CSRF-protected OAuth callback — verifies state cookie, exchanges code, encrypts tokens, upserts to DB |
| `src/app/api/assistant/chat/route.ts` | Claude streaming SSE chat with tool use + image support. Replace tools + system prompt for your domain. |
| `src/app/api/assistant/analyze/route.ts` | Claude Vision → structured JSON extraction from uploaded documents. Update schema in system prompt. |

### OAuth & Encryption
| File | Purpose |
|------|---------|
| `src/lib/encrypt.ts` | AES-256-GCM `encrypt()` / `decrypt()` — for storing OAuth tokens, API keys, secrets in DB |
| `src/lib/oauth/fetch.ts` | Authenticated fetch wrapper with auto token refresh, rate limit handling, and revocation |

### AI Assistant
| File | Purpose |
|------|---------|
| `src/lib/assistant/example-context.ts` | Context builder pattern — parallel Supabase queries → compact plain-text for AI system prompt |

### Calculation Engine
| File | Purpose |
|------|---------|
| `src/lib/calculations/example-engine.ts` | Generic engine: inputs → breakdown object (pure TS) |
| `src/lib/calculations/__tests__/example-engine.test.ts` | Vitest tests for the engine |

### Supabase Clients
| File | Usage |
|------|-------|
| `src/lib/supabase/server.ts` | Server components + API routes (default) |
| `src/lib/supabase/client.ts` | Browser / client components |
| `src/lib/supabase/admin.ts` | Service role — bypass RLS (admin API routes only) |
| `src/lib/supabase/middleware.ts` | Session refresh middleware |

---

## Setup checklist

### 1. App identity
- [ ] Update `APP_NAME`, `APP_VERSION` in `src/lib/app-config.ts`
- [ ] Update nav items in `app-sidebar.tsx` and `mobile-nav.tsx`
- [ ] Update theme color in `src/app/layout.tsx` (`meta name="theme-color"`)
- [ ] Add your icons to `public/icons/`
- [ ] Update `public/manifest.json`

### 2. Supabase
- [ ] Create project, copy URL + keys to `.env.local`
- [ ] Run migrations for your schema
- [ ] Enable RLS on all tables
- [ ] Create `profiles` table (id, email, full_name, role, is_active, avatar_url, phone, title)
- [ ] Create `feedback` table (id, user_id, category, description, created_at)
- [ ] Create `avatars` storage bucket (public)
- [ ] Set up auth invite email template in Supabase dashboard

### 3. Rate limiting (optional but recommended)
- [ ] Create Upstash Redis database
- [ ] Add `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` to env

### 4. Domain restriction (optional)
- [ ] Uncomment and update the domain check in `src/app/login/page.tsx`
- [ ] Update `forgot-password/page.tsx` if domain restriction is needed there

### 5. Roles
- [ ] Update `ROLES` array in `src/components/admin/user-management.tsx`
- [ ] Update `ROLES` in `src/app/(app)/help/dev-panel.tsx`
- [ ] Update RLS policies to match your role names

### 6. Dev panel
- [ ] Add `NEXT_PUBLIC_DEV_PANEL_ENABLED=true` to `.env.local` for local dev
- [ ] Update `WATCHED_TABLES` in `dev-panel.tsx` to your table names
- [ ] Update `DEV_DOMAIN` in `help/page.tsx` to your dev email domain
- [ ] Add feature flags to `DEFAULT_FLAGS` in `dev-panel.tsx`

---

## Calculation engine pattern

Rename `example-engine.ts` and implement for your domain:

```ts
// 1. Define your inputs
interface MyInputs {
  lineItems: LineItem[]
  rate: number
  // ...
}

// 2. Define your output (expose every intermediate value)
interface MyResult {
  subtotal: number
  tax: number
  total: number
  // ...
}

// 3. Implement as a pure function
export function calculateMy(inputs: MyInputs): MyResult {
  // ... pure math, no side effects
}
```

Key rules:
- **Pure function** — same inputs always produce same outputs
- **Expose everything** — include all intermediate values in the result for display
- **Test everything** — one test per formula, use vitest globals
- **No framework deps** — no React, no Supabase in the engine

---

## File upload pattern

```tsx
<FileUpload
  entityId={recordId}
  bucket="my-bucket"        // Supabase storage bucket
  tableName="record_files"  // Supabase table for metadata
/>
```

Required table schema:
```sql
create table record_files (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references records(id) on delete cascade,
  storage_path text not null,
  file_name text,
  file_size bigint,
  mime_type text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz default now()
);
```

---

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=
UPSTASH_REDIS_REST_URL=         # optional, rate limiting
UPSTASH_REDIS_REST_TOKEN=       # optional, rate limiting
NEXT_PUBLIC_DEV_PANEL_ENABLED=  # true in dev, omit in prod

# AI Assistant (add if using assistant/chat or assistant/analyze routes)
ANTHROPIC_API_KEY=

# OAuth token encryption (add if using oauth/callback or oauth/fetch)
TOKEN_ENCRYPTION_KEY=            # 64-char hex: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## What's NOT included (by design)

These are app-specific — build them from the PLAYBOOK recipes:

- Domain-specific entity pages (jobs, customers, orders, etc.)
- Approval/review workflows → see PLAYBOOK §6
- CSV/Excel bulk import → see PLAYBOOK §9
- Reports and data export → see PLAYBOOK §10
- Notification edge functions

- AI assistant context builders → see PLAYBOOK §20
- OAuth provider integrations → see PLAYBOOK §21
- Unified calendar from multiple sources → see PLAYBOOK §23

**Canonical PLAYBOOK:** `/Users/sequential/Documents/sequential/projects/playbook/PLAYBOOK.md`
