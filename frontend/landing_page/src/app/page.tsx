import TrajectoryDemo from "@/components/TrajectoryDemo";
import LaneStrip from "@/components/LaneStrip";
import RekorNav from "@/components/RekorNav";
import RekorHero from "@/components/RekorHero";
import VisionXLogo from "@/components/VisionXLogo";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="spacex-landing theme-light">
      <RekorNav theme="light" />
      <RekorHero theme="light" />

      {/* ─────── About VisionX (21st.dev inspired clean bento) ─────── */}
      <section className="section" id="about">
        <div className="wrap">
          <div className="sec-head">
            <h2>Four Pillars of Roadway Intelligence</h2>
            <p>
              VisionX unifies vehicle localization, character-level Vision Transformers, and
              spatial trajectory reconstruction into a single edge-capable mobility operating system.
            </p>
          </div>

          <div className="about-bento-grid">
            {/* Card 1: Dual-Stage Neural OCR */}
            <article className="bento-card bento-span-2">
              <div className="bento-card-header">
                <span className="bento-tag">STAGE 01 &amp; 02</span>
                <span className="bento-badge">94.2% ACCURACY</span>
              </div>
              <h3>Vehicle Localization &amp; Transformer OCR</h3>
              <p>
                Two-stage pipeline: YOLO11 detects vehicles in under 18ms, followed by tight plate
                cropping and character-level TrOCR recognition with Indian HSRP and Trade Certificate syntax validation.
              </p>
              <div className="bento-preview-plate">
                <div className="plate-box">
                  <span className="plate-flag">IND</span>
                  <span className="plate-code">DL 04 GH 4004</span>
                </div>
                <div className="plate-meta">
                  <span className="meta-tag green">● Conf: 98.4%</span>
                  <span className="meta-tag">HSRP Validated</span>
                </div>
              </div>
            </article>

            {/* Card 2: Trajectory Reconstruction Engine */}
            <article className="bento-card">
              <div className="bento-card-header">
                <span className="bento-tag">SPATIAL ENGINE</span>
              </div>
              <h3>Trajectory Reconstruction</h3>
              <p>
                Assembles disparate camera sightings into a chronological route graph, detecting impossible
                hops (cloned plates) and repetitive circling patterns across municipal junctions.
              </p>
              <div className="bento-mini-route">
                <div className="route-node">
                  <span className="dot" />
                  <span>CAM 02</span>
                  <span className="time">09:07</span>
                </div>
                <span className="route-arrow">⟶</span>
                <div className="route-node hot">
                  <span className="dot" />
                  <span>CAM 06</span>
                  <span className="time">09:09</span>
                </div>
              </div>
            </article>

            {/* Card 3: Macro Corridor Analytics */}
            <article className="bento-card">
              <div className="bento-card-header">
                <span className="bento-tag">FLOW TELEMETRY</span>
              </div>
              <h3>Corridor Density &amp; Speed</h3>
              <p>
                Aggregates high-frequency plate reads into continuous corridor flow indices,
                detecting arterial bottlenecks and congestion hotspots before gridlock occurs.
              </p>
              <div className="bento-mini-stat">
                <div className="stat-row">
                  <span>Ring Road Corridor</span>
                  <strong>52 km/h</strong>
                </div>
                <div className="stat-track">
                  <div className="stat-fill" style={{ width: "68%" }} />
                </div>
              </div>
            </article>

            {/* Card 4: Real-time Control Room Alerts */}
            <article className="bento-card bento-span-2">
              <div className="bento-card-header">
                <span className="bento-tag">ENFORCEMENT DISPATCH</span>
                <span className="bento-badge alert">SUB-50ms DISPATCH</span>
              </div>
              <h3>Instant Watchlist &amp; Anomaly Alerting</h3>
              <p>
                Evaluates hotlists and municipal watchlist rules within 50ms of camera ingress,
                broadcasting instant geolocation and crop telemetry to patrol units and traffic controllers.
              </p>
              <div className="bento-alert-row">
                <span className="alert-dot" />
                <div className="alert-copy">
                  <strong>Critical Watchlist Match: MH 12 AB 1234</strong>
                  <span>Spotted at Flyover Gantry (Sector 09) • Automated dispatch notification issued</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ─────── What only a journey can show ─────── */}
      <section className="section" id="insights">
        <div className="wrap">
          <div className="sec-head">
            <h2>Three things only a journey can show</h2>
            <p>
              A read log cannot answer these. They need every sighting of a vehicle in time
              order, so they come from the trajectory engine rather than from the camera.
            </p>
          </div>

          <div className="grid3">
            <article className="ins">
              <div className="art"><CloneArt /></div>
              <div className="body">
                <span className="mono-xs">Journey only / 01</span>
                <h3>Cloned plate detection</h3>
                <p>
                  Two cars wearing one plate appear at distant cameras minutes apart. A reader
                  sees two valid reads. A journey sees a hop no single vehicle can make.
                </p>
              </div>
            </article>
            <article className="ins">
              <div className="art"><LoopArt /></div>
              <div className="body">
                <span className="mono-xs">Journey only / 02</span>
                <h3>Loop and circling detection</h3>
                <p>
                  A vehicle that passes the same junction three times in forty minutes hides
                  in a read log and stands out on a route.
                </p>
              </div>
            </article>
            <article className="ins">
              <div className="art"><MisreadArt /></div>
              <div className="body">
                <span className="mono-xs">Journey only / 03</span>
                <h3>Misread recovery</h3>
                <p>
                  Rain, glare and angle turn a B into an 8. Matching against nearby plates and
                  timing keeps the sighting on the right journey instead of creating a ghost vehicle.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ─────── Pipeline (with live lane example) ─────── */}
      <section className="section" id="pipeline">
        <div className="wrap">
          <div className="sec-head">
            <h2>From camera frame to alert</h2>
            <p>
              A streaming design. Every step writes to the sighting store, and the alert check
              runs before the result reaches the operator. The feed below shows step two, the
              read, on a simulated lane.
            </p>
          </div>

          <LaneStrip />

          <div className="pipe">
            <div className="step">
              <h4>Ingest</h4>
              <p>RTSP streams and recorded footage from junction cameras, with camera ID and location attached.</p>
            </div>
            <div className="step">
              <h4>Read</h4>
              <p>Detector finds the plate, OCR returns text and a confidence score.</p>
            </div>
            <div className="step">
              <h4>Store</h4>
              <p>Plate, camera, timestamp, confidence and crop saved as one sighting record.</p>
            </div>
            <div className="step">
              <h4>Analyse</h4>
              <p>Sightings are joined into trajectories and aggregated into density and speed.</p>
            </div>
            <div className="step alert">
              <h4>Alert</h4>
              <p>Watchlist and anomaly rules fire and notify the control room.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────── Demo (Trajectory Search) ─────── */}
      <section className="section" id="demo">
        <div className="wrap">
          <div className="sec-head">
            <h2>Trajectory search &amp; reconstruction</h2>
            <p>
              Pick a plate to see its camera sightings reconstructed in time order.
              Try the cloned plate to see an impossible hop, or mistype a character to see
              the closest match recovered.
            </p>
          </div>

          <TrajectoryDemo />
        </div>
      </section>

      {/* ─────── Footer ─────── */}
      <footer>
        <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <VisionXLogo size="sm" />
            <span>ADVANCED MOBILITY &amp; ROADWAY INTELLIGENCE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ───────── Insight artwork ───────── */

