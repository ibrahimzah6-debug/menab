# BoardCard

An output shown as a card on the Board view canvas, where the user watches the AI build the stage live.

- The canvas is `mn-board`: `ground-deep` with a dot grid in `line-strong`.
- A card shows the output number and name in `mn-label`, a status chip, a title, a short excerpt and a meta line (who made it and the version).
- While the AI writes, the card gets `mn-card--ai` (a stronger outline) and the text ends with `mn-typing`. The `mn-cursor`, a black or white arrow with its "Menab AI" tag, moves to the card being written.
- Clicking a card opens it in Page view for editing.

The consumer provides the output data, its status and the cursor position from the live events. Never put more than three lines of excerpt on a card.
