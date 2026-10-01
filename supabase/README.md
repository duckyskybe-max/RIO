Schema is applied through migrations (initial_schema, lock_down_handle_new_user, cards_level_text).
Project: kanji-study (ap-northeast-1), ref zvmbkxchzocvnnubjoju.
Tables: profiles, decks, cards, card_state, attempts - all with RLS. Progress rows are per-user;
a parent (profiles.parent_id) can read a child's card_state and attempts.
