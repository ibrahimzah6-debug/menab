# Build decisions

Decisions made during the build, with the reason. Product decisions stay in product-foundation.md.

## B1. Job queue: Inngest (M0)

CLAUDE.md asks to pick Trigger.dev or Inngest in M0. We pick **Inngest**.

- It installs from the Vercel marketplace in a few clicks and sets its own keys in Vercel, so there is no extra secret to copy by hand.
- The jobs run inside the Menab app on Vercel, so there is one codebase and one deploy.
- Each step of a job retries on its own, and a job can wait for a provider's callback (`waitForEvent`) without using server time. That fits the AI layer: hold credits, call Kie.ai, retry once, switch to fal.ai, save the file, then charge.
- Trigger.dev would also work. It is stronger for single tasks that run for many minutes on its own servers, but our long waits are for provider callbacks, which Inngest handles without that.

Inngest is installed when the AI layer is built (M1 provider test and M5), not in M0, because M0 has no AI jobs.

## B2. Invites by link, not email (M0)

Supabase's built-in email only sends to members of the Supabase organization, and is limited to a few emails an hour. So the Admin creates a one-time invite link on the Team page and sends it on WhatsApp or email. A custom sender on menab.si can be added later if Ibrahim wants invite emails.

## B3. Hosting regions (M0)

Supabase in Frankfurt (eu-central-1), approved by Ibrahim on 3 Nov 2026 for internal testing. Vercel functions run in Frankfurt too (`vercel.json`), so the app sits next to its database.
