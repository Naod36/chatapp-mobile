# Blocking Checks

From the mobile project directory:

```powershell
node --test tests/blockPolicy.test.cjs tests/blockRefresh.test.cjs tests/blockWiring.test.cjs tests/conversationLoading.test.cjs
npx expo export --platform web --output-dir "$env:TEMP\flowchat-mobile-block-check"
```

The Node tests run mobile hooks and components with mocked React hooks, HTTP,
WebSocket, app focus, timers, and audio APIs. They do not access production.
They cover directional and mutual blocks, shared refresh triggers, single-request
unblock, message/pin refetch, identity and reaction masking, direct mutation
guards, failed sends, upload aborts, and the native recorder creation race.
Minimal REST send acknowledgments are tested with socket echoes before and after
confirmation, preserving full message fields and receipt progress. Deferred
conversation responses cover reverse completion order, unblock restoration,
unchanged polling, stale errors, and auth invalidation before rerender.
They are not a full React renderer or device integration suite.

## Runtime Contract

- The server owns persistence through `/users/blocked`, `/users/blocked-by`, and
  `POST`/`DELETE /users/block/:id`.
- `{ event: 'block_state_changed' }`, reconnect, and foreground refresh both lists.
  Foreground polling is every 12 seconds, requests time out after 10 seconds,
  and overlapping refreshes coalesce with a trailing refresh.
- Incoming blocks mask identity. Either direction prevents direct interaction.
  Mutual blocks never remove the local user's unblock action. Groups stay usable.
- Relation changes refetch conversations, loaded messages, and pins. Local copy,
  search, and loaded history remain accessible. Failed sends remain marked
  `Not sent`; REST confirmation, not a successful socket write, confirms sends.

## Remaining Integration Checks

- Verify on two native devices and the separate web client against the backend
  worker's deployed block events, payload redaction, and interaction enforcement.
- Confirm native microphone shutdown on both Android and iOS. Audio mocks and a
  web export cannot validate native recorder behavior or OS permission dialogs.
- Group receipt events currently provide aggregate status. The mobile app
  conservatively hides group receipt statuses whenever there is an incoming
  blocker, since it cannot reliably attribute that status to an individual.
- Cancellation cannot undo a message already accepted by the server, or delete
  a media upload already completed. Server-side enforcement remains essential.
- While offline, remote relation changes cannot arrive; known state is retained.
  Before the first successful relation refresh, direct messaging and identity
  display fail closed. No identity-bearing block cache is persisted locally.
- Required SDK 57 documentation was read. The installed SDK 54/expo-av setup is
  unchanged; its versioned recording docs were also consulted. No native build,
  release, OTA, dependency upgrade, or production account mutation is needed for
  these local checks.