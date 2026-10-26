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
- Never commit keystores, passwords, service-account JSON, API secrets, or signing credentials to Git.
- The CI workflow currently builds a debug APK for engineering tests. A debug APK is not a production release bundle and is not suitable for production publication.

## Publish through Google Play Console

1. Create or select the app in your own [Google Play Console](https://play.google.com/console) account.
2. Complete the app content and store listing accurately.
3. Configure a secure release signing setup and generate a signed AAB.
4. Upload it to an internal or closed testing track, test on real devices, and resolve Play Console warnings.
5. Complete required testing and review steps shown in your Play Console account, then submit for review. Google controls the review and publication decision.

## Current limitations

AccidentGuard is a student prototype, not an emergency service. Do not rely on it for personal safety, and do not use it as a substitute for local emergency services.
