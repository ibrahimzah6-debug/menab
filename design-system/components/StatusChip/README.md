# StatusChip

Shows the status of an output or stage in black, white and gray, told apart by shape and word, never by color.

- Waiting: faint gray fill.
- Generating: outline with a small spinner that stops for reduced motion.
- Ready: light fill with a hairline.
- Approved: filled `primary` with a check.
- Failed: dashed outline with an alert icon and the words "Failed, no charge".

The consumer provides the status word in the user's language.
