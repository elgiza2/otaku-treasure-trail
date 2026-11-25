<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Keep game ad benefits atomic and idempotent in SQL, called only after verified Telegram authentication; retries must reuse the completed ad's request ID to avoid duplicate rewards.
- Use shared game-model rules and GameAdButtons/EnergyBar controls for battle and raid rewards so both ad providers and energy behavior stay consistent.
- Store squad scoring by UTC week and settle earned prizes in SQL; public board reads expose only squad aggregates, never member Telegram IDs.
- Attribute channel acquisition only during first verified Telegram registration in an atomic SQL function; repeat visits and self-referrals must not pay.
- Keep partner balances separate from game balances and reserve withdrawal funds transactionally; owner-only report reads and manual payment reviews must revalidate the server role.
- Record actual ad income and costs separately from view counts in daily reports; missing monetary data stays unknown rather than estimating profit from views.
- Merge expansion English fallback text below existing locale entries, leaving Arabic untranslated and preserving every existing language-specific translation.
- Keep engagement state, duel escrow, referral milestones and paid boosts in transaction-locked SQL; verified TON settlement is the only path granting purchased packs, to prevent duplicate rewards.
- Use AppFrame and five primary navigation destinations, with contextual team tabs and GrowthPanel sections; this keeps secondary features accessible without crowding each screen.
- Story sharing uses a public image endpoint and grants no completion reward; Telegram opening the story editor is not proof of publication.
