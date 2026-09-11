/**
 * Trading Journal — Google Sheets storage backend (temporary).
 *
 * Deploy this as a Web App bound to the spreadsheet:
 *   Extensions ▸ Apps Script ▸ paste this file ▸ Deploy ▸ New deployment ▸
 *   Type "Web app" ▸ Execute as: Me ▸ Who has access: Anyone ▸ Deploy.
 * Copy the /exec URL into the app's .env.local as VITE_SHEETS_WEBAPP_URL.
 *
 * GET  ?                       -> { strategies, journal, analyses, plans }
 * GET  ?action=quote&symbols=BBCA.JK,BBRI.JK
 *                               -> [{ symbol, price, dayLow, dayHigh, time, currency }]
 *                                  (delayed IDX/stock quotes via Yahoo, server-side — no CORS)
 * POST { action:'writeAll', db:{...} }  -> rewrites every tab, returns { ok:true }
 *
 * Tabs are created on demand. Row 1 is a human-readable header; arrays are stored
 * as "a | b | c". Screenshots (data: URLs) are NOT synced — the app keeps those
 * in the browser only.
 */

var SPREADSHEET_ID = '1r5Abt0hskodM-pUQjLwQmwEIv4-yQBUIiCmoEjRIWVw';
var MAX_CELL = 45000;

// key order = column order; type drives parsing on read-back
var SCHEMAS = {
  strategies: [
    ['id', 's'], ['name', 's'], ['description', 's'], ['target_sample_size', 'n'],
    ['status', 's'], ['entry_rules', 'arr'], ['created_at', 's'], ['updated_at', 's'],
  ],
  journal: [
    ['id', 's'], ['asset_type', 's'], ['pair', 's'], ['strategy_id', 'sn'],
    ['followed_plan', 'b'], ['size_amount', 'n'], ['size_currency', 's'],
    ['entry_price', 'n'], ['take_profit', 'n'], ['stop_loss', 'n'], ['direction', 's'],
    ['exit_price', 'nn'], ['realized_pnl', 'nn'], ['realized_rr', 'nn'], ['status', 's'],
    ['outcome', 'sn'], ['mode', 's'], ['rule_checks', 'kv'], ['psychology', 's'], ['reasoning', 's'], ['analyzed_by_ai', 'b'],
    ['analyzed_at', 'sn'], ['closed_at', 'sn'], ['created_at', 's'], ['entry_at', 's'],
    ['planned_entry', 'nn'], ['setup_tags', 'arr'], ['market_condition', 'sn'],
    ['confidence', 'nn'], ['risk_pct', 'nn'], ['screenshot_ref', 'sn'], ['mistakes', 'arr'],
  ],
  analyses: [
    ['id', 's'], ['pair', 's'], ['asset_type', 's'], ['bias', 's'], ['support', 'nn'],
    ['resistance', 'nn'], ['target_price', 'n'], ['invalidation_price', 'n'],
    ['technique_tags', 'arr'], ['notes', 's'], ['status', 's'], ['resolved_at', 'sn'],
    ['analyzed_by_ai', 'b'], ['created_at', 's'],
  ],
  plans: [
    ['id', 's'], ['plan_date', 's'], ['bias', 's'], ['key_levels', 'narr'],
    ['allowed_setups', 'arr'], ['max_trades', 'n'], ['max_daily_loss_r', 'n'],
    ['no_trade_rules', 'arr'], ['notes', 's'], ['created_at', 's'],
  ],
};

function ss_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function sheet_(name) {
  var ss = ss_();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.action === 'quote') {
      var symbols = String(e.parameter.symbols || '')
        .split(',')
        .map(function (s) { return s.trim(); })
        .filter(String);
      return json_(yahooQuotes_(symbols));
    }
    var out = {};
    Object.keys(SCHEMAS).forEach(function (name) {
      out[name] = readTab_(name);
    });
    return json_(out);
  } catch (err) {
    return json_({ error: String(err) });
  }
}

