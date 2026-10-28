# Using Glaze

This guide shows how to build a Glance dashboard with Glaze, step by step. You don't need to know YAML: everything here works with clicks, drag & drop and forms. If Glaze isn't running yet, start with the [Quick start](../README.md#quick-start).

A few words used below:

- **Glance** is your dashboard. **Glaze** is the editor for it. Glance shows; Glaze changes what it shows.
- **`glance.yml`** is the file that describes your dashboard. Glaze reads it and writes it for you.
- A **page** is one tab of your dashboard. A page has **columns**, and columns hold **widgets** (a clock, the weather, a list of bookmarks, …).

**Contents:** [The four views](#the-four-views) · [Pages](#pages) · [Columns](#columns) · [Widgets](#widgets) · [Widgets side by side](#widgets-side-by-side) · [The inspector](#the-inspector) · [custom-api widgets](#custom-api-widgets) · [The Settings view](#the-settings-view) · [Publishing](#publishing) · [The Code view](#the-code-view-an-escape-hatch) · [Keyboard shortcuts](#keyboard-shortcuts) · [What Glaze can't do (yet)](#what-glaze-cant-do-yet)

## The four views

The switch at the top right has four views. You can also switch with `Ctrl/Cmd + 1` to `4`.

| View         | Use it to…                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| **Design**   | Build pages: add, move and configure widgets and columns. This is where you spend most of your time.         |
| **Code**     | See and edit the YAML itself, with the live preview of Glance next to it. Handy for copying or quick fixes.   |
| **Preview**  | Look at your real Glance dashboard in full width, as a desktop or a phone.                                    |
| **Settings** | Change everything that isn't a page: Glance's server, its login, the document head, branding and the theme. |

All four work on the same **draft**. Nothing reaches Glance until you press **Publish** (see [Publishing](#publishing)).

![The Design view: the widget library on the left, the Homelab page with three columns in the middle, and the Services monitor's settings in the inspector on the right](screenshots/editor.png)

The Design view has three parts: the **widget library** on the left, the **canvas** with the current page in the middle, and the **inspector** on the right. You can resize both side panels by dragging their inner edge (double-click the edge to reset it), and fold them away with the small button at their top corner. Glaze remembers the widths in your browser.

## Pages

The page tabs sit in the top bar.

- **Add a page:** click **+ Page**. Type a name and press Enter.
- **Rename a page:** double-click its tab, or open the **⋯** menu next to the tabs and choose **Rename**.
- **Reorder pages:** **⋯ → Move left / Move right**.
- **Delete a page:** **⋯ → Delete page…** (Glaze asks first; a dashboard needs at least one page).
- **Page settings:** click the page title on the canvas, or **Page settings** next to it. The inspector then shows:
  - **Name** and **URL path** (the part after the `/` in your browser). Leave the path empty and Glance makes one from the name; Glaze shows which one and warns when two pages would clash.
  - **Width:** default, slim or wide. Slim pages can have at most 2 columns.
  - **Navigation width**, and switches for the header on phones, hiding the navigation on desktop and centering the columns vertically.

A page that comes from a separate file (`$include:` in `glance.yml`) is shown but can't be edited in the Design view; change it in that file instead.

## Columns

Glance places columns next to each other. Each column is **small** (a fixed narrow width) or **full** (takes the remaining space). Glance's rules, which Glaze enforces for you:

- a page has 1 to 3 columns (at most 2 on a slim page);
- exactly 1 or 2 of them are full.

What you can do:

- **Add a column:** **Add column** at the top of the page.
- **Small or full:** click the `small ▾` / `full ▾` label above a column and pick one.
- **Drag the edge** between two columns to switch them between small and full, or focus the edge and use `←` / `→`. When a change would break Glance's rules, Glaze doesn't make it and tells you why.
- **Remove a column:** open its `small ▾` / `full ▾` menu and choose **Remove column…**. Its widgets are removed with it, so Glaze asks first.

## Widgets

Glaze knows all 28 widget types of Glance v0.8.7. The library groups them as **Basics**, **Server**, **Media & news** and **Advanced**, with a search box on top.

- **Add a widget:** drag it from the library into a column. Or click **+ Widget** at the bottom of a column and pick a type from the menu. New widgets start with working example values, so they show something in Glance straight away.
- **Select a widget:** click it. The inspector shows its settings. Click an empty spot on the canvas to clear the selection.
- **Move a widget:** drag it by its handle (`⠿`) to another place, in the same column or another one. A line shows where it will land.
- **Duplicate or delete:** use the two buttons on the selected widget, or press `Delete` to remove it.
- **Head widgets:** the area above the columns holds widgets that span the full page width (for example a search bar). Drop a widget there or use its **+ Widget** button.
- **Groups** show their widgets as tabs, just like Glance does. Click a tab to see that widget.

Without a mouse: focus a library item or a widget's handle, press `Space` to pick it up, move it with the arrow keys and press `Space` again to drop it.

## Widgets side by side

Glance has no width option for a single widget: a widget always fills its column. To put widgets **side by side**, Glance uses a special widget called a `split-column`, and Glaze makes those for you.

![Three widgets side by side in a split-column. Server stats is selected and its width handle is being dragged, showing "⅓ · 3 columns" and a note that all 3 widgets get this width](screenshots/split-column.png)

- **Drop on the left or right edge** of a widget (instead of above or below it) to put the two side by side. Drop on the edge of a widget that's already in a split-column to add a third or fourth.
- **The width handle:** select a widget that's side by side with others; a small amber bar appears on its right edge. Drag it to choose **½**, **⅓** or **¼**. The same choice is in the inspector's **Style** tab as buttons (Full / ½ / ⅓ / ¼), which also works for a widget on its own.
- **Equal width, masonry layout:** Glance divides the split-column into equal columns (2 columns for ½, 3 for ⅓, 4 for ¼) and stacks the widgets into whichever column is shortest. So **every widget in the same split-column gets the same width**: you can't make one ⅔ and the other ⅓. That is how Glance works, not a choice of Glaze. On narrow screens Glance puts them under each other again.
- A widget that's ½ wide but alone leaves the rest of the row empty, until you drop another widget beside it.
- When you drag a widget out and only one is left, Glaze removes the split-column and shows a notice with **Undo**.
- Widgets in a group or in the head widgets can't be put side by side (Glance doesn't allow it there).

The canvas shows split-columns approximately; the [Preview](#the-four-views) shows exactly what Glance draws.

## The inspector

The inspector on the right has three tabs for the selected widget:

- **Settings:** a form with everything this widget type can do, with a short explanation under each field. Lists (sites, bookmarks, feeds, …) can be added to, reordered and folded open. Fields left empty use Glance's default, which is shown in grey.
- **Style:** the width (see above) and options about looks, such as hiding the header or adding a CSS class.
- **YAML:** the widget's own YAML, for when you want to see or change it directly.

Things you'll notice in the forms:

- **ENV chips.** A value like `${GITHUB_TOKEN}` means "Glance reads this from an environment variable". Glaze shows it as a green **ENV GITHUB_TOKEN** chip and never tries to fill it in. `${secret:name}` (a Docker secret) shows as **SECRET**, and `${readFileFromEnv:VAR}` as **FILE**.
- **Secrets.** Password, token and API-key fields are hidden until you click **Show**. Better still: type `${YOUR_VAR}` in them, so the key stays out of `glance.yml`, and set `YOUR_VAR` for the Glance container.
- **Icons** have a picker for the source (`si:` Simple Icons, `di:` Dashboard Icons, `sh:` selfh.st, `mdi:` Material Design) and a name, or a URL.
- **Colors** can be picked, or typed as a hex code; Glaze converts them to the HSL format Glance uses.
- **Other options.** If a widget has options Glance doesn't know (often a typo, or something from another Glance version), Glaze keeps them as they are and lists them under **Other options**. Fix or remove them in the YAML tab.
- When a required option is missing (for example a location for the weather), the field says so. Publish is blocked until it's filled in.

## custom-api widgets

The `custom-api` widget fetches data from any web API and shows it with a template you write. It's Glance's most flexible widget, and Glaze gives it its own editor.

![The custom-api widget "Solar today" selected; the inspector shows its template with syntax highlighting and the template cheat sheet](screenshots/custom-api.png)

- **Request:** the URL to fetch and the method. Under **More options**: headers, query parameters, a body, subrequests (extra requests whose responses you can use too) and options you can read in the template.
- **Template:** HTML with Go template actions like `{{ .JSON.String "name" }}`, with highlighting. The response is available as `.JSON`.
- **Template cheat sheet:** click it for the most used functions (`.JSON.String`, `.JSON.Array`, `.Subrequest`, `toRelativeTime`, …), each with a one-line explanation.

Glaze doesn't run the template itself. Publish, and look at the result in the Preview. Glance waits at most 5 seconds for an API to answer.

## The Settings view

The Settings view (`Ctrl/Cmd + 4`) covers everything in `glance.yml` that isn't a page.

![The Settings view on the Theme section: colors for background, primary, positive and negative, the light theme switch, contrast and text saturation](screenshots/settings.png)

- **Server:** where Glance **listens**, not where you reach it, plus the assets folder, the base path and whether Glance sits behind a reverse proxy.
  - **Listen address:** leave it empty, so Glance listens on every network interface. Only set it to make Glance listen on one specific interface: an IP address (`192.168.1.10`, or `[::1]` for IPv6, in brackets) or a host name. A URL, a path or a port (`http://…`, `…:8088`) is refused, because Glance can't start with it.
  - **Listen port (inside the container):** usually `8080`, a whole number from 1 to 65535. In Docker this is the port **inside** the container; to reach Glance on another port, change your Docker port mapping (e.g. `8088:8080`), not this field. When Glaze can tell Glance runs in a container, changing the address or port shows a warning and Publish asks you to confirm.
  - **Base path:** only when a reverse proxy serves Glance under a path, e.g. `/glance` for `example.com/glance`. It must start with `/` (or be a full `http(s)://` URL).
  - If Glance doesn't answer after you publish a change here, a banner offers **Undo last publish**, which puts the previous `glance.yml` back.
- **Login:** Glance's **own** login, separate from Glaze's.
  - **Users:** add a user with a name (at least 3 characters) and a password (at least 6). Glaze stores a bcrypt **hash** of the password, never the password itself. You can set a new password or rename a user later. Glance has no per-page access: every user sees every page.
  - **Secret key:** signs Glance's login sessions; Glance needs one as soon as there are users, and Glaze makes one when you add the first user. **Generate a new key** replaces it: after you publish, **everyone is logged out of Glance** and has to log in again. You can also write `${GLANCE_SECRET_KEY}` here and keep the key out of `glance.yml`.
- **Document head:** extra HTML in every page's `<head>`, for example a font or a meta tag. Scripts here run for everyone who opens your dashboard, so only add code you trust.
- **Branding:** the logo, footer, favicon and app name.
- **Theme:** background, primary, positive and negative colors, light or dark, contrast and text saturation, a custom CSS file, and **presets**: extra named themes that Glance offers in a theme switcher. Add a preset, give it a name and set its own colors.

Changes here are part of the same draft as everything else, and are written when you publish.

## Publishing

Everything you do in Glaze is a **draft** that lives in your browser. The top bar shows **Unsaved changes** while you have one, and your browser warns you if you try to close the tab. Glance still shows the **published** version: the one in `glance.yml`.

To publish, press **Publish** (or `Ctrl/Cmd + S`). Glaze shows a review first:

![The Publish changes dialog: 1 file will be written, glance.yml, 0 errors and 0 warnings, ready to publish](screenshots/publish.png)

- **Which files will be written:** `glance.yml`, plus any CSS or JavaScript files you changed in the Code view.
- **Errors** are things Glance would refuse: a broken layout, a missing required option, or an error from Glance's own check (`glance config:validate`). Fix them first. If you're sure, **Publish anyway** writes the file regardless, except when the YAML itself can't be read.
- **Warnings** don't block publishing, for example an option Glance doesn't know (with a **Fix** button when Glaze has a suggestion). One kind does need a confirmation: changing Glance's listen address or port while Glance runs in a container. Tick the box to publish it anyway.
- **Notes** at the bottom are only information, for example that Glance's assets folder can't be checked because `GLAZE_ASSETS_PATH` isn't set.

After publishing, Glance notices the new file and reloads by itself; Glaze waits for that and then refreshes the preview. If `glance.yml` was changed by someone else since you opened it (by hand, or in another tab), Glaze doesn't overwrite it silently: you choose between **Reload** (take their version, lose your draft) and **Overwrite** (replace theirs with yours).

**What the preview shows.** The preview is your real Glance in a frame, so it always shows the **published** version, with real data, not your draft. If your Glance has a login, log in once inside the preview. The preview needs `GLANCE_URL` to be set (see [Configuration](configuration.md)).

## The Code view: an escape hatch

You never have to use the Code view, but it's there when you want it.

![The Code view: glance.yml on the left with highlighting, the live preview of Glance on the right](screenshots/code-preview.png)

- The YAML of your whole `glance.yml`, with highlighting and folding. `Ctrl/Cmd + F` searches.
- Changes go both ways: edit the YAML and the Design view follows; change something in Design and the YAML follows. Comments, ordering and blank lines stay exactly as you wrote them.
- **Problems** are listed at the bottom and underlined in the text. Click one to jump to its line; **Fix** applies a suggestion, such as renaming `stlye` to `style`.

![A typo, stlye, underlined in the Code view, with the problem "Unknown option stlye. Did you mean style?" and a Fix button](screenshots/validation.png)

- **Other files:** if your config uses a custom CSS file or links to `/assets/` files in the document head, they get their own tab and can be edited too.
- The live preview sits on the right; hide it, reload it or switch between desktop and phone with the buttons above it, and drag the edge between code and preview to resize.

While the YAML has an error that stops Glaze from reading it, the Design and Settings views wait until you've fixed it.

## Keyboard shortcuts

| Keys                       | Action                                     |
| -------------------------- | ------------------------------------------ |
| `Ctrl/Cmd + S`             | Review and publish                         |
| `Ctrl/Cmd + 1 / 2 / 3 / 4` | Design / Code / Preview / Settings view    |
| `Delete`                   | Remove the selected widget (on the canvas) |
| `Space`, arrows, `Space`   | Pick up, move and drop with the keyboard   |
| `←` / `→` on a column edge | Switch the columns between small and full  |
| `Ctrl/Cmd + F` (in code)   | Search in the file                         |

## What Glaze can't do (yet)

- **Widget height.** Glance has no height option; a widget is as tall as its content. A height handle is planned.
- **A theme editor with a live preview** of your colors while you pick them. For now, set the theme in Settings, publish, and look at the Preview.
- **A widget builder** that makes `custom-api` widgets from blocks, without writing a template.
- **Multiple users in Glaze.** Glaze has one admin login. (Glance's own users are separate and can be managed in Settings.)
- **Undo.** The undo button in the top bar isn't active yet. Until you publish, closing the tab without publishing throws away your draft, and the Code view's own undo (`Ctrl/Cmd + Z`) works inside the editor.
- **Pages from `$include:` files** can't be edited in the Design view.
