// Download page: links to the desktop installers published on GitHub Releases
// by the "Build desktop installers" workflow. The "latest/download" URLs are
// stable across versions because electron-builder uses fixed artifact names.

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

export function Download() {
  const current = detectOS();

  return (
    <section>
      <h2>Download the desktop app</h2>
      <p className="muted" style={{ maxWidth: 620 }}>
        The desktop app lets you clock in/out and edit entries even with no internet —
        it stores everything locally and syncs to this platform when you’re back online.
        After installing, enter this site’s address on its login screen.
      </p>

      <div className="downloads">
        {BUILDS.map((b) => (
          <a
            key={b.os}
            className={`card download ${b.os === current ? "recommended" : ""}`}
            href={`${base}/${b.file}`}
          >
            <div className="dl-os">{b.label}</div>
            {b.os === current && <div className="dl-badge">Detected — recommended</div>}
            <div className="muted dl-hint">{b.hint}</div>
            <div className="dl-cta">Download ↓</div>
          </a>
        ))}
      </div>

      <p className="muted" style={{ marginTop: "1rem", fontSize: "0.8rem", maxWidth: 620 }}>
        On an Intel Mac, or don’t see a download? Builds are produced automatically on each
        release; if a link 404s, no release has been published yet. You can also run from
        source — see the project README.
      </p>
    </section>
  );
}
