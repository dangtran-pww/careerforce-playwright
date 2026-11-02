---
name: ask-kb
description: Answer a question about how CareerForce works (features, roles, rules, pages, who can do what) from the knowledge base in docs/kb, using the kb-manager agent. Use when the user asks how a CareerForce feature behaves, who can do something, or what a page or setting does. Does not edit the KB.
argument-hint: <question about CareerForce>
---

# Ask the CareerForce knowledge base

The user asks a question about CareerForce. Question: `$ARGUMENTS`

If no question was given, ask for one and stop.

## 1. Delegate to the kb-manager agent

Launch the `kb-manager` agent (Agent tool, `subagent_type: "kb-manager"`) with
a prompt that:

- Gives the user's question word for word.
- Says this is a **question only**: answer from `docs/kb`, and do not add,
  edit, move or remove any file.
- Asks it to cite the KB docs it used as relative links
  (for example `docs/kb/appointments/booking-an-appointment.md`).
- Asks it to say plainly when the KB does not cover the question. In that
  case it may check the source code, read only, and must mark that part of the
  answer as coming from the code, not the KB.
- Asks it to keep any "appears to" hedge the KB uses.

Do not answer from your own memory or from the code yourself. The KB is the
source.

## 2. Relay the answer

Give the user the agent's answer in plain language, with the doc links as
markdown links. Keep these points visible:

- **Where it came from:** the KB docs, or the source code. If it came from the
  code, say it is not in the KB yet.
- **Gaps:** if the KB did not cover it, offer to add it, but do not add it
  unless the user asks. Adding or updating docs is a separate request to the
  `kb-manager` agent.

If the question spans several areas, the agent may give a combined answer.
Pass it on as one answer, not a list of separate reports.
