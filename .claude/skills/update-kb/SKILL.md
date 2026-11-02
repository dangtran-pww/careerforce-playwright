---
name: update-kb
description: Bring the CareerForce knowledge base in docs/kb up to date with the mn-careerforce source code. Finds what changed since the commit recorded in docs/kb/README.md, updates only the affected docs with the kb-manager agent, and moves the recorded source commit and submodule commits forward. Use when the user asks to update, refresh or sync the KB with the latest code.
argument-hint: [target commit or branch, default master]
---

# Update the knowledge base from the code

The KB is a snapshot of one commit of `mn-careerforce`. `docs/kb/README.md`
records that commit (the **Source** line) and the commit of each git
submodule (the table under it). This skill finds what changed since then,
updates the docs, and moves the recorded commits forward.

Optional argument: `$ARGUMENTS` (a commit or branch to update to; default
`master`).

## 1. Read the recorded version

Read `docs/kb/README.md`. Note the old master commit and the old commit of
each submodule (civiserv, user_policies, dismae).

## 2. Find the target version

The source is the read-only clone at `../mn-careerforce-php83`. Never edit,
commit, checkout, reset, pull or fetch in it.

Start each Bash command with
`export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin;`.

1. Target master commit:
   `git -C ../mn-careerforce-php83 log -1 --format='%h %cs %s' <target>`
2. Target submodule commits:
   `git -C ../mn-careerforce-php83 ls-tree <target> web/modules/custom/civiserv web/modules/custom/user_policies web/modules/custom/dismae`
   Then get each one's date and subject with
   `git -C ../mn-careerforce-php83/<submodule path> log -1 --format='%h %cs' <sha>`.
3. If the old commit is not in the clone (`git cat-file -e <old>` fails),
   stop and tell the user. The clone may be out of date, and they need to
   pull it. Do not try to fetch.
4. If the target master commit and all three submodule commits equal the
   recorded ones, tell the user the KB is already current and stop.

## 3. Find what changed

Read the committed history, not the working tree.

- Main repo, custom code only:
  `git -C ../mn-careerforce-php83 diff --stat <old> <target> -- web/modules/custom web/themes/custom config`
  and `git log --oneline <old>..<target>` for the story (ticket) names.
- Each submodule whose commit moved:
  `git -C ../mn-careerforce-php83/<path> diff --stat <old> <new>` and
  `git log --oneline <old>..<new>`. If the submodule's objects are missing,
  say so and list it as not checked.
- Ignore changes with no user-facing effect (tests, formatting, comments,
  lockfiles, core/contrib updates).

If nothing user-facing changed, skip to step 5 and only move the recorded
commits.

## 4. Update the docs with the kb-manager agent

Launch the `kb-manager` agent (Agent tool, `subagent_type: "kb-manager"`).
Give it, in the prompt:

- The old and new commits (master and submodules) and the changed file list
  and ticket names from step 3, so it does not have to rediscover them.
- The instruction to read the diffs with `git -C ../mn-careerforce-php83 diff
  <old> <new> -- <paths>` and update **only the docs affected**, following its
  own writing rules (plain language, no code names, no secrets, "appears to"
  for anything inferred).
- To add a new doc, and list it in its folder `README.md` and the top
  `docs/kb/README.md`, when a whole new feature appeared. To rewrite or
  remove a section when a feature was removed or changed.
- To run the link check afterwards.
- **Not** to move the recorded version yet. That is step 5.
- Not to commit, push or publish anything.

For a large diff, split it by area and launch several agents in one message,
one per area folder, so they do not edit the same files.

## 5. Move the recorded version

Do this only after step 4 finished without errors. Edit `docs/kb/README.md`:

- The **Source** line: new master commit, its date and its subject or ticket,
  in the existing format: ``master` at commit `db37480b7` (2026-10-28,
  MNDEED-8343)``. Keep the same commit length as the old one.
- The submodule table: new commit and date for each submodule that moved. Leave
  unmoved ones as they are.
- The area rows, if a new doc or area changed what an area covers.

Then check the line reads right by Grepping the README for the new commit.

## 6. Report

Tell the user:

- The old and new version (master and each submodule that moved).
- The changes found, in plain language, and the docs you added, rewrote,
  moved or removed.
- The link check result.
- Anything not checked (a submodule with missing objects) or not confirmed
  from the code.
- That nothing was committed. `docs/kb` may be uncommitted, so remind them to
  review the changes.