/** Delayed quotes from Yahoo's chart endpoint (server-side fetch, no CORS). */
function yahooQuotes_(symbols) {
  var out = [];
  symbols.forEach(function (sym) {
    try {
      var url =
        'https://query1.finance.yahoo.com/v8/finance/chart/' +
        encodeURIComponent(sym) +
        '?interval=1d&range=1d';
      var res = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      var m = JSON.parse(res.getContentText()).chart.result[0].meta;
      var price = Number(m.regularMarketPrice);
      out.push({
        symbol: sym.replace(/\.[A-Z]+$/i, ''),
        price: price,
        dayLow: m.regularMarketDayLow != null ? Number(m.regularMarketDayLow) : price,
        dayHigh: m.regularMarketDayHigh != null ? Number(m.regularMarketDayHigh) : price,
        time: (Number(m.regularMarketTime) || 0) * 1000,
        currency: m.currency || 'IDR',
      });
    } catch (err) {
      out.push({ symbol: String(sym).replace(/\.[A-Z]+$/i, ''), error: String(err) });
    }
  });
  return out;
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action !== 'writeAll' || !body.db) return json_({ error: 'bad request' });
    Object.keys(SCHEMAS).forEach(function (name) {
      writeTab_(name, body.db[name] || []);
    });
    return json_({ ok: true, at: new Date().toISOString() });
  } catch (err) {
    return json_({ error: String(err) });
  }
}

function readTab_(name) {
  var schema = SCHEMAS[name];
  var sh = sheet_(name);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var header = values[0].map(function (h) { return String(h).trim(); });
  var idx = {};
  schema.forEach(function (col) { idx[col[0]] = header.indexOf(col[0]); });
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var raw = values[r];
    if (raw.join('') === '') continue;
    var obj = {};
    schema.forEach(function (col) {
      var i = idx[col[0]];
      obj[col[0]] = parseCell_(i === -1 ? '' : raw[i], col[1]);
    });
    rows.push(obj);
  }
  return rows;
}

function writeTab_(name, records) {
  var schema = SCHEMAS[name];
  var sh = sheet_(name);
  sh.clearContents();
  var header = schema.map(function (c) { return c[0]; });
  var out = [header];
  (records || []).forEach(function (rec) {
    out.push(schema.map(function (c) { return serializeCell_(rec[c[0]], c[1]); }));
  });
  sh.getRange(1, 1, out.length, header.length).setValues(out);
}

function parseCell_(v, type) {
  var s = v === null || v === undefined ? '' : String(v).trim();
  switch (type) {
    case 'n': return s === '' ? 0 : Number(s);
    case 'nn': return s === '' ? null : Number(s);
    case 'b': return v === true || s.toLowerCase() === 'true';
    case 'sn': return s === '' ? null : s;
    case 'arr': return s === '' ? [] : s.split('|').map(function (x) { return x.trim(); }).filter(String);
    case 'narr': return s === '' ? [] : s.split('|').map(function (x) { return Number(x.trim()); }).filter(function (n) { return !isNaN(n); });
    case 'kv': return s === '' ? [] : s.split(';').map(function (part) {
      var i = part.lastIndexOf('::');
      if (i < 0) return null;
      return { rule: part.slice(0, i).trim(), checked: part.slice(i + 2).trim() === '1' };
    }).filter(function (x) { return x && x.rule; });
    default: return s;
  }
}

function serializeCell_(v, type) {
  if (type === 'arr') return (v || []).join(' | ');
  if (type === 'narr') return (v || []).join(' | ');
  if (type === 'kv') return (v || []).map(function (rc) {
    return String(rc.rule).replace(/[;|]/g, ' ') + '::' + (rc.checked ? 1 : 0);
  }).join(' ; ');
  if (type === 'b') return v === true;
  if (v === null || v === undefined) return '';
  var s = String(v);
  return s.length > MAX_CELL ? s.slice(0, MAX_CELL) : s;
}
