# @commontab/ui

Design tokens and base components for the Expo app (iOS, Android, web), styled with NativeWind v4 (Tailwind 3).

- `src/tokens.json` is the single source for colors (light and dark), radii, sizes and type. `src/tokens.ts` types it. Values come from `docs/design/DESIGN.md` and the screens; a few dark-mode and avatar values are not in the designs and are derived (contrast-tested).
- `tailwind-preset.js` turns the tokens into Tailwind theme values and CSS variables. Add it to the app's `tailwind.config.js` `presets`. Classes: `bg-card`, `text-muted`, `text-owe`, `rounded-card`, `min-h-touch`, `text-large-title`, and so on. Colors are variables, so they follow light/dark without `dark:`.
- Components: Text, Button, Card, Pill, Banner, SyncChip, AmountText, Avatar, AvatarStack, ListRow, Hero, Sheet, TabBar, Icon.

Rules the components follow (and tests check):
- Rows and buttons use `min-h-*`, never a fixed height, so large text grows them. Touch targets are at least 44.
- Every control has an accessibility label. Money is labeled in words ("you owe", "you're owed", "settled up"), not only colored.
- Text color is chosen with `tone`, not a stacked class (Tailwind's CSS order, not class order, decides conflicts). Icons take a color token through `Icon`'s `tone`.

Not done yet: manual appearance override (Settings), a check on a real device or simulator, and Dynamic Type / large-text testing on native.
