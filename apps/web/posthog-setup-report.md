# PostHog post-wizard report

The wizard has completed a deep integration of your Next.js 16.1.0 project with PostHog analytics. The integration includes:

- **Client-side initialization** via `instrumentation-client.ts` using the recommended Next.js 15.3+ approach
- **Server-side client** via `src/lib/posthog-server.ts` for server-side event tracking
- **Reverse proxy configuration** in `next.config.ts` to route PostHog requests through `/ingest` endpoints
- **User identification** on signup and sign-in to correlate user behavior across sessions
- **Automatic exception capturing** enabled for error tracking
- **Environment variables** configured in `.env.local` with `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`

## Events Instrumented

| Event Name | Description | File Path |
|------------|-------------|-----------|
| `user_signed_up` | User successfully creates a new account | `src/components/sign-up-form.tsx` |
| `user_signed_in` | User successfully signs in to their account | `src/components/sign-in-form.tsx` |
| `two_factor_verified` | User successfully verifies two-factor authentication | `src/components/sign-in-form.tsx` |
| `passkey_sign_in` | User signs in using a passkey | `src/components/sign-in-form.tsx` |
| `organization_created` | User creates a new organization during onboarding | `src/components/forms/create-organization-form.tsx` |
| `subscription_checkout_started` | User initiates subscription checkout process | `src/app/(subscription)/[orgSlug]/upgrade/page.tsx` |
| `aws_account_connected` | User successfully connects an AWS account | `src/components/forms/connect-aws-account-form.tsx` |
| `template_created` | User creates a new email template | `src/components/template-editor/new-template-form.tsx` |
| `broadcast_sent` | User sends or schedules a broadcast email to contacts | `src/app/(dashboard)/[orgSlug]/emails/broadcasts/new/components/batch-form.tsx` |
| `invitation_sent` | User sends an invitation to join their organization | `src/components/members/invite-member-dialog.tsx` |
| `invitation_accepted` | User accepts an invitation to join an organization | `src/components/invitations/accept-invitation-form.tsx` |
| `invitation_declined` | User declines an invitation to join an organization | `src/components/invitations/decline-invitation-form.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

### Dashboard
- [Analytics basics](https://us.posthog.com/project/252161/dashboard/1001266) - Key metrics for user engagement, conversion, and growth

### Insights
- [User Signups Over Time](https://us.posthog.com/project/252161/insights/JZN9pyxb) - Track new user signups to measure growth
- [Signup to Organization Created Funnel](https://us.posthog.com/project/252161/insights/fSPZWokB) - Conversion funnel from signup to creating an organization
- [Subscription Checkout Conversion](https://us.posthog.com/project/252161/insights/eiXtWMaj) - Track users who start the subscription checkout process
- [Onboarding to AWS Account Connected](https://us.posthog.com/project/252161/insights/neAaM894) - Conversion funnel from organization creation to connecting AWS account
- [Email Broadcasts Sent](https://us.posthog.com/project/252161/insights/zCTgfqhH) - Track email broadcast activity to measure platform engagement

## Files Created/Modified

### New Files
- `instrumentation-client.ts` - Client-side PostHog initialization
- `src/lib/posthog-server.ts` - Server-side PostHog client
- `posthog-setup-report.md` - This report

### Modified Files
- `.env.local` - Added `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` environment variables
- `next.config.ts` - Added PostHog reverse proxy rewrites and `skipTrailingSlashRedirect` setting
- All event tracking files listed in the table above
