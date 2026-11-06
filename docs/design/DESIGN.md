# CommonTab redesign

Source of truth: `screens/*.dc.html` (390x844 artboards, inline styles) and `screens/canvas.json` (board layout and titles). These screens are platform-neutral (they target iOS, Android and web). Open any file in a browser after removing the `<script src>` line, or read the inline styles directly. Design only; no app code has changed.

## Tokens
| Token | Value |
|---|---|
| Hero gradient | #0B4350 to #06222B (160deg) |
| Mint (on hero) | #8FE5C7 |
| Accent / owed green | #0B6B58 (text on tint: #0A4A3C) |
| Tint | #E6F1EE, selected tab #E1F0EC |
| You owe (red) | #B3261E |
| Warning banner | bg #FDF1DC, text #5C3205, icon #8A4B08 |
| Error banner | bg #FBE9E7, text #7A1A14 |
| Background / card | #F2F2F7 / #FFFFFF |
| Muted text / divider | #5F6B6E / #ECEEF0 |
| Primary button | #0B4350, white text, height 52, pill |
| Radii | cards 20, hero 26-28, pills full |
| Type | large title 30/800, screen title 18/700, section 20/700, label 13/700 caps, body 15-16 |
| Dark mode | base #0B1215, card #172227, text #EAF2F2, muted #9DB0B3, accent #5FD3B3, red #FF8A80 |

Rules: money is always labeled ("you owe", "owed") as well as colored. Rows use min-height so large text grows them.

## Navigation
Tabs: Home, Groups, center + (Add expense), Activity, Account. The + asks for a group only when there is more than one.
Account holds profile, sync status, Settings, and Tools (calculator, scan receipt).

## Screen to existing code map (current SwiftUI app under `apps/ios/CommonTab/Features`, to be ported to the React Native app)
| Screens | Existing area |
|---|---|
| Main, HomeOffline, Empty, HomeDesktop | Home |
| Groups, GroupDetail, CreateGroup, Members, Invite, JoinGroup, GroupSettled, GroupRemoved, LeaveBlocked | Groups, GroupExpenses, Shared |
| AddExpense, ChooseGroup, EditExpense, DeleteExpense, ExpenseDetail, SettleUp, Simplify, SplitError, MultiCurrency | Expenses |
| Itemized, ScanCamera, ScanReview, ScanFailed, CameraDenied | ItemizedBill, Receipts |
| Calculator | Calculator |
| Account tab (`Tools.dc.html`), Account (profile), Settings | Tools, Settings |
| Welcome, CreateAccount, SignIn, NoConnection, SessionExpired | Shared (auth) |
| HomeOffline, GroupOffline, SyncStatus, Conflict, SyncFailed, ServerDown | new (sync layer) |
| RecurringSetup, RecurringList, NotifPrompt, NotifSettings, PushPreview | new |
| *Dark, MainLarge | appearance variants |

Note: `Tools.dc.html` is the Account tab; `Account.dc.html` is the pushed Profile screen.

## Desktop layouts (width 1024 and up)
Phone screens are the base; `HomeDesktop.dc.html` (1280 wide) is the first desktop design. Rules for desktop screens:
1. Content sits in a column of at most 960px, left aligned next to the sidebar.
2. Buttons size to their label, never full width.
3. A card never spans the whole window.
4. An empty sidebar section says what is missing and offers one action ("No groups yet." and "+ Create a group").
5. Each card has one main action; the second is an outline or text button.
6. Add and edit expense follow the phone flow. On phone they are full pages: back button, amount card with the currency pill (EUR €), rate card for foreign currency, grouped rows with a Split row ("Equally · $54.50 each") that opens the Split page, category chips, and a pinned Save. On desktop they open as a dialog over the current page (route `/expenses/new` or `/expenses/[id]/edit`, up to 960px wide): the title, the group name and a close button in the header, the form in a scrolling body (amount card, Description, Paid by, Date and Category in one row, Notes collapsed as "Add a note", a Split summary card), and the live summary with the one primary button in the dialog footer. Edit split replaces the dialog body with the Split editor (method control, per-person amounts, reset, By item inline) under a back arrow, and Done returns to the form. Closing with the X, Esc or the dimmed area asks "Discard changes?" when the form has changed. The rate for a foreign currency is one line inside the amount card on desktop. Picker rows are dropdowns on desktop (down arrow, up while open) and sheets on phone.

## Frontend UI stack (decided)
- Expo (React Native) with Expo Router; one app for iOS, Android and web.
- **Styling: NativeWind (Tailwind classes).** Design tokens live in `packages/ui/src/tokens.ts` and are mapped into the Tailwind theme (`tailwind.config.js`) so class names like `bg-card`, `text-muted`, `text-owe` match the table above. Dark mode uses the `dark:` variant driven by the system color scheme.
- Rows use `min-h-*` (never fixed heights) so large text grows them; every control has an accessibility label.
- Lists: FlashList. Animation: Reanimated. Icons: lucide-react-native.
- Shared components live in `packages/ui` (Card, Pill, Banner, SyncChip, TabBar, AmountText, Avatar, ListRow, Sheet).
- Known NativeWind caveats to check early: web build config, and class-name conflicts with platform-specific files (`.web.tsx`).

## Logo (decided: "Common ground")
Two overlapping circles; the overlap is the shared part of a tab. SVGs in `docs/design/brand/`: `logo-mark-dark-bg.svg`, `logo-mark-light-bg.svg`, `app-icon.svg` (1024px export from the SVG for the store icons). Wordmark (decided): one word, "Common" in weight 700 and "Tab" in weight 400, same color, letter-spacing -0.04em, UI font. Dark-bg colors: #2D8F86, #5FD3B3, overlap #E8FFF6. Light-bg colors: #0B4350, #3FAF96, overlap #8FE5C7. Check trademark availability before launch. Used in: Welcome, website nav, app icon, favicon.
