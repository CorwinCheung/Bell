# Bell Project Spec

## Purpose

Bell is a calm interval practice timer built with Expo and React Native. It helps a user choose a repeating time interval, choose a bowl-style chime, start a session, and hear the selected chime each time the interval completes.

This file is the source of intended project behavior. Every requested product or code behavior change, however small, should be reflected here before implementation.

## Project Workflow

- Use `SPEC.md` as the behavior contract for product and implementation changes.
- Before changing code, assets, or product behavior, first update `SPEC.md` with the intended behavior so the implementation target is clear.
- Keep changes surgical: update only the behavior, code, assets, or documentation needed for the current request.
- This project uses `bd` (Beads) for durable issue tracking and agent handoff.
- Use Beads instead of markdown TODO lists for task tracking.
- Run `bd prime` when Beads context is missing or stale.
- Do not commit, push, or sync Beads/Dolt remotes unless explicitly asked.

## Product Scope

- The app is named `Bell`.
- The primary experience is an interval bell for repeated practice sessions.
- The app should feel quiet, polished, and purpose-built rather than like a generic timer utility.
- The UI should work on Expo-supported iOS, Android, and web targets.
- The app should be usable without a backend, account system, network request, or server-side storage.

## Setup Mode

- Setup mode is the first screen when no session is running.
- The setup screen shows the app name, the subtitle `Interval timer`, a circular preview, interval controls, chime controls, and a primary start action.
- If recent in-memory sessions exist, setup mode shows a compact history button in the top-right of the header.
- If no recent sessions exist, setup mode should not show a history button or an empty session-history state.
- Pressing the history button should navigate to a separate History view rather than expanding history inline on setup.
- Interval selection uses direct tap controls, not native picker wheels.
- Supported interval presets are:
  - 10 seconds
  - 15 seconds
  - 30 seconds
  - 60 seconds
  - 120 seconds
  - 180 seconds
  - 300 seconds
- The last interval option should be `Custom`, replacing the previous 90-second preset.
- Selecting `Custom` should reveal an intuitive minutes-and-seconds input for setting a custom interval.
- The default custom interval should be 10 minutes and 00 seconds.
- Custom interval seconds should remain editable while the user is typing, including being temporarily blank, and should only be reformatted when the user taps `Done`.
- Custom interval inputs should stay visible when the phone keyboard opens.
- Custom interval editing should provide an easy `Done` action to dismiss the keyboard.
- Custom intervals should update the circular preview and be usable when starting a session.
- The selected interval is reflected in the circular preview.
- Chime selection uses direct tap rows with a label, short tonal description, and selected state.
- Supported bundled chimes are:
  - Deep bowl
  - Soft bowl
  - Clear bowl
  - Bright bowl
  - Singing bowl
- Selecting a chime while not running should update the selected chime without playing audio.
- A separate `Play` control should play the currently selected chime only when explicitly pressed.
- Starting a session should not trigger setup-mode chime playback.

## Running Mode

- Starting a session switches the app into running mode.
- Running mode should emphasize the selected interval, remaining time, and circular progress.
- The countdown displays whole seconds, rounded up and clamped at zero.
- For intervals under one minute, idle interval labels use seconds, such as `30s`.
- For whole-minute intervals, idle interval labels use minutes, such as `2m`.
- For mixed intervals, idle interval labels use minutes and seconds, such as `1m 30s`.
- The circular progress ring advances continuously during the active interval.
- When the interval completes, the selected chime plays and the next interval begins.
- Tapping the running screen ends the session.
- Ending a session returns to setup mode and resets progress.

## History Mode

- History mode should be a separate in-app view reached from the setup history button.
- History mode should show recent in-memory sessions with repetitions, duration, interval, chime, calendar date, and time.
- History rows should support swiping left to reveal a `Delete` action, similar to native iOS list deletion.
- Tapping a revealed `Delete` action should remove that session from recent in-memory history.
- History mode should provide a simple back action that returns to setup mode.

## Audio Behavior

- Audio playback should use Expo AV.
- Chimes should play in iOS silent mode.
- The app does not need to keep audio active in the background.
- The selected chime should be preloaded when possible.
- Runtime audio errors, missing assets in development, or preview playback failures should not crash the app.
- Bundled chime files live under `assets/chimes/`.
- Bundled chimes should use pleasant, real bowl or bell recordings where licensing allows app bundling and commercial use.
- Sound source and license details must be documented next to the sound assets.

## Device Behavior

- While a session is running, the app should request keep-awake behavior so the display does not sleep mid-session.
- When a session stops or the running view unmounts, the app should release keep-awake behavior.
- The app uses portrait orientation by default.
- The app uses a dark user interface style.
- Setup and running content should render inside native safe areas so the app title, history button, timer, and controls do not collide with iPhone notches, Dynamic Island, or status indicators.

## Visual Design

- The interface should use restrained colors, modest radii, and clear touch targets.
- App icon artwork should show a bell in a pale, warm, misty, organic style inspired by golden willow light rather than a dark glossy metallic theme.
- App icon artwork should remain text-free and readable at small mobile icon sizes.
- The configured app icon should use `assets/app-icon-bell-willow.png`.
- Setup mode may scroll on small screens.
- Main content should be constrained enough to remain readable on web while still filling a phone-sized viewport naturally.
- Section headers and inline actions should sit with balanced vertical spacing between the controls above and the content they introduce.
- Running mode should prioritize the timer and progress ring over controls.
- The end-session action should be simple and low-friction.

## Persistence And History

- Current app state is local to the running app instance.
- Recent session history is kept only in memory for the current app instance.
- Recent session history should show calendar dates so sessions from different days can be distinguished.
- The app currently does not require backend persistence.
- The app currently does not require account sign-in.

## Build And Development

- The app is an Expo project with `index.ts` as the package entry point.
- Development commands are provided through package scripts:
  - `expo start`
  - `expo start --android`
  - `expo start --ios`
  - `expo start --web`
- iOS production build and submission are configured through EAS package scripts.
- Production EAS builds should use remote app versioning and automatically increment the developer-facing build number.
- The web preview should run on `http://localhost:4000` during development.

## Non-Goals

- No analytics are required.
- No backend service is required.
- No account, profile, subscription, or sync behavior is required.
- No custom interval entry is required beyond the defined presets.
- No session completion screen is required.
- No persistent history is required.
