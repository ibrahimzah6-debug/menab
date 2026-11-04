# Provider test brief (M1)

A sample brief written by Claude for the AI provider test, because no past ZAH brief was available. It follows the style the docs suggest: a 30 second Ramadan ad. The brand is made up, so no real company's logo or product is generated.

## The brief

**Client:** Dalla Home (fictional Saudi kitchen appliance brand)
**Product:** the Dalla air fryer, matte black with a copper ring around the single button
**Length:** 30 seconds, plus 15 and 6 second cutdowns
**Formats:** 16:9 for TV, 9:16 for Instagram
**Language:** Arabic voiceover in Saudi dialect
**Tone:** warm, calm, family focused
**Idea:** the last minutes before iftar in a Riyadh home. The mother races the clock between three pots. Her daughter takes over with one button on the Dalla air fryer, and the family sits down as the adhan begins.
**Line:** "دلة هوم. وقتك لأهلك." (Dalla Home. Your time is for your family.)

## What the test generates

Each step uses the results of the step before, the way the real Generate stage will.

| Key | Step | What | Uses |
| --- | --- | --- | --- |
| C1 | Character | Umm Faisal, the mother, mid 40s | |
| C2 | Character | Noura, the daughter, early 20s | |
| L1 | Location | The family kitchen in Riyadh, late afternoon | |
| L2 | Location | A Riyadh street at sunset before iftar | |
| K1 | Keyframe | Wide shot of the street at sunset (the AI shot) | L2 |
| K2 | Keyframe | Close-up of the mother checking three pots, wall clock behind | C1, L1 |
| K3 | Keyframe | The daughter places the air fryer, its box shows Arabic text | C2, L1 |
| V1 | Video | K1 with a slow push in, cars moving | K1 |
| V2 | Video | K2 handheld, steam rises, the mother turns | K2 |
| V3 | Video | K3 slow dolly in, she presses the button | K3 |

Images run on Nano Banana 2. Each video shot runs on Kling 3.0, Seedance 2.5 and Veo 3.1 Fast, so the three can be compared on the same frames.

## How to score

For each result, score 1 to 5:

- **Quality:** would you show it to a client
- **Consistency:** does the character or place look the same as its reference
- **Arabic text:** only for K3 (is the Arabic on the box correct and readable)

**Pass rule** (from system-architecture.md): a provider becomes the main one for a model if it succeeds on at least 95% of runs and scores no worse than 1 point below the best on quality.
