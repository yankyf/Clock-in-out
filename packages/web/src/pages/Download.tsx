// Download page: links to the desktop installers published on GitHub Releases
// by the "Build desktop installers" workflow. Clicking a platform starts the
// download AND reveals step-by-step install instructions (including how to get
// past the unsigned-app warnings on Windows/macOS).

import { useState } from "react";

const REPO = "yankyf/Clock-in-out";
const base = `https://github.com/${REPO}/releases/latest/download`;

type OS = "mac" | "windows" | "linux" | "unknown";

interface Build {
  os: Exclude<OS, "unknown">;
  label: string;
  file: string;
  hint: string;
}

const BUILDS: Build[] = [
  { os: "windows", label: "Windows", file: "Clock-In-Out-win.exe", hint: "Windows 10/11 · installer (.exe)" },
  { os: "mac", label: "macOS", file: "Clock-In-Out-mac.dmg", hint: "Apple Silicon · disk image (.dmg)" },
  { os: "linux", label: "Linux", file: "Clock-In-Out-linux.AppImage", hint: "AppImage · make executable & run" },
];

function detectOS(): OS {
  const ua = navigator.userAgent;
  if (/Win/i.test(ua)) return "windows";
  if (/Mac/i.test(ua)) return "mac";
  if (/Linux|X11/i.test(ua)) return "linux";
  return "unknown";
}

function instructionsFor(os: Build["os"], serverUrl: string): React.ReactNode {
  const signIn = (
    <li>
      When the app opens, set <strong>Server URL</strong> to <code>{serverUrl}</code>, then sign in
      with your email and password.
    </li>
  );
  if (os === "windows") {
    return (
      <ol>
        <li>When the download finishes, open <code>Clock-In-Out-win.exe</code>.</li>
        <li>
          Windows may show <em>“Windows protected your PC”</em>. This is just because the app isn’t
          code-signed yet — it’s not a virus. Click <strong>More info → Run anyway</strong>.
        </li>
        <li>Follow the installer; the app launches when it finishes.</li>
        {signIn}
      </ol>
    );
  }
  if (os === "mac") {
    return (
      <ol>
        <li>Open the downloaded <code>Clock-In-Out-mac.dmg</code> and drag the app to Applications.</li>
        <li>
          First launch: macOS may say <em>“unidentified developer”</em> (the app isn’t signed yet).
          <strong> Right-click the app → Open → Open</strong>. You only do this once.
        </li>
        {signIn}
      </ol>
    );
  }
  return (
    <ol>
      <li>
        Make it executable, then run it:
        <pre>chmod +x Clock-In-Out-linux.AppImage{"\n"}./Clock-In-Out-linux.AppImage</pre>
      </li>
      {signIn}
    </ol>
  );
}

export function Download() {
  const current = detectOS();
  const [openOs, setOpenOs] = useState<Build["os"] | null>(
    current === "unknown" ? null : current,
  );
  const serverUrl = window.location.origin;

  return (
    <section>
      <h2>Download the desktop app</h2>
      <p className="muted" style={{ maxWidth: 620 }}>
        The desktop app lets you clock in/out and edit entries even with no internet —
        it stores everything locally and syncs to this platform when you’re back online.
      </p>

      <div className="downloads">
        {BUILDS.map((b) => (
          <a
            key={b.os}
            className={`card download ${b.os === current ? "recommended" : ""}`}
            href={`${base}/${b.file}`}
            onClick={() => setOpenOs(b.os)}
          >
            <div className="dl-os">{b.label}</div>
            {b.os === current && <div className="dl-badge">Detected — recommended</div>}
            <div className="muted dl-hint">{b.hint}</div>
            <div className="dl-cta">Download ↓</div>
          </a>
        ))}
      </div>

      {openOs && (
        <div className="card instructions">
          <strong>Installing on {BUILDS.find((b) => b.os === openOs)!.label}</strong>
          {instructionsFor(openOs, serverUrl)}
          <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
            Why the warning? These installers aren’t code-signed yet (signing needs a paid
            certificate), so Windows SmartScreen / macOS Gatekeeper flag new apps by default.
            It’s safe to proceed.
          </p>
        </div>
      )}

      <p className="muted" style={{ marginTop: "1rem", fontSize: "0.8rem", maxWidth: 620 }}>
        On an Intel Mac, or a link 404s? No release has been published yet, or your platform
        isn’t built — you can also run from source (see the project README).
      </p>
    </section>
  );
}
