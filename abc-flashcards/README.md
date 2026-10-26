# ABC flashcards

English alphabet flashcards for a Japanese learner who reads katakana.

- `index.html` is the whole app. It needs no build step.
- `audio/` holds 52 recorded clips: `letter-a.mp3` to `letter-z.mp3` and `word-apple.mp3` to `word-zebra.mp3`.
- Progress and spaced repetition are stored in Supabase (the `English Alphabet` deck, `card_state` and `attempts` tables).

To host it, serve this folder as a static site. On Vercel, set the project's root directory to `abc-flashcards`.
