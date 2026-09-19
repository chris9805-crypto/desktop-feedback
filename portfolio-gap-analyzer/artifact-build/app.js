(function () {
  "use strict";
  var G = window.GaplineCore;
  var app = document.getElementById("app");
  var STORE = "gapline.artifact.v1";

  /* ------------------------------------------------------------------ state */

  var SAMPLE = [
    { symbol: "VOO", value: 42000 }, { symbol: "QQQ", value: 26000 },
    { symbol: "SPY", value: 14000 }, { symbol: "NVDA", value: 11000 },
    { symbol: "AAPL", value: 9000 }, { symbol: "MSFT", value: 7000 },
    { symbol: "SCHD", value: 6000 }, { symbol: "BND", value: 5000 }
  ];

  var DEFAULT_PROFILE = {
    baseCurrency: "USD", homeRegion: "us", goal: "retirement", horizonYears: 22,
    riskTolerance: 3, monthlyContribution: 800, emergencyFundMonths: 4,
    monthlyEssentialSpend: 2800, incomeNeedRate: 0, taxWrapper: "mixed", homeBiasAllowancePp: 0
  };

  var state = {
    view: "report", holdings: SAMPLE.slice(), cash: 8000, isSample: true,
    profile: Object.assign({}, DEFAULT_PROFILE),
    growthOverride: null, accepted: false,
    presetId: "msciWorld", bondShare: null, projReturn: null, showRest: false,
    open: {}, expTab: "region", detail: null, article: null,
    screen: { q: "", kind: "all", sector: "all", sort: "size", limit: 30 }
  };

  try {
    var saved = JSON.parse(localStorage.getItem(STORE) || "null");
    if (saved) {
      state = Object.assign(state, saved);
      state.profile = Object.assign({}, DEFAULT_PROFILE, saved.profile || {});
      state.screen = Object.assign(state.screen, saved.screen || {});
      state.open = {};
    }
  } catch (e) { /* private mode, or blocked site data: run without persistence */ }

  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        holdings: state.holdings, cash: state.cash, isSample: state.isSample,
        profile: state.profile, growthOverride: state.growthOverride,
        accepted: state.accepted, view: state.view, screen: state.screen,
        presetId: state.presetId, bondShare: state.bondShare, projReturn: state.projReturn
      }));
    } catch (e) { /* nothing to do: the session still works, it just will not be remembered */ }
  }

  /* --------------------------------------------------------------- helpers */

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var pct = G.formatPercent, pp = G.formatPp, lab = G.label;
  function cur(v, d) { return G.formatCurrency(v, state.profile.baseCurrency, d || 0); }
  var PALETTE = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)", "var(--c7)", "var(--c8)"];

  var reportCache = { key: null, value: null };
  function report() {
    var key = JSON.stringify([state.holdings, state.cash, state.profile, state.growthOverride,
      state.presetId, state.bondShare, state.projReturn]);
    if (reportCache.key !== key) {
      var portfolio = G.buildPortfolio(state.holdings, {
        cash: state.cash, baseCurrency: state.profile.baseCurrency, totalValueHint: 0
      });
      var overrides = { presetId: state.presetId };
      if (state.bondShare != null) overrides.bondShare = state.bondShare;
      else if (state.growthOverride != null) overrides.growthShare = state.growthOverride;
      var projOverrides = state.projReturn == null ? {} : { realReturn: state.projReturn };
      reportCache = {
        key: key,
        value: G.analysePortfolio(portfolio, state.profile, {
          referenceOverrides: overrides, projectionOverrides: projOverrides
        })
      };
    }
    return reportCache.value;
  }

  function stackedBar(slices) {
    var total = slices.reduce(function (a, s) { return a + s.value; }, 0);
    if (total <= 0) return "";
    var segs = slices.map(function (s, i) {
      return '<div style="width:' + ((s.value / total) * 100).toFixed(3) + "%;background:" + PALETTE[i % 8] + '"></div>';
    }).join("");
    var legend = slices.map(function (s, i) {
      return '<span class="legend-item"><i class="swatch" style="background:' + PALETTE[i % 8] + '"></i>' +
        esc(s.label) + ' <span class="legend-v">' + pct(s.value / total) + "</span></span>";
    }).join("");
    return '<div class="bar" role="img" aria-label="' +
      esc(slices.map(function (s) { return s.label + " " + pct(s.value / total); }).join(", ")) +
      '">' + segs + '</div><div class="legend">' + legend + "</div>";
  }

  function gapTable(rows, threshold) {
    var max = Math.max.apply(null, rows.map(function (r) { return Math.max(r.current, r.reference); }).concat([0.01]));
    var body = rows.map(function (r) {
      var delta = r.current - r.reference;
      var material = Math.abs(delta) >= threshold;
      var tone = !material ? "var(--c8)" : delta > 0 ? "var(--over)" : "var(--under)";
      return '<tr><td class="gap-label">' + esc(r.label) + "</td>" +
        '<td><div class="gap-track"><div class="gap-fill" style="width:' + ((r.current / max) * 100).toFixed(2) +
        "%;background:" + tone + '"></div>' +
        (r.reference > 0 ? '<div class="gap-tick" style="left:calc(' + ((r.reference / max) * 100).toFixed(2) + '% - 1px)" title="Reference ' + pct(r.reference) + '"></div>' : "") +
        "</div></td>" +
        '<td class="gap-val">' + pct(r.current) + "</td>" +
        '<td class="gap-delta" style="color:' + (r.reference > 0 ? tone : "var(--faint)") + '">' +
        (r.reference > 0 ? pp(delta) : "—") + "</td></tr>";
    }).join("");
    return '<table class="gap"><caption class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Your weight against the reference weight</caption><tbody>' + body + "</tbody></table>";
  }

  function pillFor(direction) { return direction === "over" ? "over" : direction === "under" ? "under" : ""; }

  var CATEGORY = {
    allocation: "Allocation", concentration: "Concentration", overlap: "Duplication",
    cost: "Cost", factor: "Tilt", income: "Income", horizon: "Horizon",
    currency: "Currency", quality: "Company quality", liquidity: "Liquidity", structure: "Structure"
  };

  /* ----------------------------------------------------------------- views */

  function candidateTable(screen) {
    var rows = screen.symbols.map(G.lookupSecurity).filter(function (s) { return s && s.kind === "etf"; });
    if (!rows.length) return "";
    return '<div class="note"><strong>Screen used:</strong> ' + esc(screen.description) +
      " These are filter results, not a shortlist — check each one against your own account, wrapper and country." +
      '</div><div class="card scroll" style="margin-top:8px"><table class="data"><thead><tr>' +
      "<th>Fund</th><th class=\"r\">Charge</th><th class=\"r\">Size</th><th class=\"r\">Spread</th><th>Structure</th>" +
      "</tr></thead><tbody>" + rows.map(function (s) {
        return "<tr><td><button class=\"row-link sym\" data-act=\"detail\" data-symbol=\"" + esc(s.symbol) + "\">" + esc(s.symbol) +
          '</button><div style="font-size:11.5px;color:var(--muted)">' + esc(s.name) + "</div></td>" +
          '<td class="r num">' + pct(s.fund.expenseRatio, 2) + "</td>" +
          '<td class="r num" style="color:var(--muted)">' + G.formatCompactCurrency(s.fund.aumUsd, "USD") + "</td>" +
          '<td class="r num" style="color:var(--muted)">' + pct(s.fund.spread, 3) + "</td>" +
          '<td style="font-size:11.5px;color:var(--muted)">' + esc(s.fund.domicile) + " · " + esc(lab(s.fund.distribution)) +
          (s.fund.currencyHedged ? " · hedged" : "") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  function findingCard(f) {
    var open = !!state.open[f.id];
    var tone = pillFor(f.direction);
    var head = '<button class="finding-head" data-act="toggle" data-id="' + esc(f.id) + '" aria-expanded="' + open + '">' +
      '<span class="rank ' + tone + '">' + f.severity + "</span>" +
      '<span style="min-width:0;flex:1">' +
      '<span style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">' +
      '<span class="pill ' + tone + '">' + esc(CATEGORY[f.category] || f.category) + "</span>" +
      '<span class="finding-title">' + esc(f.title) + "</span></span>" +
      '<span class="finding-sum" style="display:block">' + esc(f.summary) + "</span></span>" +
      '<span class="finding-cue">' + (open ? "Hide" : "Detail") + "</span></button>";
    if (!open) return '<article class="finding">' + head + "</article>";

    var ev = '<div><div class="eyebrow">The numbers</div><div class="ev" style="margin-top:10px">' +
      f.evidence.map(function (e) {
        return '<div class="ev-item"><div class="ev-k">' + esc(e.label) + '</div><div class="ev-v">' + esc(e.value) + "</div>" +
          (e.detail ? '<div class="ev-d">' + esc(e.detail) + "</div>" : "") + "</div>";
      }).join("") + "</div></div>";

    var why = '<div><div class="eyebrow">Why this measure matters</div>' +
      '<p style="margin-top:8px;font-size:13px;color:var(--muted)">' + esc(f.why) + "</p>" +
      (f.learnSlug ? '<p style="margin-top:8px"><button class="row-link" data-act="article" data-slug="' + esc(f.learnSlug) +
        '" style="color:var(--accent-ink);font-size:12.5px;font-weight:600;text-decoration:none">Read more on this →</button></p>' : "") + "</div>";

    var impl = "";
    if (f.implementation) {
      var im = f.implementation;
      impl = '<div class="stack-s"><div><div class="eyebrow">Ways this gap could be closed</div>' +
        '<p style="margin-top:8px;font-size:13px;font-weight:600">' + esc(im.objective) + "</p>" +
        (im.gapValue != null ? '<p class="num" style="font-size:12.5px;color:var(--muted);margin-top:3px">Size of the gap: ' + cur(im.gapValue) + "</p>" : "") +
        "</div>" +
        im.routes.map(function (r) {
          return '<div class="route"><div class="route-k">' + esc(r.label) + '</div><div class="route-d">' + esc(r.detail) + "</div></div>";
        }).join("") +
        (im.screen ? candidateTable(im.screen) : "") +
        (im.tradeoffs.length ? '<div class="note"><strong>What you give up either way</strong><ul class="bullets" style="margin-top:6px">' +
          im.tradeoffs.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul></div>" : "") +
        "</div>";
    }
    return '<article class="finding">' + head + '<div class="finding-body">' + ev + why + impl + "</div></article>";
  }


  function projectionPanel(r) {
    var pj = r.projection, c = G.buildFanChart(pj.points, state.profile.baseCurrency, 640, 260);
    var grid = c.yTicks.map(function (tk) {
      return '<line x1="' + c.plot.left + '" x2="' + (c.width - c.plot.right) + '" y1="' + tk.y.toFixed(1) +
        '" y2="' + tk.y.toFixed(1) + '" stroke="var(--line)" stroke-width="1"></line>' +
        '<text x="' + (c.plot.left - 8) + '" y="' + (tk.y + 3.5).toFixed(1) +
        '" text-anchor="end" font-size="10" fill="var(--faint)" font-family="var(--mono)">' + esc(tk.label) + "</text>";
    }).join("");
    var xlab = c.xTicks.map(function (tk) {
      return '<text x="' + tk.x.toFixed(1) + '" y="' + (c.height - 8) +
        '" text-anchor="middle" font-size="10" fill="var(--faint)" font-family="var(--mono)">' + esc(tk.label) + "</text>";
    }).join("");
    var years = pj.assumptions.years;
    var step = Math.max(1, Math.round(years / 6));
    var tableRows = pj.points.filter(function (pt) { return pt.year % step === 0 || pt.year === years; }).map(function (pt) {
      return "<tr><td>" + (pt.year === 0 ? "Today" : pt.year + "y") + "</td>" +
        '<td class="r" style="color:var(--muted)">' + cur(pt.contributed) + "</td>" +
        '<td class="r">' + cur(pt.p10) + "</td>" +
        '<td class="r" style="font-weight:500">' + cur(pt.p50) + "</td>" +
        '<td class="r">' + cur(pt.p90) + "</td></tr>";
    }).join("");

    return '<section class="card pad"><h2 class="sec-title">What the ' + esc(r.reference.presetLabel) +
      ' reference mix has historically ranged between</h2>' +
      '<p class="sub" style="margin-top:4px">A simulation of 2,000 paths, in today\u2019s money. It is not a forecast, and it illustrates the reference model rather than the holdings you actually own.</p>' +

      '<div class="grid3" style="margin-top:16px">' +
      '<div><div class="stat-k">Lower edge — 1 path in 10 below</div><div class="stat-v t-over">' + cur(pj.final.p10) + "</div></div>" +
      '<div><div class="stat-k">Middle outcome</div><div class="stat-v">' + cur(pj.final.p50) + "</div></div>" +
      '<div><div class="stat-k">Upper edge — 1 path in 10 above</div><div class="stat-v t-under">' + cur(pj.final.p90) + "</div></div>" +
      "</div>" +
      '<p class="sub" style="margin-top:8px">After ' + years + " years, against " + cur(pj.final.contributed) + " of your own money paid in.</p>" +

      '<figure style="margin:18px 0 0"><svg id="fan" viewBox="0 0 ' + c.width + " " + c.height +
      '" width="100%" role="img" aria-label="Projected range for the reference mix over ' + years + " years, from " +
      esc(cur(pj.final.p10)) + " to " + esc(cur(pj.final.p90)) + ' in today\u2019s money." style="display:block;max-width:100%;touch-action:none">' +
      grid + xlab +
      '<path d="' + c.bandPath + '" fill="var(--accent)" fill-opacity="0.16"></path>' +
      '<path d="' + c.contributedPath + '" fill="none" stroke="var(--faint)" stroke-width="2" stroke-dasharray="4 4"></path>' +
      '<path d="' + c.medianPath + '" fill="none" stroke="var(--accent)" stroke-width="2"></path>' +
      '<line id="xhair" x1="0" x2="0" y1="' + c.plot.top + '" y2="' + (c.height - c.plot.bottom) +
      '" stroke="var(--line-strong)" stroke-width="1" opacity="0"></line>' +
      '<circle id="xdot" r="4" fill="var(--accent)" stroke="var(--surface)" stroke-width="2" opacity="0"></circle>' +
      "</svg>" +
      '<figcaption style="display:flex;flex-wrap:wrap;gap:6px 20px;align-items:center;margin-top:12px;font-size:11.5px;color:var(--muted)">' +
      '<span class="legend-item"><i class="swatch" style="background:var(--accent);opacity:.26;width:14px;height:10px"></i>10th–90th percentile</span>' +
      '<span class="legend-item"><i style="width:16px;height:2px;background:var(--accent)"></i>Median path</span>' +
      '<span class="legend-item"><i style="width:16px;height:2px;background:var(--faint)"></i>Money paid in</span>' +
      '<span id="readout" class="num" style="margin-left:auto">At ' + years + " years: " + cur(pj.final.p10) +
      " – " + cur(pj.final.p90) + ", middle " + cur(pj.final.p50) + "</span></figcaption></figure>" +

      '<div class="grid2" style="margin-top:20px;padding-top:16px;border-top:1px solid var(--line)">' +
      '<label class="field"><span class="field-k">Real return assumption: ' + pct(pj.assumptions.realReturn) + " a year</span>" +
      '<span class="field-h">' + esc(r.reference.presetLabel) +
      ' blended with the bond sleeve at this model\u2019s weights, on long-run historical figures. After inflation. Change it and the whole range moves.</span>' +
      '<input type="range" id="projret" data-act="projret" min="0" max="10" step="0.1" value="' +
      (Math.round(pj.assumptions.realReturn * 1000) / 10) + '" aria-label="Real return assumption">' +
      (state.projReturn != null ? '<button class="row-link" data-act="projreset" style="margin-top:6px;font-size:12px;color:var(--accent-ink);text-decoration:none">Back to the historical figure</button>' : "") +
      "</label>" +
      '<label class="field"><span class="field-k">Volatility</span><span class="field-h">Derived from the reference mix, not set by you. It is what makes the band wide.</span>' +
      '<input type="text" value="' + pct(pj.assumptions.volatility) + '" readonly aria-readonly="true"></label></div>' +

      '<div style="margin-top:16px"><button class="row-link" data-act="projtable" style="font-size:12px;color:var(--accent-ink);text-decoration:none">' +
      (state.showProjTable ? "Hide the figures" : "Show the figures as a table") + "</button>" +
      (state.showProjTable ? '<div class="scroll" style="margin-top:10px"><table class="data"><thead><tr><th>Year</th>' +
        '<th class="r">Paid in</th><th class="r">Lower edge</th><th class="r">Middle</th><th class="r">Upper edge</th></tr></thead>' +
        '<tbody class="num">' + tableRows + "</tbody></table></div>" : "") + "</div>" +

      '<div class="note warn" style="margin-top:16px"><strong>How to read this, and how not to</strong>' +
      '<ul class="bullets" style="margin-top:6px">' + pj.notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") +
      "</ul></div></section>";
  }

  function statTile(k, v, d, tone) {
    return '<div class="stat"><div class="stat-k">' + esc(k) + "</div>" +
      '<div class="stat-v ' + (tone || "") + '">' + esc(v) + "</div>" +
      (d ? '<div class="stat-d">' + esc(d) + "</div>" : "") + "</div>";
  }

  function exposureRows(r, tab) {
    var ex = r.metrics.exposure;
    if (tab === "currency") {
      return Object.keys(ex.currency).filter(function (c) { return ex.currency[c] > 0.004; })
        .sort(function (a, b) { return ex.currency[b] - ex.currency[a]; })
        .map(function (c) {
          return { label: c === state.profile.baseCurrency ? c + " (your spending currency)" : c, current: ex.currency[c], reference: 0 };
        });
    }
    if (tab === "style") {
      var cs = G.normaliseSleeve(ex.style, G.STYLE_BUCKETS);
      var market = { value: 0.31, blend: 0.38, growth: 0.31 };
      return G.STYLE_BUCKETS.map(function (k) { return { label: lab(k), current: cs[k], reference: market[k] }; });
    }
    var keys = tab === "region" ? G.REGIONS : tab === "sector" ? G.SECTORS : G.SIZE_BUCKETS;
    var c = G.normaliseSleeve(ex[tab], keys), ref = G.normaliseSleeve(r.reference[tab], keys);
    return keys.map(function (k) { return { label: lab(k), current: c[k] || 0, reference: ref[k] || 0 }; })
      .sort(function (a, b) { return b.current - a.current; });
  }

  var EXP_TABS = [
    ["region", "Geography", "As a share of your equity and property sleeve, so the comparison is not distorted by how much you hold in bonds."],
    ["sector", "Sector", "Sector weights drift as markets move. The reference is the global market's own sector mix."],
    ["size", "Company size", "Large, mid and small at global market weights. Mid caps are the slice most often missing."],
    ["style", "Style", "Value, blend and growth. The market splits roughly into thirds."],
    ["currency", "Currency", "What your money is actually exposed to, against the currency you will spend in."]
  ];

  function viewReport() {
    var r = report();
    if (!r.portfolio.positions.length) {
      return '<div class="card empty"><h2 class="sec-title">No holdings to analyse</h2>' +
        '<p class="sub" style="margin:8px auto 0">Add holdings, or load the example portfolio to see what the report produces.</p>' +
        '<div class="btnrow" style="justify-content:center;margin-top:18px">' +
        '<button class="btn" data-act="go" data-view="holdings">Enter your holdings</button>' +
        '<button class="btn sec" data-act="sample">Load the example</button></div></div>';
    }
    var m = r.metrics, ref = r.reference, ex = m.exposure;
    var growth = ex.assetClass.equity + ex.assetClass.realEstate + ex.assetClass.commodity;
    var refGrowth = ref.assetClass.equity + ref.assetClass.realEstate + ref.assetClass.commodity;
    var names = m.lookThrough.slice(0, 12);
    var maxName = names.length ? names[0].weight : 0.01;
    var slices = G.ASSET_CLASSES.filter(function (k) { return ex.assetClass[k] > 0.001; })
      .map(function (k) { return { label: lab(k), value: ex.assetClass[k] }; });
    // Five is about what someone can hold in their head; the rest stay available.
    var headline = r.findings.slice(0, 5), rest = r.findings.slice(5);

    return (state.isSample ? '<div class="note accent"><strong>This is an example portfolio,</strong> not yours — eight holdings and ' +
      cur(state.cash) + ' in cash, so the report has something to show. Replace it in Holdings.</div>' : "") +

      '<header><h1 style="font-size:24px">Gap report</h1>' +
      '<p class="num" style="font-size:13px;color:var(--muted);margin-top:6px">' + cur(r.portfolio.totalValue) +
      " across " + r.portfolio.positions.length + " position" + (r.portfolio.positions.length === 1 ? "" : "s") +
      " · " + esc(lab(r.profile.goal)) + " in " + r.profile.horizonYears + " years</p></header>" +

      '<div class="card"><div class="stats">' +
      statTile("Growth assets", pct(growth), "Reference " + pct(refGrowth), Math.abs(growth - refGrowth) > 0.07 ? (growth > refGrowth ? "t-over" : "t-under") : "") +
      statTile("Est. volatility", pct(m.estimatedVolatility), "Beta " + m.weightedBeta.toFixed(2) + " to a broad index") +
      statTile("Effective holdings", String(Math.round(m.diversification.effectiveNames)), m.diversification.lookThroughNameCount.toLocaleString() + " companies, unevenly weighted") +
      statTile("Largest company", pct(m.diversification.topHoldingWeight), names.length ? names[0].name : "—", m.diversification.topHoldingWeight > 0.08 ? "t-over" : "") +
      statTile("Ongoing charges", pct(m.weightedExpenseRatio, 2), cur(m.annualCost) + " a year · benchmark " + pct(ref.costBenchmark, 2), m.weightedExpenseRatio > ref.costBenchmark + 0.0008 ? "t-over" : "") +
      statTile("Distribution yield", pct(ex.yield), r.profile.incomeNeedRate > 0 ? "Against " + pct(r.profile.incomeNeedRate) + " drawn" : "No withdrawals stated") +
      statTile("Bond duration", ex.duration > 0 ? ex.duration.toFixed(1) + "y" : "—", "Reference " + ref.targetDuration.toFixed(1) + "y") +
      statTile("Findings", String(r.findings.length), "Ranked by how much of the portfolio each touches") +
      "</div></div>" +

      '<section class="card pad"><h2 class="sec-title">What the money is in</h2>' +
      '<p class="sub" style="margin-top:4px">Asset class shares of the whole portfolio, including any uninvested cash.</p>' +
      '<div style="margin-top:14px">' + stackedBar(slices) + "</div></section>" +

      "<section>" +
      '<h2 class="sec-title">' + (!headline.length ? "No material gaps found"
        : headline.length === 1 ? "The one gap worth starting with"
        : "The " + headline.length + " gaps worth starting with") + "</h2>" +
      '<p class="sub" style="margin-top:4px">' + (rest.length
        ? "Ranked by how much of the portfolio each touches. " + rest.length + " smaller finding" + (rest.length === 1 ? " sits" : "s sit") + " below."
        : "Ranked by how much of the portfolio each touches. This is an ordering, not a severity or risk score.") + "</p>" +
      (r.findings.length
        ? '<div class="stack-s" style="margin-top:14px">' + headline.map(findingCard).join("") + "</div>" +
          (rest.length
            ? '<div style="margin-top:14px"><button data-act="showrest" aria-expanded="' + !!state.showRest +
              '" style="width:100%;border:1px dashed var(--line-strong);background:none;border-radius:var(--r);padding:12px;font-size:13px;font-weight:500;color:var(--muted)">' +
              (state.showRest ? "Hide the smaller findings"
                : "Show " + rest.length + " smaller finding" + (rest.length === 1 ? "" : "s") + " — " +
                  esc(rest.slice(0, 3).map(function (f) { return f.title.split(" ").slice(0, 3).join(" "); }).join(", ")) +
                  (rest.length > 3 ? "…" : "")) +
              "</button>" +
              (state.showRest ? '<div class="stack-s" style="margin-top:12px">' + rest.map(findingCard).join("") + "</div>" : "") +
              "</div>"
            : "")
        : '<div class="note" style="margin-top:14px"><strong>Nothing crossed a materiality threshold.</strong> That means no gap was large enough to report — not that the portfolio is right for you, which is a question this tool does not answer.</div>') +
      "</section>" +

      projectionPanel(r) +

      '<section class="card pad"><h2 class="sec-title">Exposure, dimension by dimension</h2>' +
      '<p class="sub" style="margin-top:4px">The same portfolio, sliced different ways, each against the corresponding reference weight.</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:14px" role="tablist">' +
      EXP_TABS.map(function (t) {
        return '<button class="tab" role="tab" data-act="exptab" data-tab="' + t[0] + '"' +
          (state.expTab === t[0] ? ' aria-current="page"' : "") + ">" + esc(t[1]) + "</button>";
      }).join("") + "</div>" +
      '<p class="sub" style="margin-top:12px">' + esc((EXP_TABS.filter(function (t) { return t[0] === state.expTab; })[0] || EXP_TABS[0])[2]) + "</p>" +
      '<div style="margin-top:12px">' + gapTable(exposureRows(r, state.expTab), state.expTab === "size" ? 0.08 : state.expTab === "sector" ? 0.06 : 0.05) + "</div>" +
      '<p style="font-size:11.5px;color:var(--faint);margin-top:10px;display:flex;align-items:center;gap:8px">' +
      '<i style="display:inline-block;width:2px;height:12px;background:var(--ink)"></i>The tick mark is the reference weight.</p></section>' +

      '<div class="cols">' +
      '<section class="card pad"><h2 class="sec-title">Largest companies, counted through funds</h2>' +
      '<p class="sub" style="margin-top:4px">Direct holdings and fund holdings added together.</p>' +
      '<table class="data" style="margin-top:12px"><tbody>' + names.map(function (n) {
        return '<tr><td style="padding-left:0"><div style="font-weight:500">' + esc(n.name) + "</div>" +
          '<div class="sym" style="font-size:11px;color:var(--faint)">' + esc(n.symbol) + "</div></td>" +
          '<td style="width:34%"><div class="mini"><i style="width:' + ((n.weight / maxName) * 100).toFixed(1) + '%"></i></div></td>' +
          '<td class="r num" style="width:58px">' + pct(n.weight) + "</td>" +
          '<td class="r num" style="width:76px;color:var(--muted);padding-right:0">' + cur(n.value) + "</td></tr>";
      }).join("") + "</tbody></table>" +
      '<p style="font-size:11.5px;color:var(--faint);margin-top:10px">Funds publish only their largest holdings, so companies outside every fund’s disclosed list do not appear here. The concentration figures above account for that remainder; this table does not.</p></section>' +

      '<section class="card pad"><h2 class="sec-title">The reference model</h2>' +
      '<p class="sub" style="margin-top:4px">What your portfolio is compared against, and how it was derived.</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">' +
      '<span class="pill accent">' + esc(ref.label) + "</span>" +
      '<span class="pill">Growth ' + pct(ref.inputs.growthShare) + "</span>" +
      '<span class="pill">Capacity ' + Math.round(ref.inputs.riskCapacityScore * 100) + "/100</span>" +
      (ref.inputs.homeBiasAllowancePp > 0 ? '<span class="pill">Home tilt +' + ref.inputs.homeBiasAllowancePp + "pp</span>" : "") +
      "</div><ol style=\"list-style:none;padding:0;margin:14px 0 0;display:flex;flex-direction:column;gap:9px\">" +
      ref.rationale.map(function (line, i) {
        return '<li style="display:flex;gap:11px;font-size:12.5px;color:var(--muted);line-height:1.55">' +
          '<span class="num" style="color:var(--accent-ink);font-weight:500;flex:none">' + String(i + 1).padStart(2, "0") + "</span>" + esc(line) + "</li>";
      }).join("") + "</ol>" +
      '<p style="margin-top:14px"><button class="row-link" data-act="go" data-view="situation" style="color:var(--accent-ink);font-size:12.5px;font-weight:600;text-decoration:none">Change the inputs behind this model →</button></p></section>' +
      "</div>" +

      '<section class="card pad"><h2 class="sec-title">What this analysis could not see</h2>' +
      '<p class="sub" style="margin-top:4px">' + r.caveats.length + " limits that affect how the findings above should be read.</p>" +
      '<ul class="bullets" style="margin-top:12px">' + r.caveats.map(function (c) {
        return '<li style="color:var(--muted)">' + esc(c) + "</li>";
      }).join("") + "</ul></section>";
  }

  function viewHoldings() {
    var r = report();
    var rows = r.portfolio.positions.map(function (p) {
      return "<tr><td><button class=\"row-link sym\" data-act=\"detail\" data-symbol=\"" + esc(p.symbol) + '">' + esc(p.symbol) + "</button>" +
        '<div style="font-size:12px;color:var(--muted)">' + esc(p.security.name) + "</div></td>" +
        '<td><span class="pill ' + (p.security.kind === "etf" ? "accent" : "") + '">' + (p.security.kind === "etf" ? "ETF" : "Stock") + "</span></td>" +
        '<td class="r num">' + cur(p.value) + "</td>" +
        '<td class="r num" style="font-weight:500">' + pct(p.weight) + "</td>" +
        '<td class="r num" style="color:var(--muted)">' + (p.security.kind === "etf" ? pct(p.security.fund.expenseRatio, 2) : "—") + "</td>" +
        '<td class="r"><button class="row-link" data-act="remove" data-symbol="' + esc(p.symbol) + '" style="font-size:12px;color:var(--faint);text-decoration:none">Remove</button></td></tr>';
    }).join("");

    var cashRow = state.cash > 0 ? '<tr style="background:var(--surface-2)"><td><strong>Cash</strong>' +
      '<div style="font-size:12px;color:var(--muted)">Uninvested balance</div></td><td><span class="pill">Cash</span></td>' +
      '<td class="r num">' + cur(state.cash) + "</td>" +
      '<td class="r num" style="font-weight:500">' + pct(state.cash / Math.max(r.portfolio.totalValue, 1)) + "</td>" +
      '<td class="r" style="color:var(--muted)">—</td><td></td></tr>' : "";

    var unresolved = r.portfolio.unresolved.length
      ? '<div class="pad" style="border-top:1px solid var(--line)"><div class="note warn"><strong>Not included in the analysis</strong><ul class="bullets" style="margin-top:6px">' +
        r.portfolio.unresolved.map(function (u) {
          return '<li><span class="sym">' + esc(u.raw) + "</span> " + (u.reason === "unknown-symbol"
            ? "is not in the bundled security master, so it is missing from every weight."
            : "has no quantity, value or percentage, so it cannot be priced.") + "</li>";
        }).join("") + "</ul></div></div>" : "";

    return '<header><h1 style="font-size:22px">Your holdings</h1>' +
      '<p class="lede" style="margin-top:6px">Paste a list, or add positions one at a time. Everything stays in this browser.</p></header>' +

      '<div class="cols">' +
      '<section class="card pad"><h2 class="sec-title">Paste a list</h2>' +
      '<p class="sub" style="margin-top:4px">One holding per line. A bare number is read as shares, a number with a currency symbol as a value, and a number with a percent sign as a share of the portfolio.</p>' +
      '<textarea id="paste" rows="7" spellcheck="false" placeholder="VOO, 120&#10;QQQ, $26,000&#10;NVDA, 45&#10;BND, 8%" aria-label="Holdings to paste"></textarea>' +
      '<div class="btnrow" style="margin-top:10px"><button class="btn" data-act="paste" data-mode="replace">Replace holdings</button>' +
      '<button class="btn sec" data-act="paste" data-mode="add">Add to existing</button></div>' +
      (state.pasteErrors && state.pasteErrors.length
        ? '<div class="note warn" style="margin-top:12px"><strong>' + state.pasteErrors.length + " line" + (state.pasteErrors.length === 1 ? "" : "s") +
          ' could not be read</strong><ul class="bullets" style="margin-top:6px">' +
          state.pasteErrors.map(function (e) { return '<li class="sym" style="font-size:11.5px">' + esc(e) + "</li>"; }).join("") + "</ul></div>"
        : "") + "</section>" +

      '<section class="card pad"><h2 class="sec-title">Add one at a time</h2>' +
      '<p class="sub" style="margin-top:4px">Search the bundled universe by ticker or name.</p>' +
      '<div class="stack-s" style="margin-top:12px">' +
      '<label class="field"><span class="field-k">Ticker or name</span>' +
      '<input type="text" id="q" value="' + esc(state.addQuery || "") + '" data-act="addq" placeholder="VTI, Vanguard, Apple…"></label>' +
      '<label class="field"><span class="field-k">Value in ' + esc(state.profile.baseCurrency) + "</span>" +
      '<input type="text" id="amt" value="' + esc(state.addAmount || "") + '" data-act="addamt" inputmode="decimal" placeholder="10000"></label>' +
      (state.addQuery && state.addQuery.length
        ? (function () {
            var hits = G.searchSecurities(state.addQuery, 6);
            if (!hits.length) return '<p class="sub">No match in the bundled universe.</p>';
            return '<div class="card"><table class="data"><tbody>' + hits.map(function (s) {
              return '<tr><td><button class="row-link sym" data-act="add" data-symbol="' + esc(s.symbol) + '" style="text-decoration:none">' +
                esc(s.symbol) + '</button> <span style="color:var(--muted);font-size:12px">' + esc(s.name) + "</span></td>" +
                '<td class="r"><span class="pill ' + (s.kind === "etf" ? "accent" : "") + '">' + (s.kind === "etf" ? "ETF" : "Stock") + "</span></td></tr>";
            }).join("") + "</tbody></table></div>";
          })()
        : "") + "</div></section></div>" +

      '<section class="card pad"><h2 class="sec-title">Account settings</h2>' +
      '<div class="grid2" style="margin-top:12px">' +
      '<label class="field"><span class="field-k">Uninvested cash</span><span class="field-h">Sitting in the account, not invested</span>' +
      '<input type="number" id="cash" min="0" value="' + state.cash + '" data-act="cash"></label>' +
      '<label class="field"><span class="field-k">Base currency</span><span class="field-h">What you will spend the money in</span>' +
      '<select id="ccy" data-act="ccy">' + ["USD", "GBP", "EUR", "CHF", "CAD", "AUD", "JPY"].map(function (c) {
        return '<option value="' + c + '"' + (state.profile.baseCurrency === c ? " selected" : "") + ">" + c + "</option>";
      }).join("") + "</select></label></div></section>" +

      (r.portfolio.positions.length
        ? '<section class="card"><div class="pad" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)">' +
          "<div><h2 class=\"sec-title\">" + r.portfolio.positions.length + " position" + (r.portfolio.positions.length === 1 ? "" : "s") + "</h2>" +
          '<p class="num" style="font-size:12.5px;color:var(--muted);margin-top:2px">' + cur(r.portfolio.totalValue) + " total" +
          (state.cash > 0 ? ", including " + cur(state.cash) + " cash" : "") + "</p></div>" +
          '<div class="btnrow"><button class="btn" data-act="go" data-view="report">Open the gap report</button>' +
          '<button class="btn ghost" data-act="clear">Clear</button></div></div>' +
          '<div class="scroll"><table class="data"><thead><tr><th>Holding</th><th>Type</th><th class="r">Value</th><th class="r">Weight</th><th class="r">Charge</th><th></th></tr></thead>' +
          "<tbody>" + rows + cashRow + "</tbody></table></div>" + unresolved + "</section>"
        : '<div class="card empty"><h2 class="sec-title">Nothing to analyse yet</h2>' +
          '<p class="sub" style="margin:8px auto 0">Add holdings above, or load an example portfolio.</p>' +
          '<div class="btnrow" style="justify-content:center;margin-top:16px"><button class="btn sec" data-act="sample">Load the example portfolio</button></div></div>');
  }

  var TOLERANCE = {
    1: "A fall of 10% would worry me enough to want out.",
    2: "I could sit through a 15% fall, but not comfortably.",
    3: "A 25% fall would be unpleasant and I would hold on.",
    4: "A 35% fall is the cost of doing business.",
    5: "A 50% fall would not change what I do."
  };

  function viewSituation() {
    var r = report(), p = state.profile, ref = r.reference;
    var slices = G.ASSET_CLASSES.filter(function (k) { return ref.assetClass[k] > 0.001; })
      .map(function (k) { return { label: lab(k), value: ref.assetClass[k] }; });
    function sel(id, act, value, opts) {
      return '<select id="' + id + '" data-act="' + act + '">' + opts.map(function (o) {
        return '<option value="' + o + '"' + (value === o ? " selected" : "") + ">" + esc(lab(o)) + "</option>";
      }).join("") + "</select>";
    }
    function numField(id, act, k, hint, value, min, max, step) {
      return '<label class="field"><span class="field-k">' + esc(k) + "</span>" +
        (hint ? '<span class="field-h">' + esc(hint) + "</span>" : "") +
        '<input type="number" id="' + id + '" data-act="' + act + '" value="' + value + '" min="' + min + '" max="' + max + '"' +
        (step ? ' step="' + step + '"' : "") + "></label>";
    }

    var presetCards = G.PRESET_LIST.map(function (ps) {
      var on = state.presetId === ps.id;
      return '<button data-act="preset" data-preset="' + ps.id + '" aria-pressed="' + on + '" ' +
        'style="text-align:left;border-radius:var(--r);padding:16px;background:' + (on ? "var(--accent-soft)" : "var(--surface)") +
        ";border:1px solid " + (on ? "var(--accent)" : "var(--line)") + '">' +
        '<span style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +
        '<span style="font-size:14px;font-weight:600">' + esc(ps.label) + "</span>" +
        (on ? '<span class="pill accent">In use</span>' : "") + "</span>" +
        '<span style="display:block;font-size:12.5px;color:var(--muted);margin-top:6px;line-height:1.5">' + esc(ps.blurb) + "</span>" +
        '<span class="num" style="display:block;font-size:11.5px;color:var(--faint);margin-top:8px">Long-run real return ' +
        pct(ps.realReturn) + " · volatility " + pct(ps.volatility) + "</span></button>";
    }).join("");

    return '<header><h1 style="font-size:22px">Your situation</h1>' +
      '<p class="lede" style="margin-top:6px">These answers build the reference model your portfolio is compared against. They are not a suitability assessment — they are inputs to an arithmetic model whose every step is shown alongside.</p></header>' +

      '<section class="card pad"><h2 class="sec-title">The index your portfolio is compared against</h2>' +
      '<p class="sub" style="margin-top:4px">This decides what counts as a gap. Pick the one that matches how you think about your portfolio — the report rebuilds around it.</p>' +
      '<div class="grid3" style="margin-top:14px">' + presetCards + "</div>" +
      '<div class="note warn" style="margin-top:16px"><strong>What choosing ' + esc(ref.presetLabel) +
      " means for your report</strong><br>" + esc(ref.indexNote) + "</div></section>" +

      '<div class="cols">' +
      '<div class="stack">' +
      '<section class="card pad"><h2 class="sec-title">The goal and its date</h2>' +
      '<div class="grid2" style="margin-top:12px">' +
      '<label class="field"><span class="field-k">What the money is for</span>' + sel("goal", "goal", p.goal, ["retirement", "houseDeposit", "educationFund", "incomeNow", "generalGrowth"]) + "</label>" +
      numField("horizon", "horizon", "Years until you need it", "The single largest input", p.horizonYears, 1, 50) +
      '<label class="field"><span class="field-k">Where you will spend it</span>' + sel("home", "home", p.homeRegion, ["us", "uk", "europeExUk", "canada", "japan", "asiaPacificDeveloped", "emergingMarkets"]) + "</label>" +
      '<label class="field"><span class="field-k">Account type</span><span class="field-h">Affects how tax is discussed, never calculated</span>' + sel("wrap", "wrap", p.taxWrapper, ["taxAdvantaged", "taxable", "mixed"]) + "</label>" +
      "</div></section>" +

      '<section class="card pad"><h2 class="sec-title">Capacity for a bad year</h2>' +
      '<p class="sub" style="margin-top:4px">Circumstances, not feelings. These decide how much volatility the plan can absorb without breaking.</p>' +
      '<div class="grid2" style="margin-top:12px">' +
      numField("contrib", "contrib", "Monthly contribution", "New money each month", p.monthlyContribution, 0, 1000000) +
      numField("spend", "spend", "Essential monthly spending", "What you would need if you cut back", p.monthlyEssentialSpend, 0, 1000000) +
      numField("buffer", "buffer", "Emergency buffer", "Months held outside the portfolio", p.emergencyFundMonths, 0, 24) +
      numField("draw", "draw", "Annual withdrawal rate", "Percent drawn each year, 0 if none", Math.round(p.incomeNeedRate * 1000) / 10, 0, 15, "0.5") +
      "</div></section>" +

      '<section class="card pad"><h2 class="sec-title">Tolerance for a bad year</h2>' +
      '<p class="sub" style="margin-top:4px">How you would react, as opposed to what you could withstand.</p>' +
      '<input type="range" id="tol" data-act="tol" min="1" max="5" step="1" value="' + p.riskTolerance + '" aria-label="Risk tolerance 1 to 5">' +
      '<p style="font-size:13px;color:var(--muted);margin-top:8px"><strong style="color:var(--ink)">' + p.riskTolerance + " of 5.</strong> " + esc(TOLERANCE[p.riskTolerance]) + "</p>" +
      '<div style="margin-top:16px"><span class="field-k">Deliberate home-country tilt: ' + p.homeBiasAllowancePp + " points</span>" +
      '<span class="field-h">Extra weight to your own market, above its share of global market value. Zero means the reference uses global weights exactly.</span>' +
      '<input type="range" id="tilt" data-act="tilt" min="0" max="50" step="5" value="' + p.homeBiasAllowancePp + '"></div></section>' +
      "</div>" +

      '<div class="stack">' +
      '<section class="card pad"><h2 class="sec-title">The reference model these answers produce</h2>' +
      '<p class="sub" style="margin-top:4px">A comparison baseline, not a target anyone is setting for you.</p>' +
      '<div style="margin-top:14px">' + stackedBar(slices) + "</div>" +
      '<div class="grid2" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line);gap:12px">' +
      '<div><div class="stat-k">Growth assets</div><div class="stat-v">' + pct(ref.inputs.growthShare) + "</div></div>" +
      '<div><div class="stat-k">Risk capacity</div><div class="stat-v">' + Math.round(ref.inputs.riskCapacityScore * 100) + "/100</div></div>" +
      '<div><div class="stat-k">Bond duration</div><div class="stat-v">' + ref.targetDuration.toFixed(1) + "y</div></div>" +
      '<div><div class="stat-k">Cost benchmark</div><div class="stat-v">' + pct(ref.costBenchmark, 2) + "</div></div>" +
      "</div></section>" +

      '<section class="card pad"><h2 class="sec-title">How every number above was derived</h2>' +
      "<ol style=\"list-style:none;padding:0;margin:12px 0 0;display:flex;flex-direction:column;gap:9px\">" +
      ref.rationale.map(function (line, i) {
        return '<li style="display:flex;gap:11px;font-size:12.5px;color:var(--muted);line-height:1.55">' +
          '<span class="num" style="color:var(--accent-ink);font-weight:500;flex:none">' + String(i + 1).padStart(2, "0") + "</span>" + esc(line) + "</li>";
      }).join("") + "</ol></section>" +

      '<section class="card pad"><h2 class="sec-title">Set the bond allocation directly</h2>' +
      '<p class="sub" style="margin-top:4px">The glidepath above estimates this from your horizon. If you already know what split you want, set it here and it replaces the estimate.</p>' +
      '<input type="range" id="bond" data-act="bond" min="0" max="90" step="5" value="' +
      Math.round((state.bondShare == null ? ref.assetClass.bond : state.bondShare) * 100) + '" aria-label="Bond allocation">' +
      '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-top:8px">' +
      '<span class="num" style="font-size:13px;color:var(--muted)">' + pct(ref.assetClass.bond) + " bonds · " +
      pct(ref.inputs.growthShare) + " growth · " + pct(ref.assetClass.cash) + " cash</span>" +
      (state.bondShare != null ? '<button class="btn ghost" data-act="bondreset">Back to the glidepath</button>' : "") + "</div></section>" +

      '<div class="note"><strong>Why a market-anchored reference.</strong> The equity side uses global market-capitalisation weights. That is not a view about what anyone should hold — it is what all investors collectively do hold, which makes it the one benchmark that requires no forecast to justify. Differences from it are positions you have taken, deliberately or otherwise.</div>' +
      '<div class="btnrow"><button class="btn" data-act="go" data-view="report">See the gap report</button>' +
      '<button class="btn sec" data-act="go" data-view="holdings">Edit holdings</button></div>' +
      "</div></div>";
  }

  /* ---------------------------------------------------------- research */

  function viewResearch() {
    if (state.detail) return viewDetail(state.detail);
    var s = state.screen, q = s.q.trim().toLowerCase();
    var rows = G.SECURITIES.filter(function (x) {
      if (s.kind !== "all" && x.kind !== s.kind) return false;
      if (q && x.symbol.toLowerCase().indexOf(q) < 0 && x.name.toLowerCase().indexOf(q) < 0) return false;
      if (s.sector !== "all") {
        if (x.kind === "stock" && x.sector !== s.sector) return false;
        if (x.kind === "etf" && ((x.breakdown.sector || {})[s.sector] || 0) < 0.3) return false;
      }
      return true;
    });
    function yieldOf(x) { return x.kind === "etf" ? x.yield : x.fundamentals.dividendYield; }
    function sizeOf(x) { return x.kind === "etf" ? x.fund.aumUsd : x.marketCapUsd; }
    rows.sort(function (a, b) {
      if (s.sort === "name") return a.symbol.localeCompare(b.symbol);
      if (s.sort === "yield") return yieldOf(b) - yieldOf(a);
      if (s.sort === "cost") return (a.kind === "etf" ? a.fund.expenseRatio : 1) - (b.kind === "etf" ? b.fund.expenseRatio : 1);
      if (s.sort === "quality") return (b.kind === "stock" ? G.allScores(b).quality.score : -1) - (a.kind === "stock" ? G.allScores(a).quality.score : -1);
      if (s.sort === "value") return (b.kind === "stock" ? G.allScores(b).valuation.score : -1) - (a.kind === "stock" ? G.allScores(a).valuation.score : -1);
      return sizeOf(b) - sizeOf(a);
    });
    var visible = rows.slice(0, s.limit);

    return '<header><h1 style="font-size:22px">Research</h1>' +
      '<p class="lede" style="margin-top:6px">Filter the bundled universe of funds and companies. The scores are arithmetic summaries of published metrics, shown next to the inputs that produced them.</p></header>' +

      '<section class="card pad"><div class="grid4">' +
      '<label class="field"><span class="field-k">Search</span><input type="text" id="sq" data-act="sq" value="' + esc(s.q) + '" placeholder="Ticker or name"></label>' +
      '<label class="field"><span class="field-k">Instrument type</span><select id="skind" data-act="skind">' +
      [["all", "All"], ["etf", "ETFs"], ["stock", "Companies"]].map(function (o) {
        return '<option value="' + o[0] + '"' + (s.kind === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
      }).join("") + "</select></label>" +
      '<label class="field"><span class="field-k">Sector</span><select id="ssec" data-act="ssec">' +
      '<option value="all">Any</option>' + G.SECTORS.map(function (k) {
        return '<option value="' + k + '"' + (s.sector === k ? " selected" : "") + ">" + esc(lab(k)) + "</option>";
      }).join("") + "</select></label>" +
      '<label class="field"><span class="field-k">Sort by</span><select id="ssort" data-act="ssort">' +
      [["size", "Size"], ["name", "Name"], ["yield", "Yield"], ["cost", "Ongoing charge"], ["quality", "Quality score"], ["value", "Valuation score"]].map(function (o) {
        return '<option value="' + o[0] + '"' + (s.sort === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
      }).join("") + "</select></label></div></section>" +

      '<section class="card"><div style="padding:11px 16px;border-bottom:1px solid var(--line);font-size:12.5px;color:var(--muted)">' +
      "Showing " + visible.length + " of " + rows.length + " result" + (rows.length === 1 ? "" : "s") + ", from " + G.SECURITIES.length + " instruments</div>" +
      '<div class="scroll"><table class="data"><thead><tr><th>Instrument</th><th>Type</th><th class="r">Size</th><th class="r">Yield</th><th class="r">Charge</th><th class="r">Quality</th><th class="r">Valuation</th></tr></thead><tbody>' +
      visible.map(function (x) {
        return "<tr><td><button class=\"row-link sym\" data-act=\"detail\" data-symbol=\"" + esc(x.symbol) + '">' + esc(x.symbol) + "</button>" +
          '<div style="font-size:12px;color:var(--muted)">' + esc(x.name) + "</div></td>" +
          '<td><span class="pill ' + (x.kind === "etf" ? "accent" : "") + '">' + esc(x.kind === "etf" ? "ETF" : lab(x.sector)) + "</span></td>" +
          '<td class="r num" style="color:var(--muted)">' + G.formatCompactCurrency(sizeOf(x), "USD") + "</td>" +
          '<td class="r num">' + pct(yieldOf(x)) + "</td>" +
          '<td class="r num">' + (x.kind === "etf" ? pct(x.fund.expenseRatio, 2) : "—") + "</td>" +
          '<td class="r num">' + (x.kind === "stock" ? G.allScores(x).quality.score : "—") + "</td>" +
          '<td class="r num">' + (x.kind === "stock" ? G.allScores(x).valuation.score : "—") + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      (rows.length === 0 ? '<p class="empty sub">Nothing matches those filters. Widen one of them.</p>' : "") +
      (visible.length < rows.length
        ? '<div style="padding:12px;text-align:center;border-top:1px solid var(--line)"><button class="btn sec" data-act="more">Show ' +
          Math.min(30, rows.length - visible.length) + " more</button></div>" : "") +
      "</section>";
  }

  function meter(title, b) {
    return '<div><div class="meter-top"><span class="meter-k">' + esc(title) + '</span><span class="meter-v">' + b.score + "</span></div>" +
      '<div class="meter-track"><div class="meter-fill" style="width:' + b.score + '%"></div></div>' +
      '<p class="meter-note">' + esc(b.note) + "</p>" +
      '<dl style="margin:10px 0 0">' + b.components.map(function (c) {
        return '<div class="kv"><dt>' + esc(c.label) + "</dt><dd>" + esc(c.value) + "</dd></div>";
      }).join("") + "</dl></div>";
  }

  function viewDetail(symbol) {
    var x = G.lookupSecurity(symbol);
    if (!x) return '<p class="sub">Not found. <button class="row-link" data-act="back">Back to research</button></p>';
    var head = '<p style="margin-bottom:14px"><button class="row-link" data-act="back" style="font-size:12.5px;color:var(--accent-ink);text-decoration:none">← Back to research</button></p>' +
      '<header><div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">' +
      '<h1 class="sym" style="font-size:24px;font-family:var(--mono)">' + esc(x.symbol) + "</h1>" +
      '<span class="pill ' + (x.kind === "etf" ? "accent" : "") + '">' + (x.kind === "etf" ? "ETF" : "Company") + "</span>" +
      '<span class="pill">' + esc(x.listingCountry) + '</span><span class="pill">' + esc(x.currency) + "</span></div>" +
      '<p style="font-size:15px;color:var(--muted);margin-top:4px">' + esc(x.name) + "</p>" +
      '<p class="lede" style="margin-top:10px">' + esc(x.description) + "</p></header>";

    if (x.kind === "etf") {
      var ex = G.buildExposure(x);
      var regions = G.REGIONS.filter(function (k) { return ex.region[k] > 0.005; }).map(function (k) { return { label: lab(k), value: ex.region[k] }; });
      var sectors = G.SECTORS.filter(function (k) { return ex.sector[k] > 0.01; }).map(function (k) { return { label: lab(k), value: ex.sector[k] }; })
        .sort(function (a, b) { return b.value - a.value; });
      return head +
        '<div class="card"><div class="stats">' +
        statTile("Ongoing charge", pct(x.fund.expenseRatio, 2), G.formatCurrency(x.fund.expenseRatio * 10000, "USD") + " a year per $10,000") +
        statTile("Fund size", G.formatCompactCurrency(x.fund.aumUsd, "USD")) +
        statTile("Holdings", x.fund.holdingsCount.toLocaleString()) +
        statTile("Distribution yield", x.yield > 0 ? pct(x.yield) : "Accumulating") +
        statTile("Median spread", pct(x.fund.spread, 3), "Paid on every trade, in and out") +
        statTile("Tracking difference", pct(x.fund.trackingDifference, 2), "Annualised gap to the index, after costs") +
        statTile("Domicile", x.fund.domicile, lab(x.fund.distribution)) +
        statTile("Duration", x.duration > 0 ? x.duration.toFixed(1) + "y" : "—", x.duration > 0 ? "A 1pp yield rise costs about " + pct(x.duration * 0.01, 1) : "") +
        "</div></div>" +
        '<div class="cols">' +
        (regions.length ? '<section class="card pad"><h2 class="sec-title">Geography</h2><p class="sub" style="margin-top:4px">Tracks ' + esc(x.fund.indexName) + '.</p><div style="margin-top:14px">' + stackedBar(regions) + "</div></section>" : "") +
        (sectors.length ? '<section class="card pad"><h2 class="sec-title">Sector</h2><div style="margin-top:14px">' + stackedBar(sectors) + "</div></section>" : "") +
        "</div>" +
        (x.topHoldings.length
          ? '<section class="card pad"><h2 class="sec-title">Largest disclosed holdings</h2>' +
            '<p class="sub" style="margin-top:4px">The top ' + x.topHoldings.length + " of " + x.fund.holdingsCount.toLocaleString() + " positions, and " +
            pct(x.topHoldings.reduce(function (a, h) { return a + h.weight; }, 0)) + ' of the fund.</p><table class="data" style="margin-top:10px"><tbody>' +
            x.topHoldings.map(function (h) {
              var known = G.lookupSecurity(h.symbol);
              return '<tr><td style="padding-left:0">' + (known
                ? '<button class="row-link" data-act="detail" data-symbol="' + esc(h.symbol) + '" style="font-weight:500">' + esc(h.name) + "</button>"
                : '<span style="font-weight:500">' + esc(h.name) + "</span>") +
                ' <span class="sym" style="font-size:11px;color:var(--faint)">' + esc(h.symbol) + "</span></td>" +
                '<td class="r num" style="width:70px;padding-right:0">' + pct(h.weight) + "</td></tr>";
            }).join("") + "</tbody></table></section>" : "") +
        '<div class="note"><strong>What to check on any fund before the fee.</strong> Tracking difference tells you what the fund actually delivered against its index after everything. Spread is paid on each trade. Domicile and distribution policy decide the tax treatment, which in a taxable account can outweigh all of it.</div>';
    }

    var sc = G.allScores(x), f = x.fundamentals, v = x.valuation;
    function rowsList(pairs) {
      return '<dl style="margin:10px 0 0">' + pairs.map(function (p) {
        return '<div class="kv" style="padding:6px 0;border-bottom:1px solid var(--line)"><dt style="font-size:13px">' + esc(p[0]) + '</dt><dd style="font-size:13px">' + esc(p[1]) + "</dd></div>";
      }).join("") + "</dl>";
    }
    return head +
      '<div class="card"><div class="stats">' +
      statTile("Market value", G.formatCompactCurrency(x.marketCapUsd, "USD"), lab(x.size) + " · " + lab(x.style)) +
      statTile("Revenue", G.formatCompactCurrency(f.revenueUsd, "USD"), pct(f.revenueCagr3y) + " 3-year growth") +
      statTile("Operating margin", pct(f.operatingMargin)) +
      statTile("Return on capital", pct(f.returnOnInvestedCapital)) +
      statTile("Free cash flow yield", pct(v.freeCashFlowYield)) +
      statTile("P/E", v.priceEarnings > 0 ? v.priceEarnings.toFixed(1) : "n/a", "Forward " + v.forwardPriceEarnings.toFixed(1)) +
      statTile("Net debt / EBITDA", G.formatMultiple(f.netDebtToEbitda), "", f.netDebtToEbitda > 3 && x.sector !== "financials" ? "t-over" : "") +
      statTile("Dividend yield", f.dividendYield <= 0 ? "None" : f.dividendYield < 0.005 ? pct(f.dividendYield, 2) : pct(f.dividendYield),
        f.dividendYield >= 0.005 ? "Payout " + pct(f.payoutRatio, 0) + " · " + f.dividendGrowthStreakYears + "y of growth"
          : f.dividendYield > 0 ? "A token payout; too small to analyse" : "") +
      "</div></div>" +
      '<section class="card pad"><h2 class="sec-title">Composite scores</h2>' +
      '<p class="sub" style="margin-top:4px">Each score averages the components beneath it on a fixed 0-100 scale. They are not ratings, forecasts or a view on whether anything is worth owning.</p>' +
      '<div class="grid2" style="margin-top:16px;gap:22px">' +
      meter("Quality", sc.quality) + meter("Financial strength", sc.strength) +
      meter("Past growth", sc.growth) + meter("Valuation", sc.valuation) +
      (sc.dividend ? meter("Dividend durability", sc.dividend) : "") + "</div></section>" +
      '<div class="cols">' +
      '<section class="card pad"><h2 class="sec-title">Profitability and cash</h2>' + rowsList([
        ["Gross margin", pct(f.grossMargin)], ["Operating margin", pct(f.operatingMargin)],
        ["Net margin", pct(f.netMargin)], ["Free cash flow margin", pct(f.freeCashFlowMargin)],
        ["Return on invested capital", pct(f.returnOnInvestedCapital)], ["Return on equity", pct(f.returnOnEquity)]
      ]) + "</section>" +
      '<section class="card pad"><h2 class="sec-title">Balance sheet and shares</h2>' + rowsList([
        ["Net debt / EBITDA", G.formatMultiple(f.netDebtToEbitda)],
        ["Interest cover", f.interestCover > 0 ? G.formatMultiple(f.interestCover, 0) : "n/a"],
        ["Current ratio", G.formatMultiple(f.currentRatio, 2)],
        ["Share count change, 5y", pct(f.shareCountCagr5y)],
        ["Price / book", v.priceToBook > 0 ? v.priceToBook.toFixed(2) : "negative equity"],
        ["EV / EBIT", v.evToEbit.toFixed(1)]
      ]) + "</section></div>" +
      '<div class="note"><strong>Reading these numbers.</strong> Compare a company with its own sector first. Banks and insurers cannot be assessed on leverage ratios at all, since leverage is their business model. Utilities and REITs run high payout ratios and high debt by design. A negative book value usually reflects years of buybacks rather than distress.</div>';
  }

  /* ------------------------------------------------------------- learn */

  var TOPICS = ["Risk", "Diversification", "Cost", "Income", "Company analysis"];

  function viewLearn() {
    if (state.article) {
      var a = G.getArticle(state.article);
      if (!a) { state.article = null; return viewLearn(); }
      var related = G.ARTICLES.filter(function (x) { return x.topic === a.topic && x.slug !== a.slug; }).slice(0, 3);
      return '<p style="margin-bottom:14px"><button class="row-link" data-act="learnback" style="font-size:12.5px;color:var(--accent-ink);text-decoration:none">← All topics</button></p>' +
        '<article class="prose"><p class="eyebrow">' + esc(a.topic) + " · " + a.readingMinutes + " min read</p>" +
        '<h1 style="font-size:26px;margin-top:8px">' + esc(a.title) + "</h1>" +
        '<p style="font-size:15px;color:var(--muted);margin-top:10px;line-height:1.6">' + esc(a.summary) + "</p>" +
        '<div class="card pad" style="margin-top:22px"><div class="eyebrow">In short</div><ul class="bullets" style="margin-top:10px">' +
        a.keyPoints.map(function (k) { return "<li>" + esc(k) + "</li>"; }).join("") + "</ul></div>" +
        a.sections.map(function (s) {
          return "<h2>" + esc(s.heading) + "</h2>" + s.paragraphs.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
        }).join("") +
        (related.length ? '<h2 style="font-size:14px">More on ' + esc(a.topic.toLowerCase()) + "</h2>" +
          '<ul class="bullets" style="margin-top:8px">' + related.map(function (x) {
            return '<li><button class="row-link" data-act="article" data-slug="' + esc(x.slug) + '" style="color:var(--accent-ink);text-decoration:none">' + esc(x.title) + "</button></li>";
          }).join("") + "</ul>" : "") + "</article>";
    }
    return '<header><h1 style="font-size:22px">Learn</h1>' +
      '<p class="lede" style="margin-top:6px">Every finding in the gap report links to one of these. They explain what a measure captures, what it misses, and where the usual reasoning goes wrong — rather than telling you what to do about it.</p></header>' +
      TOPICS.map(function (topic) {
        var list = G.ARTICLES.filter(function (a) { return a.topic === topic; });
        if (!list.length) return "";
        return '<section><h2 class="sec-title">' + esc(topic) + "</h2>" +
          '<div class="grid3" style="margin-top:12px">' + list.map(function (a) {
            return '<button class="card pad" data-act="article" data-slug="' + esc(a.slug) + '" style="text-align:left;border-radius:var(--r)">' +
              '<h3 style="font-size:14px">' + esc(a.title) + "</h3>" +
              '<p style="font-size:12.5px;color:var(--muted);margin-top:6px;line-height:1.5">' + esc(a.summary) + "</p>" +
              '<p style="font-size:11px;color:var(--faint);margin-top:8px">' + a.readingMinutes + " min read</p></button>";
          }).join("") + "</div></section>";
      }).join("") +
      '<div class="note"><strong>A note on what is missing.</strong> These cover the concepts this tool measures. They do not cover choosing an account type, tax planning, insurance, debt repayment or whether investing is the right use of your money at all — each of which can matter more, and none of which a screening tool can reason about for you.</div>';
  }

  /* ------------------------------------------------------------ shell */

  var VIEWS = [["report", "Gap report"], ["holdings", "Holdings"], ["situation", "Your situation"], ["research", "Research"], ["learn", "Learn"]];

  function gate() {
    if (state.accepted) return "";
    return '<div class="scrim" role="dialog" aria-modal="true" aria-labelledby="gate-t"><div class="modal">' +
      '<h2 id="gate-t" style="font-size:18px">Before you start</h2>' +
      '<div class="stack-s" style="margin-top:12px;font-size:13px;color:var(--muted);line-height:1.6">' +
      '<p><strong style="color:var(--ink)">This is a research and education tool.</strong> It describes what a portfolio holds, compares it with a reference model built from figures you supply, and explains the concepts behind the differences it finds.</p>' +
      '<p>It is <strong style="color:var(--ink)">not a financial adviser</strong> and gives no personal recommendations. Nothing here is a suggestion to buy or dispose of any investment. Where it lists instruments, it is showing the results of a filter over a fund universe and the criteria used — a screening result, not a shortlist anyone has vetted for you.</p>' +
      '<p>The reference model it compares against is anchored on global market weights and on your own answers. Every input is visible and editable. A difference from it is information, not a verdict.</p>' +
      '<p class="note warn" style="color:var(--ink)">' + esc(G.DATASET_META.warning) + "</p>" +
      "<p>Your holdings and answers stay in this browser. They are not sent anywhere.</p></div>" +
      '<div class="btnrow" style="justify-content:flex-end;margin-top:18px"><button class="btn" data-act="accept">I understand</button></div>' +
      "</div></div>";
  }

  function shell(inner) {
    return '<div class="topbar"><div class="topbar-inner">' +
      '<span class="brand"><span class="brand-mark">' +
      '<svg width="13" height="13" viewBox="0 0 32 32" aria-hidden="true"><path d="M8 22V15M16 22V11M24 22V6" stroke="#fff" stroke-width="3.6" stroke-linecap="round" fill="none"/></svg>' +
      '</span><span class="brand-name">Gapline</span></span>' +
      '<nav aria-label="Main">' + VIEWS.map(function (v) {
        return '<button class="tab" data-act="go" data-view="' + v[0] + '"' + (state.view === v[0] ? ' aria-current="page"' : "") + ">" + esc(v[1]) + "</button>";
      }).join("") + "</nav>" +
      '<span class="topbar-note">Research and education — not financial advice</span>' +
      "</div></div><main><div class=\"stack\">" + inner + "</div>" +
      '<p class="foot">Gapline is a research and education tool. It is not a financial adviser, it does not provide personal recommendations, and nothing it produces is a suggestion to buy or dispose of any investment. Instrument lists are the output of a filter over a fund universe, shown with the criteria that produced them. Figures in this build are illustrative sample data, not live market data. Tax treatment depends on your own circumstances and your country’s rules. If you want advice on your particular situation, speak to someone licensed to give it.</p>' +
      "</main>" + gate();
  }

  function body() {
    if (state.view === "holdings") return viewHoldings();
    if (state.view === "situation") return viewSituation();
    if (state.view === "research") return viewResearch();
    if (state.view === "learn") return viewLearn();
    return viewReport();
  }

  function render() {
    var active = document.activeElement;
    var id = active && active.id ? active.id : null;
    var caret = null;
    try { caret = active && "selectionStart" in active ? active.selectionStart : null; } catch (e) { caret = null; }
    app.innerHTML = shell(body());
    if (id) {
      var el = document.getElementById(id);
      if (el) {
        el.focus();
        if (caret != null && el.setSelectionRange) { try { el.setSelectionRange(caret, caret); } catch (e) { /* number inputs refuse this */ } }
      }
    }
  }

  /* ------------------------------------------------------------ events */

  function setProfile(patch) { state.profile = Object.assign({}, state.profile, patch); save(); render(); }

  app.addEventListener("click", function (event) {
    var el = event.target.closest("[data-act]");
    if (!el) return;
    var act = el.getAttribute("data-act");

    if (act === "go") { state.view = el.getAttribute("data-view"); state.detail = null; state.article = null; save(); render(); }
    else if (act === "accept") { state.accepted = true; save(); render(); }
    else if (act === "toggle") { var id = el.getAttribute("data-id"); state.open[id] = !state.open[id]; render(); }
    else if (act === "exptab") { state.expTab = el.getAttribute("data-tab"); render(); }
    else if (act === "detail") { state.view = "research"; state.detail = el.getAttribute("data-symbol"); window.scrollTo(0, 0); render(); }
    else if (act === "back") { state.detail = null; render(); }
    else if (act === "article") { state.view = "learn"; state.article = el.getAttribute("data-slug"); window.scrollTo(0, 0); render(); }
    else if (act === "learnback") { state.article = null; render(); }
    else if (act === "more") { state.screen.limit += 30; render(); }
    else if (act === "sample") { state.holdings = SAMPLE.slice(); state.cash = 8000; state.isSample = true; state.view = "report"; save(); render(); }
    else if (act === "clear") { state.holdings = []; state.cash = 0; state.isSample = false; save(); render(); }
    else if (act === "remove") {
      var sym = G.normaliseSymbol(el.getAttribute("data-symbol"));
      state.holdings = state.holdings.filter(function (h) { return G.normaliseSymbol(h.symbol) !== sym; });
      state.isSample = false; save(); render();
    }
    else if (act === "add") {
      var amount = Number(String(state.addAmount || "").replace(/[^\d.]/g, ""));
      var entry = { symbol: el.getAttribute("data-symbol") };
      if (isFinite(amount) && amount > 0) entry.value = amount;
      state.holdings = state.holdings.concat([entry]);
      state.addQuery = ""; state.addAmount = ""; state.isSample = false; save(); render();
    }
    else if (act === "paste") {
      var box = document.getElementById("paste");
      var parsed = G.parseHoldings(box ? box.value : "");
      state.pasteErrors = parsed.errors;
      if (parsed.holdings.length) {
        state.holdings = el.getAttribute("data-mode") === "replace" ? parsed.holdings : state.holdings.concat(parsed.holdings);
        state.isSample = false;
      }
      save(); render();
    }
    else if (act === "ovrreset") { state.growthOverride = null; save(); render(); }
    else if (act === "preset") { state.presetId = el.getAttribute("data-preset"); save(); render(); }
    else if (act === "bondreset") { state.bondShare = null; save(); render(); }
    else if (act === "projreset") { state.projReturn = null; save(); render(); }
    else if (act === "projtable") { state.showProjTable = !state.showProjTable; render(); }
    else if (act === "showrest") { state.showRest = !state.showRest; render(); }
  });

  app.addEventListener("input", function (event) {
    var el = event.target.closest("[data-act]");
    if (!el) return;
    var act = el.getAttribute("data-act");
    var num = Number(el.value);

    if (act === "addq") { state.addQuery = el.value; render(); }
    else if (act === "addamt") { state.addAmount = el.value; }
    else if (act === "cash") { state.cash = Math.max(0, num || 0); state.isSample = false; save(); render(); }
    else if (act === "sq") { state.screen.q = el.value; state.screen.limit = 30; save(); render(); }
    else if (act === "horizon") { setProfile({ horizonYears: Math.max(1, num || 1) }); }
    else if (act === "contrib") { setProfile({ monthlyContribution: Math.max(0, num || 0) }); }
    else if (act === "spend") { setProfile({ monthlyEssentialSpend: Math.max(0, num || 0) }); }
    else if (act === "buffer") { setProfile({ emergencyFundMonths: Math.max(0, num || 0) }); }
    else if (act === "draw") { setProfile({ incomeNeedRate: Math.max(0, num || 0) / 100 }); }
    else if (act === "tol") { setProfile({ riskTolerance: num }); }
    else if (act === "tilt") { setProfile({ homeBiasAllowancePp: num }); }
    else if (act === "ovr") { state.growthOverride = num / 100; save(); render(); }
    else if (act === "bond") { state.bondShare = num / 100; save(); render(); }
    else if (act === "projret") { state.projReturn = num / 100; save(); render(); }
  });

  app.addEventListener("change", function (event) {
    var el = event.target.closest("[data-act]");
    if (!el) return;
    var act = el.getAttribute("data-act");
    if (act === "ccy") { setProfile({ baseCurrency: el.value }); }
    else if (act === "goal") { setProfile({ goal: el.value }); }
    else if (act === "home") { setProfile({ homeRegion: el.value }); }
    else if (act === "wrap") { setProfile({ taxWrapper: el.value }); }
    else if (act === "skind") { state.screen.kind = el.value; state.screen.limit = 30; save(); render(); }
    else if (act === "ssec") { state.screen.sector = el.value; state.screen.limit = 30; save(); render(); }
    else if (act === "ssort") { state.screen.sort = el.value; save(); render(); }
  });

  // The crosshair updates the two nodes it owns rather than re-rendering, so
  // moving the pointer never rebuilds the page underneath it.
  app.addEventListener("mousemove", function (event) {
    var svg = event.target.closest("#fan");
    if (!svg) return;
    var r = report(), pj = r.projection;
    var c = G.buildFanChart(pj.points, state.profile.baseCurrency, 640, 260);
    var box = svg.getBoundingClientRect();
    var x = ((event.clientX - box.left) / box.width) * c.width;
    var point = pj.points[c.pointAt(x)];
    if (!point) return;
    var hair = document.getElementById("xhair"), dot = document.getElementById("xdot"), out = document.getElementById("readout");
    var px = c.xFor(point.year);
    if (hair) { hair.setAttribute("x1", px); hair.setAttribute("x2", px); hair.setAttribute("opacity", "1"); }
    if (dot) { dot.setAttribute("cx", px); dot.setAttribute("cy", c.yFor(point.p50)); dot.setAttribute("opacity", "1"); }
    if (out) {
      out.textContent = (point.year === 0 ? "Today" : "At " + point.year + " year" + (point.year === 1 ? "" : "s")) +
        ": " + cur(point.p10) + " – " + cur(point.p90) + ", middle " + cur(point.p50);
    }
  });

  app.addEventListener("mouseout", function (event) {
    if (!event.target.closest("#fan")) return;
    var hair = document.getElementById("xhair"), dot = document.getElementById("xdot");
    if (hair) hair.setAttribute("opacity", "0");
    if (dot) dot.setAttribute("opacity", "0");
  });

  render();
})();
