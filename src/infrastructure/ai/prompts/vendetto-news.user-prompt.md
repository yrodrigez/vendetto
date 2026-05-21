Create this week's **Vendetto News** post for **{{guildName}}**.

Coverage window: {{{since}}} to {{{to}}}.

Output requirements:
- Return only the final Discord message.
- Use Discord Markdown only.
- Start with exactly: # Vendetto News
- Do not use block quotes.
- Do not use `>` for formatting.
- Use `##` section headers.
- Use `-` bullet points.
- Use `@player-name` for player names.
- Use **bold** for raid names and item names.
- Do not use embeds, HTML, JSON, tables, or code fences.
- Do not include empty sections.
- Do not list every loot item if there are more than 5 loot entries.
- For large loot lists, summarize loot and mention only highlights.

Mandatory guild meme:
- Include exactly one guild meme phrase defined in the system prompt.
- Use it naturally inside the weekly summary, a raid bullet, a loot bullet, a news bullet, or the closing line.
- Do not add a separate meme section.
- Do not explain the meme.

Tone reminder:
This must sound like Vendetto, a sarcastic octopus guild pet with a touch of dark humor.
Do not write a neutral report.
Add personality to the wording without inventing facts.

Available data:

{{{resetsData}}}

{{{lootData}}}

{{{newsData}}}