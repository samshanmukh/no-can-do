# NO CAN DO™

**The AI trash can that won't take your crap.** Starring Binjamin, Chief Refuse Officer: an emotionally intelligent bin that uses toxic positivity to stop you throwing ordinary garbage away—then eagerly accepts expensive electronics as “actual garbage.”

The project is designed for a two-minute hackathon demo that keeps working even when the camera, network, API, audio, or motor does not.

## Run it

No install or build step is required. Use Node 22.9 or newer:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Camera and Web Serial permissions work on localhost.

The app starts in **Scripted** mode. Use the on-screen demo deck or keyboard shortcuts:

| Key | Action |
| --- | --- |
| `1` | Banana peel / retired athlete |
| `2` | Crumpled résumé / resilient professional |
| `3` | Old iPhone / actual garbage |
| `4` | Random chaos object |
| `L` | Judge's live mystery object; safely falls back to “Private Citizen” |
| `Space` | Run the next scripted beat or live scan |
| `A` | Appeal the current verdict in the Supreme Court of Refuse |
| `H` | Open the saved-object Hall of Potential |
| `P` | Toggle big-screen presenter mode |
| `O` / `C` / `R` | Manually open, close, or reject with the motor |

Every verdict receives a case number and is saved locally in the Hall of Potential. Refused objects can file a voice- or text-based appeal, generate a printable rehabilitation certificate, and return to society with a legally meaningless new career. The app installs as an offline-capable PWA after its first successful load.

## Optional live AI vision

The scripted mode is fully local. To make audience objects unpredictable, copy the environment example and add an API key:

```bash
cp .env.example .env
```

```dotenv
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.4-mini
```

Restart the server and select **Live AI**. The key remains server-side. Camera frames are sent once with `store: false`; the app does not intentionally save them.

The server uses the OpenAI Responses API with a low-detail base64 image input and strict JSON-schema output. See the official [vision guide](https://developers.openai.com/api/docs/guides/images-vision) and [structured outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs).

If the API is unavailable or takes more than four seconds, Binjamin switches to an object-agnostic local verdict so the joke lands without claiming a blurry coffee cup is a sock. Emergency scripted prop buttons cancel a stalled live request immediately.

The server binds to loopback only, keeps the API key server-side, rejects cross-origin and non-JSON judgment requests, limits request size/rate/concurrency, validates structured output again at the trust boundary, and applies restrictive browser security headers. `/api/health` is available for a pre-demo check.

## Servo-powered lid

### Parts

- Arduino Uno or Nano-compatible board
- SG90 micro-servo
- Lightweight cardboard or plastic lid
- USB cable
- Separate regulated 5V / 1A supply recommended
- 470–1000 µF capacitor across the servo supply recommended
- Optional red, amber, and green LEDs with 220–330 Ω resistors
- Optional passive piezo with a 100–220 Ω series resistor

### Wiring

| Servo lead | Connect to |
| --- | --- |
| Orange/yellow signal | Arduino D9 |
| Red power | Regulated 5V |
| Brown/black ground | Power ground and Arduino GND |

Optional theater wiring:

| Effect | Connect to |
| --- | --- |
| Red / amber / green LED anodes | Arduino D4 / D5 / D6 through individual resistors |
| LED cathodes | Arduino GND |
| Passive piezo positive | Arduino D8 through a series resistor |
| Passive piezo negative | Arduino GND |

Do not power a loaded servo from the Arduino 5V pin; brownouts are common. Keep the mechanism lightweight and away from fingers.

1. Open [`hardware/binjamin/binjamin.ino`](hardware/binjamin/binjamin.ino) in Arduino IDE.
2. Calibrate `CLOSED_ANGLE` and `OPEN_ANGLE` with the linkage disconnected.
3. Flash the sketch and close Arduino Serial Monitor.
4. Open the app in Chrome or Edge.
5. Manually place the lid in its closed position and clear all fingers and props from the linkage.
6. Press **Connect Bin** once to show the safety check, then again to arm and select the board.

The browser performs a `PING` / `READY` handshake, then sends `ARM`. After that it can send newline-delimited `OPEN`, `CLOSE`, and `REJECT` commands at 115200 baud. The optional lights and piezo receive `CUE IDLE`, `CUE SCAN`, `CUE REFUSE`, `CUE ACCEPT`, and `MUTE ON/OFF`; they acknowledge immediately and never alter lid safety. The lid never auto-closes; press `C` only after confirming the opening is clear, and close it before disconnecting. A ten-second open-lid warning adds lights and a chirp without moving anything. Use a flexible or slipping linkage, guard the pinch edge, and keep a physical servo-power switch within reach. If USB disconnects, the CSS trash can continues the performance.

## Two-minute demo

1. “We built the world's first emotionally intelligent trash can. Unfortunately, it became emotionally attached to the trash. Meet Binjamin.”
2. Hold up a banana peel, then press `1`. Pause after “potassium-based trauma.”
3. Let a judge choose a mystery prop, press `L`, and then appeal with “But it's literally trash.”
4. Hold up an old phone, then press `3`. The staged Lightning-port setup pauses before the lid opens for “actual garbage.”
5. Close with: “NO CAN DO: reducing waste by making disposal emotionally impossible.”

## Verify

```bash
npm run check
npm test
```
