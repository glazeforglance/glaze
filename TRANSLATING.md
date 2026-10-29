# Translating Glaze

Glaze's interface can be shown in more languages than English. Translations
are done on [Weblate](https://hosted.weblate.org/projects/glaze/), and every
contribution there turns into a pull request on this repository. You don't
need to know Git or JavaScript to help.

## Supported languages

<!-- Weblate status badge: replace with the badge from the project's "Share" page. -->
<!-- [![Translation status](https://hosted.weblate.org/widget/glaze/svg-badge.svg)](https://hosted.weblate.org/engage/glaze/) -->

<!-- i18n-status:start -->

| Language | Code | Translated |
| -------- | ---- | ---------- |
| English  | `en` | 100%       |

<!-- i18n-status:end -->

Updated with every release. The live status of work in progress is on
[Weblate](https://hosted.weblate.org/projects/glaze/).

A language that isn't complete yet still works: missing texts are shown in
English.

People pick their language in the user menu (the globe when login is off) or
on the login screen. Without a choice, Glaze follows the browser's language.

## Helping through Weblate

1. Open the [Glaze project on Weblate](https://hosted.weblate.org/projects/glaze/)
   and sign in.
2. Pick a language, or start a new one with **Start new translation**.
3. Translate. There are two parts:
   - **app**: the interface itself (buttons, menus, messages);
   - **fields**: the labels and help texts of every widget, page and setting.
4. Weblate collects the changes and opens a pull request here. A maintainer
   merges it, and it ships with the next release.

## Or with a pull request

The files are plain JSON in the
[i18next JSON v4](https://www.i18next.com/misc/json-format) format:

```
apps/web/src/locales/<code>/app.json      the interface
apps/web/src/locales/<code>/fields.json   widget, page and setting texts
```

Copy the structure of the English files in `apps/web/src/locales/en/` and
translate the values, never the keys. Then run:

```bash
pnpm i18n --check
```

It reports missing texts (fine, they fall back to English) and fails on
broken placeholders or invalid JSON.

Don't edit `en/fields.json`: it is generated from
`packages/schemas/overrides.ts` by `pnpm schemas`. English texts are changed
there, in the code, not on Weblate.

## Adding a new language

On Weblate: **Start new translation** in both components (app and fields).
By pull request: create `apps/web/src/locales/<code>/app.json` (and
`fields.json` when you get to it). Use a
[BCP 47](https://www.w3.org/International/articles/language-tags/) code such
as `de`, `pt-BR` or `zh-Hans`.

That's all: Glaze finds the folder by itself and shows the language in the
picker, in its own name (Deutsch, Português). No code changes are needed.

## Rules

- **Never translate keys** (the part before the colon in the JSON).
- **Keep `{{placeholders}}` exactly as they are**, e.g. `{{count}}`,
  `{{name}}`. You may move them within the sentence.
- **Keep tags** such as `<file>…</file>` or `<strong>…</strong>` and translate
  only the text between them.
- **Never translate Glance option names or YAML**: `hide-header`,
  `split-column`, `small`, `full`, `${YOUR_VAR}`, `GLANCE_URL`, `*name`. Glaze
  shows the option names next to the labels, so people can still find them in
  Glance's documentation.
- **Plurals**: keys ending in `_one`, `_other` (and `_few`, `_many`, … in some
  languages) are the forms of one text. Weblate shows the forms your language
  needs.
- **Keep it short.** Labels sit in narrow sidebars; a long word wraps or is cut
  off. Check the length of buttons and tabs in particular.
- **Use the informal tone** where your language has one (Dutch "je", German
  "du", French "tu").
- **Technical terms** that users of your language know as they are (widget,
  dashboard, YAML, Docker) can stay in English.
- Not sure? Ask in
  [GitHub Discussions](https://github.com/glazeforglance/glaze/discussions)
  or in a comment on Weblate.

## Right-to-left languages

Glaze supports right-to-left languages such as Arabic, Hebrew and Persian:
the layout, the side panels, drag & drop and the arrow keys mirror
automatically. Some notes:

- Placeholders, tags and option names stay as they are (left to right inside
  your text is fine; the browser handles it).
- Code, URLs and YAML keys are always shown left to right, on purpose.
- See something that looks wrong (overlapping text, an arrow pointing the
  wrong way)? Please
  [open an issue](https://github.com/glazeforglance/glaze/issues/new/choose)
  with a screenshot.
