// The expected CKEditor 5 toolbar of each text format on the Page body,
// read from QA with an admin session on 2026-11-12. The same table is in
// test-plans/smoke-ckeditor.md → "Toolbars"; change both when a ticket
// changes a toolbar.
//
// '·' is a separator and '⏎' a line break. 'Heading' is the heading dropdown
// (its label shows the current block, e.g. "Normal"). `null` means the
// format has no editor, only a plain text box.

const SEP = '·';
const BR = '⏎';

export const EXPECTED_TOOLBARS: Record<string, string[] | null> = {
  full_html: [
    'Full screen', SEP, 'Heading', SEP, 'Undo', 'Redo', SEP, 'Remove Format', SEP, 'Source', BR,
    'Block quote', 'Horizontal line', SEP,
    'Bold', 'Underline', 'Italic', 'Strikethrough', 'Superscript', 'Subscript', SEP,
    'Bulleted List', 'Numbered List', 'Decrease indent', 'Increase indent', SEP,
    'Text alignment', SEP, 'Insert Media', 'File Embed', 'Link', SEP,
    'Insert table', 'Styles', 'Accordion Item', 'Jump Link',
  ],
  basic_html: [
    'Full screen', SEP, 'Undo', 'Redo', BR, 'Block quote', SEP, 'Bold', 'Italic', SEP,
    'Bulleted List', 'Numbered List', 'Increase indent', 'Decrease indent', SEP,
    'Link', 'Accordion Item', 'Jump Link',
  ],
  restricted_html: [
    'Full screen', SEP, 'Heading', SEP, 'Undo', 'Redo', SEP, 'Source', BR,
    'Block quote', SEP, 'Bold', 'Italic', SEP,
    'Bulleted List', 'Numbered List', 'Increase indent', 'Decrease indent', SEP,
    'Insert Media', 'Link',
  ],
  html_email: [
    'Full screen', SEP, 'Undo', 'Redo', SEP, 'Source', BR, 'Block quote', SEP,
    'Bold', 'Italic', 'Underline', SEP,
    'Bulleted List', 'Numbered List', 'Decrease indent', 'Increase indent', SEP, 'Link',
  ],
  html_with_embeds: null,
  content_html: null,
  email_html: null,
};

/** Reads a `.ck-toolbar` in the same notation, in the browser. */
export function readToolbar(toolbar: Element): string[] {
  return Array.from(toolbar.querySelectorAll('.ck-toolbar__items > *')).map((item) => {
    if (item.classList.contains('ck-toolbar__separator')) return '·';
    if (item.classList.contains('ck-toolbar__line-break')) return '⏎';
    if (item.classList.contains('ck-heading-dropdown')) return 'Heading';
    const label =
      item.querySelector('.ck-button__label')?.textContent ??
      item.getAttribute('aria-label') ??
      '';
    return label.trim();
  });
}