const MONO_STYLE = { fontFamily: "var(--mono-font)" } as const;

function CloneArt() {
  return (
    <svg viewBox="0 0 300 150" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <line x1="48" y1="104" x2="252" y2="46" stroke="#C9C6B9" strokeWidth="12" strokeLinecap="round" />
      <line x1="48" y1="104" x2="252" y2="46" stroke="#fff" strokeWidth="8" strokeLinecap="round" />
      <line x1="48" y1="104" x2="252" y2="46" stroke="#B8321A" strokeWidth="2.5" strokeDasharray="6 5"
        strokeLinecap="round" className="march" />
      {[[48, 104], [252, 46]].map(([x, y], i) => (
        <g key={i}>
          <rect x={x - 14} y={y - 14} width="28" height="28" fill="none" stroke="#B8321A" strokeWidth="1.5">
            <animate attributeName="opacity" values="0.9;0.15;0.9" dur="1.6s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
          </rect>
          <rect x={x - 7} y={y - 7} width="14" height="14" fill="#121212" />
          <rect x={x - 2.5} y={y - 2.5} width="5" height="5" fill="#F2A93B" />
        </g>
      ))}
      <text x="48" y="136" textAnchor="middle" style={{ ...MONO_STYLE, fontSize: 9, fill: "#5E5E59" }}>CAM 2  09:07</text>
      <text x="252" y="80" textAnchor="middle" style={{ ...MONO_STYLE, fontSize: 9, fill: "#5E5E59" }}>CAM 6  09:09</text>
      <rect x="102" y="62" width="96" height="17" fill="#B8321A" />
      <text x="150" y="73.5" textAnchor="middle" style={{ ...MONO_STYLE, fontSize: 8.5, fill: "#fff" }}>2 MIN APART</text>
      <text x="150" y="26" textAnchor="middle" style={{ ...MONO_STYLE, fontSize: 10, fill: "#121212", fontWeight: 600 }}>DL04GH4004</text>
    </svg>
  );
}

function LoopArt() {
  const d = "M30 75 L150 75 L150 28 L240 28 L240 75 L150 75 L150 122 L60 122 L60 75 L150 75 L272 75";
  return (
    <svg viewBox="0 0 300 150" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <path d={d} fill="none" stroke="#C9C6B9" strokeWidth="12" strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#fff" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#E4572E" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" opacity="0.5" />
      <rect x="132" y="57" width="36" height="36" fill="none" stroke="#E4572E" strokeWidth="1.6">
        <animate attributeName="opacity" values="1;0.15;1" dur="1.8s" repeatCount="indefinite" />
      </rect>
      <rect x="143" y="68" width="14" height="14" fill="#121212" />
      <rect x="147.5" y="72.5" width="5" height="5" fill="#F2A93B" />
      <rect x="-5" y="-5" width="10" height="10" fill="#E4572E" stroke="#fff" strokeWidth="2">
        <animateMotion path={d} dur="7s" repeatCount="indefinite" calcMode="linear" />
      </rect>
      <rect x="160" y="86" width="98" height="16" fill="#E4572E" />
      <text x="209" y="97.5" textAnchor="middle" style={{ ...MONO_STYLE, fontSize: 8.5, fill: "#fff" }}>3 PASSES, 40 MIN</text>
    </svg>
  );
}

function MisreadArt() {
  return (
    <div className="mis">
      <div className="mis-row">
        <span className="mono-xs">Read at Camera 3</span>
        <div className="mis-plate">DL 01 A<em className="bad">8</em> 1001</div>
      </div>
      <div className="mis-arrow" aria-hidden />
      <div className="mis-row">
        <span className="mono-xs">Matched to known plate</span>
        <div className="mis-plate">DL 01 A<em className="ok">B</em> 1001</div>
      </div>
    </div>
  );
}
