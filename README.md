# Video Conference

A browser-based video conferencing app: Socket.IO for signaling/room management, native WebRTC (`RTCPeerConnection`) for peer-to-peer audio/video.

## Local development

1. Process to start the server

   1. Run `setup-backend.cmd` (waits for `npm install` to complete)
   2. Open the `Video-Call-Backend` folder
   3. Run `build.cmd`
   4. Run `start.cmd`

   Keep that command prompt open.

2. Process to start the React app

   1. Run `setup-frontend.cmd`
   2. Open the `Video-Call-Frontend` folder
   3. Run `start.cmd`

   Keep that command prompt open too.

   Note: the first load will take a moment to compile.

   It opens a browser window at `http://localhost:3000`. Open multiple browser windows/profiles to test with several participants, since login is saved per-browser.

## Configuration

Both apps read configuration from environment variables (see `.env.example` in each folder).

**Video-Call-Backend**

| Variable          | Default                 | Purpose                                            |
| ----------------- | ------------------------ | --------------------------------------------------- |
| `PORT`            | `3001`                  | Port the HTTP/Socket.IO server listens on            |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | Comma-separated list of origins allowed by CORS      |
| `NODE_ENV`        | `development`           | `production` enables `trust proxy` and access logs   |

**Video-Call-Frontend**

| Variable               | Default                                      | Purpose                         |
| ----------------------- | --------------------------------------------- | -------------------------------- |
| `REACT_APP_BACKEND_URL` | derived from the page's own hostname, port 3001 | URL of the backend API/Socket.IO server |

Copy `.env.example` to `.env` in each folder and adjust as needed. `REACT_APP_BACKEND_URL` must be set explicitly for any production build (CRA inlines `REACT_APP_*` vars at build time).

## Production deployment

1. **HTTPS is required.** Browsers only grant camera/microphone access (`getUserMedia`) on secure origins (`https://` or `localhost`). Serve both the frontend and backend over TLS — e.g. behind a reverse proxy (nginx, Caddy) or your platform's built-in TLS termination.
2. **Build the backend**: `cd Video-Call-Backend && npm install && npm run build`, then run with `npm run start` (or a process manager like PM2/systemd) with `NODE_ENV=production`, `PORT`, and `FRONTEND_ORIGIN` set to your real frontend origin(s).
3. **Build the frontend**: `cd Video-Call-Frontend && npm install && REACT_APP_BACKEND_URL=https://your-api-host npm run build`, then serve the resulting `build/` folder as static files (nginx, a CDN, `serve -s build`, etc.).
4. **NAT traversal**: the app currently relies on public STUN servers only. If calls fail to connect for participants behind restrictive/symmetric NATs or corporate firewalls, add a TURN server and extend `rtcConfiguration` in `Video-Call-Frontend/src/pages/conference-room.js`.
5. **Topology note**: peer connections are a full mesh (every participant connects directly to every other participant), which is appropriate for small rooms but does not scale to large ones — each additional participant adds an upload stream for every existing participant.
6. **Known upstream limitation**: `react-scripts` (Create React App) pulls in dev-only tooling (Jest, webpack-dev-server) with unresolved transitive `npm audit` findings. These are build-time only and are not part of the shipped production bundle; `npm audit` on the frontend will still report them until the project migrates off CRA.

## Manual test flow

After the steps above are done:

1. Login with a display name.

**Host operations**

1. Click "Host a call" — the room name is the host's own name.
2. Host can request users to join: click the "+" icon and enter a username (make sure that user is open in a different browser/profile).
3. Host can run a timer: click a duration and it's shown to all participants; an alarm tone plays for everyone when it ends.
4. Host can mute any user via the mute icon on their tile.
5. Host can remove any user via the remove icon; it's reflected for everyone.
6. Host can leave the call, which ends it for all participants.

**Participant operations**

1. Click "Join a call" and enter the host's name.
2. See the timer if the host starts one.
3. Get an alert if the host mutes you.
4. Leave the call via the call icon.

**Recommended test setup**

1. Open three browsers/profiles (e.g. Chrome, Chrome Incognito, Edge/Firefox).
2. Log in with three different display names (e.g. Alice, Bob, Steve).
3. Host a call from one (e.g. Alice) — remember that name.
4. From another (e.g. Bob), join using the host's name.
5. From the host, invite the third (e.g. Steve).
6. Accept the invite from the third browser and try the operations above.
