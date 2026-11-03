# StageBar

The row at the top of every project that shows where the user is: "Stage 2 of 6".

Done stages show a check in `ink-muted` and open read-only. The current stage is a filled `primary` pill with `aria-current="step"`. Future stages show in `ink-faint` and are locked. Only stages for the project's path appear: 6 on the AI path, 7 on production and hybrid. The consumer provides the stage list and the current index. On a phone the bar scrolls sideways inside its own container.
