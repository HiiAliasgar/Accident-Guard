# AccidentGuard — Google Play Release Readiness

**Current status: NOT READY for public release as an emergency or crash-detection safety app.**

The repository currently contains an experimental prototype. Its crash-detection thresholds have not been validated, the hospital dataset contains demonstration entries, and there is no emergency dispatch backend. Do not claim that the app automatically contacts ambulances, detects every crash, prevents false alarms, or works reliably in the background.

## Before any public release

1. Replace all demonstration hospital names, coordinates, phone numbers, routes, and ETA values with verified data for the intended launch region—or remove those features.
2. Complete physical-device testing on supported Android phones, including denied permissions, GPS unavailable, sensor availability, notification behavior, lifecycle/background transitions, and false-alarm cancellation. Never test on public roads or call real emergency services during testing.
3. Review every permission in the merged Android manifest. Request only permissions required by working, user-visible features. Background location and direct SMS/phone permissions require special justification and may trigger Google Play review.
4. Verify the privacy policy against actual data flows and host it at a stable public HTTPS URL. The current policy in this repository is a project draft and must be reviewed before publication.
5. Complete Google Play's Data safety, app access, content rating, target audience, and any sensitive-permission declarations accurately.
6. Prepare truthful store listing text, screenshots from the real app, a 512×512 PNG app icon, and a 1024×500 feature graphic. Do not advertise unimplemented dispatch or validated safety functionality.
7. Test an Android App Bundle (AAB) on a closed testing track before considering production.

## Technical release requirements

- Package ID: `com.accidentguard.app`
- Current target SDK: API 36. New Google Play submissions must meet the current target API requirement; verify it again in Play Console before submission.
- The release AAB must be signed with a protected upload key or configured Play App Signing flow.
- Never commit keystores, passwords, service-account JSON, API secrets, or signing credentials to Git or paste them into a chat.
- The regular CI workflow builds a debug APK for engineering tests. A debug APK is not a production release bundle.
- A manual `Android Release Bundle` workflow is provided in GitHub Actions. It requires signing secrets and can optionally upload a draft to the Play Console internal testing track.

## Configure the release workflow

1. Create an upload keystore on your own computer and keep a secure backup. Never send the keystore or passwords to anyone.
2. Add these repository **Actions secrets** in GitHub `Settings → Secrets and variables → Actions`:
   - `ANDROID_KEYSTORE_BASE64`: base64-encoded contents of your upload keystore.
   - `ANDROID_KEYSTORE_PASSWORD`: keystore password.
   - `ANDROID_KEY_ALIAS`: the alias used when creating the key.
   - `ANDROID_KEY_PASSWORD`: key password.
   - `PLAY_SERVICE_ACCOUNT_JSON`: required only if you want the workflow to upload to Play Console. Create a service account in Play Console API access and grant it appropriate app access.
3. In PowerShell, encode the keystore without changing the file:
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes(".\\upload-keystore.jks"))
   ```
   Copy the output directly into the GitHub secret `ANDROID_KEYSTORE_BASE64`. Do not commit the keystore.
4. Open **Actions → Android Release Bundle → Run workflow** with `upload_to_play = false` first. The signed AAB will be available as a workflow artifact if the build succeeds.
5. Only after reviewing the bundle and completing required testing, run the workflow with `upload_to_play = true`. This uploads a **draft to internal testing**, not a production release. Play Console must already contain the app and the service account must have access.
6. Review and test the draft in Play Console yourself. Do not move this prototype to production until the demonstration hospital data is replaced, app behavior is validated, and policy declarations are accurate.

## Publish through Google Play Console

1. Create or select the app in your own [Google Play Console](https://play.google.com/console) account.
2. Complete the app content and store listing accurately.
3. Configure a secure release signing setup and generate a signed AAB.
4. Upload it to an internal or closed testing track, test on real devices, and resolve Play Console warnings.
5. Complete required testing and review steps shown in your Play Console account, then submit for review. Google controls the review and publication decision.

## Current limitations

AccidentGuard is a student prototype, not an emergency service. Do not rely on it for personal safety, and do not use it as a substitute for local emergency services.
