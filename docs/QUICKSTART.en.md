# Quickstart (English)

Get Outlook web reminders as system notifications in about 5 minutes.

*Version française : [QUICKSTART.fr.md](QUICKSTART.fr.md)*

## Prerequisites

- Google Chrome 111 or later.
- A copy of this repository on your computer (`git clone`, or download the ZIP and extract it).
  Keep the folder somewhere permanent: Chrome loads the extension from it on every start.
- Notifications allowed for Google Chrome in your operating system's settings.

## 1. Install Outlook web as an app (PWA)

Optional but recommended: Outlook gets its own window, separate from your browsing tabs, so it
is less likely to be closed by mistake. The extension works the same in a regular tab.

1. In Chrome, open <https://outlook.cloud.microsoft/calendar> and sign in.
2. Install it as an app, either way:
   - click the **install icon** at the right end of the address bar (a screen with a down arrow),
     then **Install**;
   - or open the **⋮** menu → **Cast, save, and share** → **Install page as app…**, then **Install**.
     (In some Chrome versions: ⋮ → **Install Outlook…**.)
3. Outlook opens in its own window. Launch it later from your system's application menu, your
   taskbar / dock, or `chrome://apps`.

To uninstall the app: in the Outlook window, ⋮ menu → **Uninstall Outlook…**.

## 2. Install the extension

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the repository folder (the one containing `manifest.json`).
4. The card **Outlook Reminders → System Notifications** appears. Make sure it is enabled.
5. **Reload Outlook** (tab or app window: `F5` or `Ctrl+R` / `Cmd+R`). The extension only
   attaches to pages loaded after its installation.

Options (enable/disable, keep imminent reminders on screen, debug mode):
`chrome://extensions` → extension **Details** → **Extension options**.

## 3. Recommended settings

- **Keep Outlook active**: `chrome://settings/performance` → **Always keep these sites active** →
  **Add** → `outlook.cloud.microsoft`. Otherwise Chrome's Memory Saver may put an inactive
  Outlook to sleep, and no reminder is shown.
- Keep Outlook open (tab or app window) during the day: the extension only sees reminders that
  Outlook displays.

## 4. Check it works

1. In Outlook, create an event titled `Test`, type a start time of **now + 7 minutes**, and choose
   the reminder **5 minutes before**. Save.
2. About 2 minutes later, Outlook's reminder pane appears and so does a **system notification**.
3. Click the notification: the Outlook window comes to the front.

Nothing happens? See "Known limitations" and "When Outlook changes its DOM" in the
[README](../README.md).

## Update / remove

- **Update**: replace the folder content (or `git pull`), then click the reload icon on the
  extension card in `chrome://extensions`, and reload Outlook.
- **Remove**: `chrome://extensions` → **Remove** on the extension card.

Chrome may sometimes display a warning about extensions in developer mode. This is expected for an
extension loaded this way.
