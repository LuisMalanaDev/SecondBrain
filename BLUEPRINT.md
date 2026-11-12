# 🧠 SecondBrain Vault — Implementation Instructions for Current Agent

1. Inspect the pre-created files in `C:\SecondBrainVault`:
   - `C:\SecondBrainVault\package.json`
   - `C:\SecondBrainVault\app.json`
   - `C:\SecondBrainVault\eas.json`
   - `C:\SecondBrainVault\src\theme\colors.js`
   - `C:\SecondBrainVault\src\storage\vaultStorage.js`
2. Create the remaining UI components and `C:\SecondBrainVault\App.js`:
   - `src/components/PinLockModal.js`: 4-digit PIN pad (Set PIN, Verify PIN, Lock/Unlock Vault).
   - `src/components/QuickCaptureModal.js`: Modal to create/edit any of the 5 item types (`NOTE`, `SNIPPET`, `PASSWORD` with built-in password generator, `CHECKLIST` with dynamic sub-items, and `LINK`) + tag selector (`#dev`, `#ideas`, `#passwords`, `#goals`, custom tags).
   - `src/components/VaultItemCard.js`: Renders each item type with 1-tap Copy (`Clipboard` or `Share`), password eye-toggle, interactive checklist toggling, pin-to-top, edit, and delete.
   - `App.js`: Main dashboard with Hero stats (`Total Vault Items`, `Pinned`, `Snippets`, `Passwords`, `Tasks Done`), Instant Search, Category Tabs, `#Tag` Filter Bar, Security Lock button, and JSON Backup Export/Import.
3. Run `npm install` in `C:\SecondBrainVault` and test locally with `npx expo start` before building any APK.
