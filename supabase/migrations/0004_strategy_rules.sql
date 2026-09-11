-- Roadmap V2 A15 — strategy entry-rule checklist (PRD §8).
-- Additive & backward compatible.

alter table public.user_strategies
  add column if not exists entry_rules text[] default '{}';

alter table public.journal_entries
  add column if not exists rule_checks jsonb default '[]';
  -- shape: [{ "rule": text, "checked": bool }] — snapshot of the strategy's
  -- entry_rules at entry time. Text-snapshot so later rule edits don't rewrite
  -- historical compliance.
