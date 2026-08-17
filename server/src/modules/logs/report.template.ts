export const reportTemplate = String.raw`<!doctype html>
<html><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 18mm 14mm 18mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #33312b; font-family: Arial, sans-serif; font-size: 10px; line-height: 1.45; }
  header { border-bottom: 2px solid #33312b; padding-bottom: 12px; margin-bottom: 18px; }
  .brand { font-size: 22px; font-weight: 700; letter-spacing: -0.4px; }
  .eyebrow { color: #65756f; font-size: 9px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; }
  h1 { margin: 6px 0 4px; font-size: 25px; letter-spacing: -0.5px; }
  .muted { color: #65645e; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 0 0 18px; }
  .card { border: 1px solid #d8d2c8; border-radius: 8px; padding: 10px; background: #faf9f6; }
  .card strong { display: block; margin-top: 4px; font-size: 18px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th { background: #33312b; color: white; padding: 7px 6px; text-align: left; font-size: 8px; text-transform: uppercase; letter-spacing: .5px; }
  td { border-bottom: 1px solid #ded9d0; padding: 8px 6px; vertical-align: top; overflow-wrap: anywhere; }
  .date { width: 15%; } .site { width: 15%; } .severity { width: 10%; } .decision { width: 12%; } .detail { width: 48%; }
  .pill { display: inline-block; border: 1px solid #c9c3b8; border-radius: 999px; padding: 2px 6px; font-size: 8px; font-weight: 700; text-transform: uppercase; }
  .snippet { margin-top: 4px; color: #65645e; white-space: pre-wrap; }
  footer { margin-top: 14px; color: #777269; font-size: 8px; }
</style></head><body>
<header><div class="brand">HallGuard</div><div class="eyebrow">Redacted warning report</div><h1>Account-backed protection activity</h1><div class="muted">Generated {{ generatedAt }} for {{ accountEmail }}{% if filterLabel %} - {{ filterLabel }}{% endif %}</div></header>
<section class="summary">
  <div class="card">Warnings<strong>{{ summary.totalLogs }}</strong></div>
  <div class="card">High severity<strong>{{ summary.bySeverity.high }}</strong></div>
  <div class="card">Blocked<strong>{{ summary.byDecision.blocked }}</strong></div>
  <div class="card">Redacted copies<strong>{{ summary.byDecision['redacted-copied'] }}</strong></div>
</section>
<table><thead><tr><th class="date">Date</th><th class="site">Website</th><th class="severity">Severity</th><th class="decision">Decision</th><th class="detail">Redacted detail</th></tr></thead><tbody>
{% for log in logs %}<tr><td>{{ log.timestamp }}</td><td><strong>{{ log.tool }}</strong><br><span class="muted">{{ log.hostname }}</span></td><td><span class="pill">{{ log.severity }}</span></td><td>{{ log.decision }}</td><td><strong>{{ log.title }}</strong><div class="snippet">{{ log.redactedSnippet }}</div>{% if log.evidence.length %}<div class="muted">Why flagged: {{ log.evidence | join(', ') }}</div>{% endif %}</td></tr>{% endfor %}
</tbody></table><footer>Only redacted, account-backed warning records are included. Soft-deleted records are excluded.</footer>
</body></html>`
