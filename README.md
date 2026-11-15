# MentalSpa.club

A quiet place to breathe, focus and train your mind. Live at https://mentalspa.club

Rooms in three groups:

- **Calm:** Breathe, Meditate (not built yet), Garden (not built yet)
- **Practice:** Matrices, Shapes, Numbers, Logic. No clock, no score, logic explained.
- **Challenge:** Daily Five, Ranked Test

Practice only. Nothing here is a validated test and no score is an IQ.

## How it is built

Plain HTML and JavaScript, no build step. Vercel serves the files as they are.

| File | What it is |
|---|---|
| `index.html` | The whole site: home page, every room, styles |
| `matrices.js` | Matrices engine (codes `L3-48213`) |
| `numbers.js` | Numbers engine (codes `N3-48213`) |
| `shapes.js` | Shapes engine (codes `S3-48213`) |
| `logic.js` | Logic engine (codes `D3-48213`) |
| `tools/` | Independent checkers that re-solve thousands of puzzles |

The engines have no page code in them and also run in Node, so they can be checked from the command line:

```
node tools/check-matrices.js            # 20,000 puzzles, about a minute
node tools/check-logic.js 2000          # 30,000 puzzles over both wordings
```

Scores, streaks and history stay in the browser (localStorage). No accounts, no server.

## Plan

This version will move to React + Vite in this same repository, so that the breathing app
(github.com/Mindlogic26/breathing-app) can join as the Breathe room. The engines move across unchanged.
