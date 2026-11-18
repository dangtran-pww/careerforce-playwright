// The cells of one Markdown table row ("| a | b \| c |" → ["a", "b | c"]).
// An escaped pipe (\|) is part of its cell, as in GitHub's Markdown, and
// comes back as a plain "|". The pipes at either end are optional.
const PIPE = /(?<!\\)\|/;

export function tableCells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/(?<!\\)\|$/, '')
    .split(PIPE)
    .map((c) => c.trim().replace(/\\\|/g, '|'));
}
