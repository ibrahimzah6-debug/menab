# Button

Every Menab button is a pill in black, white or gray, set in the `button` style, with a clear verb.

- `mn-btn--primary`: the one main action of a view, such as Approve stage. Charcoal in light, off-white in dark.
- `mn-btn--secondary`: everyday actions, including Generate and Regenerate. Show the cost inside with `mn-btn__cost` before the user clicks.
- `mn-btn--ghost`: low-weight actions such as Versions or Cancel.
- `mn-btn--accent`: Storyflow's orange, used rarely: only the single most important call to action on a screen, such as Start your project on the website. Most app screens have none.
- `mn-btn--sm`: 32px height for dense rows and cards.

The consumer provides the label and, for generate actions, the cost. One primary button per view and at most one accent button per screen. Labels start with a verb and never end with punctuation.
