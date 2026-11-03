# Start here

1. Open Claude Code and start a new session on a new, empty GitHub repository called `menab`.
2. Unzip this folder and add everything in it to the repository: `CLAUDE.md` at the top, plus the `docs`, `design-system` and `screens` folders.
3. Paste the message below and press enter.

---

Read CLAUDE.md and every file in docs/ and design-system/ first, and look at the PNGs in screens/. Then tell me in 5 lines what Menab is and what M0 covers, so I know you understood.

After that, walk me through setting up the accounts one at a time. For each one, tell me exactly where to go, what to click, and what to copy back to you. Wait for me to say "done" before moving to the next. Keep track of what is finished.

The accounts and keys:
1. GitHub (connected already, just confirm the repo)
2. Supabase: create a new project called "menab" in Frankfurt, then the project URL and keys
3. Anthropic API key
4. Vercel, linked to the GitHub repo
5. Kie.ai and fal.ai keys (these can wait until M1)

Never ask me to paste a secret key into the chat. Tell me where to put it (.env.local or Vercel settings) instead. When all of this is done, start building M0.
