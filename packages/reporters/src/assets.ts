export function renderReportStyles(): string {
  return `:root {
  color-scheme: light;
  --background: #f7f8fa;
  --surface: #ffffff;
  --text: #172033;
  --muted: #4c5870;
  --border: #c7cedb;
  --accent: #1649a8;
  --accent-hover: #0d347d;
  --critical: #8f1127;
  --high: #a33d00;
  --medium: #6b5600;
  --minor: #315d17;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* { box-sizing: border-box; }
html { background: var(--background); color: var(--text); line-height: 1.5; }
body { margin: 0; }
a { color: var(--accent); }
a:hover { color: var(--accent-hover); }
a:focus-visible, button:focus-visible, select:focus-visible {
  outline: 3px solid #ed9d00;
  outline-offset: 3px;
}
.skip-link {
  background: var(--text);
  color: #fff;
  left: 1rem;
  padding: .75rem 1rem;
  position: fixed;
  top: -5rem;
  z-index: 10;
}
.skip-link:focus { top: 1rem; }
.site-header, main, footer { margin-inline: auto; max-width: 78rem; padding: 1.25rem; }
.site-header { background: #12213d; color: #fff; max-width: none; }
.site-header__inner { margin-inline: auto; max-width: 75.5rem; }
.site-header p { color: #e0e6f1; }
nav ul { display: flex; flex-wrap: wrap; gap: 1rem; list-style: none; padding: 0; }
nav a { color: #fff; font-weight: 700; }
section { margin-block: 2.5rem; }
.summary-grid, .coverage-grid, .run-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
}
.summary-card, .coverage-card, .run, .finding, .filters, .empty-state {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: .4rem;
  padding: 1rem;
}
.summary-card strong { display: block; font-size: 1.8rem; }
.summary-card--critical { border-top: .4rem solid var(--critical); }
.summary-card--high { border-top: .4rem solid var(--high); }
.summary-card--medium { border-top: .4rem solid var(--medium); }
.summary-card--minor { border-top: .4rem solid var(--minor); }
.summary-card--new { border-top: .4rem solid #1649a8; }
.summary-card--known { border-top: .4rem solid #4c5870; }
.summary-card--regressed { border-top: .4rem solid var(--high); }
.summary-card--resolved { border-top: .4rem solid #315d17; }
.summary-card--not-compared { border-top: .4rem solid #66738a; }
.summary-card--expired { border-top: .4rem solid var(--medium); }
.baseline-summary-grid { margin-block: 1rem; }
.baseline-metadata {
  border-top: 1px solid var(--border);
  margin-top: 1rem;
  padding-top: 1rem;
}
.baseline-metadata h4 { margin-top: 0; }
.lifecycle-badge {
  font-weight: 800;
  margin: 0 0 .75rem;
  text-transform: capitalize;
}
.lifecycle-badge__label { font-weight: 700; }
.lifecycle-badge--new::before { content: "[New] "; font-weight: 800; }
.lifecycle-badge--known::before { content: "[Known] "; font-weight: 800; }
.lifecycle-badge--regressed::before { content: "[Regressed] "; font-weight: 800; }
.lifecycle-badge--resolved::before { content: "[Resolved] "; font-weight: 800; }
.lifecycle-badge--not-compared::before { content: "[Not compared] "; font-weight: 800; }
.baseline-entry { border-left-style: dashed; }
.baseline-coverage { margin-top: 1rem; }
.coverage-details {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
}
.coverage-list {
  margin: 0;
  padding-left: 1.25rem;
}
.baseline-dispositions { margin-top: 1rem; }
.filters { margin-block: 1rem; }
.filter-grid {
  display: grid;
  gap: .8rem;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
}
.filter-field label { display: block; font-weight: 700; margin-bottom: .25rem; }
select, button {
  background: #fff;
  border: 2px solid #66738a;
  border-radius: .25rem;
  color: var(--text);
  font: inherit;
  min-height: 2.75rem;
  padding: .45rem .6rem;
  width: 100%;
}
button { cursor: pointer; font-weight: 700; margin-top: 1rem; width: auto; }
.result-count { font-weight: 700; }
.findings-list { display: grid; gap: 1.25rem; }
.finding { border-left-width: .5rem; }
.finding--critical { border-left-color: var(--critical); }
.finding--high { border-left-color: var(--high); }
.finding--medium { border-left-color: var(--medium); }
.finding--minor { border-left-color: var(--minor); }
.severity { font-weight: 800; text-transform: uppercase; }
.source-impact { color: var(--muted); font-size: .9rem; font-weight: 600; text-transform: none; }
.metadata { display: grid; gap: .4rem 1rem; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); }
.metadata dt { font-weight: 700; }
.metadata dd { margin: 0; overflow-wrap: anywhere; }
pre {
  background: #eef1f6;
  border: 1px solid var(--border);
  overflow: auto;
  padding: .75rem;
  white-space: pre-wrap;
}
.evidence {
  border: 1px solid var(--border);
  display: block;
  height: auto;
  margin-top: 1rem;
  max-width: 100%;
}
.diagnostics { padding-left: 1.25rem; }
.status { font-weight: 800; text-transform: capitalize; }
.disclaimers { border-left: .3rem solid var(--accent); padding-left: 1rem; }
.muted { color: var(--muted); }
.profile-evidence-list { display: grid; gap: 1.5rem; }
.profile-evidence {
  background: var(--surface);
  border: 1px solid var(--border);
  border-left-width: .5rem;
  border-radius: .4rem;
  padding: 1rem;
}
.profile-evidence--keyboard { border-left-color: #1649a8; }
.profile-evidence--large-text { border-left-color: #6b5600; }
.metadata--inline {
  display: flex;
  flex-wrap: wrap;
  gap: .75rem 1.5rem;
  margin-block: .75rem 1rem;
}
.metadata--inline div { min-width: 10rem; }
.comparison-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  margin-top: 1rem;
}
.comparison-shot {
  border: 1px solid var(--border);
  margin: 0;
  padding: .75rem;
}
.comparison-shot figcaption {
  font-weight: 700;
  margin-bottom: .5rem;
}
.comparison-shot--missing {
  background: #eef1f6;
}
.coverage-grid--profiles { margin-bottom: 1rem; }
.coverage-card--profile h4 {
  font-size: 1rem;
  margin: .75rem 0 .25rem;
}
.coverage-stats { margin-top: 1rem; }
.focus-sequence-table code {
  font-size: .85em;
  word-break: break-word;
}
.visually-hidden {
  border: 0;
  clip: rect(0 0 0 0);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  white-space: nowrap;
  width: 1px;
}
.table-wrap { overflow-x: auto; }
table {
  border-collapse: collapse;
  min-width: 100%;
  width: max-content;
}
th, td {
  border: 1px solid var(--border);
  padding: .6rem .75rem;
  text-align: left;
  vertical-align: top;
}
th { background: #eef1f6; }
[hidden] { display: none !important; }
footer { border-top: 1px solid var(--border); color: var(--muted); }

@media (max-width: 40rem) {
  .site-header, main, footer { padding: 1rem; }
  h1 { font-size: 1.8rem; }
  .metadata { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    transition-duration: .01ms !important;
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
  }
}
`;
}

export function renderReportScript(): string {
  return `"use strict";

const form = document.querySelector("[data-report-filters]");
const articles = Array.from(document.querySelectorAll("[data-finding]"));
const count = document.querySelector("[data-result-count]");

if (form instanceof HTMLFormElement && count instanceof HTMLElement) {
  const controls = Array.from(form.querySelectorAll("select"));

  const update = () => {
    const visibleFingerprints = new Set();
    let visibleCards = 0;
    for (const article of articles) {
      if (!(article instanceof HTMLElement)) continue;
      const matches = controls.every((control) => {
        if (!(control instanceof HTMLSelectElement) || control.value === "") return true;
        return article.dataset[control.name] === control.value;
      });
      article.hidden = !matches;
      if (matches) {
        visibleCards += 1;
        if (article.dataset.fingerprint) {
          visibleFingerprints.add(article.dataset.fingerprint);
        }
      }
    }
    const visible = visibleFingerprints.size > 0 ? visibleFingerprints.size : visibleCards;
    count.textContent = visible + (visible === 1 ? " finding shown" : " findings shown");
  };

  form.addEventListener("change", update);
  form.addEventListener("reset", () => {
    window.setTimeout(update, 0);
  });
  update();
}
`;
}
