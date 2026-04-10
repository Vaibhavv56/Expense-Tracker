# Expense Tracker (React Native + Expo)

A modern cross-platform expense tracking application built with Expo and React Native.  
This app provides a complete personal finance flow, including authentication, bank management, expense/income entries, statistics, and polished UI transitions.

## Design & Demo

- **Figma Design Link:**  
👉 https://www.figma.com/design/FJpPUyHOiBlMrwo1q0YxNX/MyWallet?node-id=0-1&t=MPXPTIGXjeB6iHeM-0  

- **Demo Video:**  
  [Watch Demo Video](https://drive.google.com/file/d/1ijt5aEbtQ7WDvNbUn_mi8S48h7jxjNFN/view?usp=sharing)

<video src="./assets/demo.mp4" controls width="600"></video>

---

## Project Overview

This project is designed for fast iteration and demo readiness:

- Built with Expo SDK 54 for iOS, Android, and web.
- Uses local persistence (AsyncStorage) for offline-first demo behavior.
- Includes themed UI (dark/light) and interactive transitions for key screen and mode changes.
- Structured as a single-app entry with screen-level components in `App.tsx` and local storage helpers in `localDb.ts`.

## Features

- User authentication (sign up / login).
- Seeded demo user for quick walkthroughs.
- Dashboard with total balance and transactions.
- Bank card management:
  - Add bank details.
  - Reorder bank cards.
  - View-more behavior for long lists.
- Expense and income entry flow:
  - Category and bank selection.
  - Date picker interaction (modal on iOS/web, native picker on Android).
  - Entry validation with user feedback.
- Statistics screen:
  - Expense/Income mode switch.
  - Monthly/Weekly views.
  - Category breakdown cards.
- Theme toggle (dark/light).
- Success screens with micro-interactions and confetti.

## Tech Stack and Libraries Used

### Core Framework

- `expo` (`~54.0.33`)
- `react` (`19.1.0`)
- `react-native` (`0.81.5`)
- `typescript` (`~5.9.2`)

### Navigation

- `@react-navigation/native`
- `@react-navigation/stack`

### UI and Styling

- `expo-linear-gradient` for gradient backgrounds and button fills.
- `@expo/vector-icons` for iconography.
- `@expo-google-fonts/lexend` + `expo-font` for typography.
- `expo-status-bar` for status bar control.

### Device and Platform Utilities

- `react-native-safe-area-context` for notch/safe area handling.
- `react-native-gesture-handler` for gesture support.
- `react-native-screens` for screen primitives.
- `@react-native-community/datetimepicker` for date selection.

### Persistence and Data

- `@react-native-async-storage/async-storage` for local data storage.

### Effects and Celebration

- `react-native-confetti-cannon` for success celebration visuals.

## Effects and Transitions: How They Are Implemented

This app uses the React Native `Animated` API (with `useNativeDriver`) for smooth, hardware-accelerated transitions.

- **Screen entry motion**  
  Screens animate in with opacity + translateY, creating a soft rise/fade effect.

- **Mode switch transitions (Expense ↔ Income)**  
  Both Add Expense and Statistics screens use parallel animation of:
  - Fade out + slight upward shift.
  - State swap.
  - Fade in + downward-to-neutral return.

- **Theme toggle animation**  
  Animated values and easing curves are used for icon and state transitions when switching dark/light themes.

- **Interactive press feedback**  
  Reusable card/button interactions apply subtle scale animations for tactile responsiveness.

- **Date picker presentation flow**  
  Date picker is shown only when the date field is tapped:
  - iOS/web: bottom-sheet style `Modal` with backdrop and Done action.
  - Android: native date picker dialog pattern.

## Project Structure

- `App.tsx` - Main app screens, navigation, UI components, transitions, and auth context.
- `localDb.ts` - AsyncStorage keys and helper methods for local persistence.
- `assets/` - App icons, logo, splash, and visual references.
- `index.ts` - App entry point.

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- npm
- Expo Go app on mobile device (for quick testing)

### Installation

```bash
npm install

### Run the App

```bash
npx expo start
```

Useful scripts:

```bash
npm run ios
npm run android
npm run web
```

If you face stale cache or timeout behavior during development:

```bash
npx expo start -c --tunnel
```

## Demo Credentials

Use the seeded demo user for presentation:

- Email: `vaibhav@mywallet.com`
- Password: `Vaibhav@123`

## Design and Demo References

- **Figma Design Link:** `[https://www.figma.com/design/FJpPUyHOiBlMrwo1q0YxNX/MyWallet?node-id=0-1&t=MPXPTIGXjeB6iHeM-0]`
- **Demo Video Link:** `[Add video link here]`

## Notes

- Data is currently persisted locally for demo/MVP scenarios.
- Production deployment should replace local auth/storage with a secure backend and proper credential handling.
