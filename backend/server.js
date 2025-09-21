const express = require("express");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");
const cors = require("cors");
const app = express();
const PORT = 3000;
const filePath = "annexes"; // folder containing the CSV files

// CORS config for Angular dev server
const corsOptions = {
  origin: "http://localhost:4200",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
};

// --- error helpers ---
const EC = {
  AP_FILE_NOT_FOUND: 'AP_FILE_NOT_FOUND',
  AP_VALIDATION_ERROR: 'AP_VALIDATION_ERROR',
  AP_NODE_ID_MISSING: 'AP_NODE_ID_MISSING',
  AP_DUPLICATE_NODE_ID: 'AP_DUPLICATE_NODE_ID',
  AP_INVALID_START_DATE: 'AP_INVALID_START_DATE',
  AP_INVALID_END_DATE: 'AP_INVALID_END_DATE',
  AP_EMPTY: 'AP_EMPTY',

  AM_FILE_NOT_FOUND: 'AM_FILE_NOT_FOUND',
  AM_INVALID_CELL_VALUE: 'AM_INVALID_CELL_VALUE',
  AM_EMPTY: 'AM_EMPTY',

  PM_FILES_MISSING: 'PM_FILES_MISSING',
  PM_NO_ACTIVITIES: 'PM_NO_ACTIVITIES',
  PM_NO_ADJ_ROWS: 'PM_NO_ADJ_ROWS',
  PM_VALIDATION_ERROR: 'PM_VALIDATION_ERROR',
};

// Standardized error response

function sendError(res, httpStatus, code, message, details = []) {
  return res.status(httpStatus).json({
    status: 'error',
    code,
    message,
    details, // array of { code, message, meta? }
  });
}

// Push helper for collecting detailed issues

function push(details, code, message, meta) {
  details.push(meta ? { code, message, meta } : { code, message });
}

// Normalize & validate dates

function pad(n) {
  return String(n).padStart(2, "0");
}

function isValidDateParts(year, month, day) {
  year = Number(year);
  month = Number(month);
  day = Number(day);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  )
    return false;
  if (month < 1 || month > 12) return false;
  // JS trick: new Date(year, month, 0) returns last day of `month`
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return false;
  return true;
}

/**
 * Accepts:
 *  - "yyyy-mm-dd"  (e.g. 2012-09-03)
 *  - "d/m/yyyy" or "dd/mm/yyyy" (e.g. 3/9/2012 or 03/09/2012)
 * Returns normalized "yyyy-mm-dd" string, or null if invalid.
 */
function parseAndNormalizeDate(dateStr) {
  if (!dateStr) return null;

  // ISO: yyyy-mm-dd
  const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    if (!isValidDateParts(y, m, d)) return null;
    return `${y}-${pad(m)}-${pad(d)}`;
  }

  // d/m/yyyy or dd/mm/yyyy
  const dmyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    if (!isValidDateParts(y, m, d)) return null;
    return `${y}-${pad(m)}-${pad(d)}`;
  }

  return null; // unsupported format
}

// 1. Activity Properties

app.get("/api/activity_properties", cors(corsOptions), (req, res) => {
  const results = [];
  const details = [];
  const seen = new Set();

  const ap_filepath = path.join(filePath, "activity-properties.csv");
  if (!fs.existsSync(ap_filepath)) {
    return sendError(res, 404, EC.AP_FILE_NOT_FOUND, "activity-properties.csv not found");
  }

  // normalize headers: lower_snake_case
  const csvOptions = {
    mapHeaders: ({ header }) =>
      String(header || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_"),
  };

  fs.createReadStream(ap_filepath)
    .pipe(csv(csvOptions))
    .on("data", (row) => {
      const nodeId = (row.nodeid ?? row.node_id ?? row["node_id"] ?? "").trim();
      const rawStart = row.startdate ?? row.start_date ?? row["start_date"];
      const rawEnd   = row.enddate   ?? row.end_date   ?? row["end_date"];

      const startIso = parseAndNormalizeDate(rawStart);
      const endIso   = parseAndNormalizeDate(rawEnd);

      if (!nodeId) push(details, EC.AP_NODE_ID_MISSING, "Node ID is empty");
      if (seen.has(nodeId)) push(details, EC.AP_DUPLICATE_NODE_ID, `Duplicate Node ID: ${nodeId}`, { nodeId });
      seen.add(nodeId);

      if (!startIso) push(details, EC.AP_INVALID_START_DATE, `Invalid startDate: ${rawStart}`, { nodeId, value: rawStart });
      if (!endIso)   push(details, EC.AP_INVALID_END_DATE,   `Invalid endDate: ${rawEnd}`,     { nodeId, value: rawEnd });

      results.push({ nodeId, startDate: startIso, endDate: endIso });
    })
    .on("end", () => {
      if (results.length === 0) {
        return sendError(res, 422, EC.AP_EMPTY, "activity-properties.csv is empty");
      }
      if (details.length) {
        return sendError(res, 422, EC.AP_VALIDATION_ERROR, "Activity properties validation failed", details);
      }
      res.json({ valid: true, errors: [], data: results });
    });
});

// 2. Adjacency Matrix

app.get("/api/adjacency_matrix", cors(corsOptions), (req, res) => {
  const matrix = [];
  const details = [];

  const am_filepath = path.join(filePath, "adjacency-matrix.csv");
  if (!fs.existsSync(am_filepath)) {
    return sendError(res, 404, EC.AM_FILE_NOT_FOUND, "adjacency-matrix.csv not found");
  }

  let rowIndex = -1;
  fs.createReadStream(am_filepath)
    .pipe(csv({ headers: false }))
    .on("data", (row) => {
      rowIndex++;
      const values = Object.values(row).map((v) => String(v).trim());
      const rowNums = values.map((v, colIndex) => {
        if (v !== "0" && v !== "1") {
          push(details, EC.AM_INVALID_CELL_VALUE, `Invalid value "${v}" at [row ${rowIndex}, col ${colIndex}]`, {
            row: rowIndex, col: colIndex, value: v
          });
        }
        return Number(v);
      });
      matrix.push(rowNums);
    })
    .on("end", () => {
      if (matrix.length === 0) {
        return sendError(res, 422, EC.AM_EMPTY, "adjacency-matrix.csv is empty");
      }
      if (details.length) {
        return sendError(res, 422, EC.AM_INVALID_CELL_VALUE, "Adjacency matrix has invalid cells", details);
      }
      res.json({ valid: true, errors: [], matrix });
    });
});

// 3. PM Combined (links between activities)
app.get("/api/pm_combined", cors(corsOptions), (req, res) => {
  const activities = [];
  const details = [];

  const ap_filepath = path.join(filePath, "activity-properties.csv");
  const am_filepath = path.join(filePath, "adjacency-matrix.csv");

  // check that both files exist up-front
  const missing = [];
  if (!fs.existsSync(ap_filepath)) missing.push({ code: EC.AP_FILE_NOT_FOUND, message: "activity-properties.csv not found" });
  if (!fs.existsSync(am_filepath)) missing.push({ code: EC.AM_FILE_NOT_FOUND, message: "adjacency-matrix.csv not found" });
  if (missing.length) {
    return sendError(res, 404, EC.PM_FILES_MISSING, "Required CSV file(s) missing", missing);
  }

  // 1) parse activities
  const seenIds = new Set();
  fs.createReadStream(ap_filepath)
    .pipe(csv({
      mapHeaders: ({ header }) =>
        String(header || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_")
    }))
    .on("data", (row) => {
      const nodeId = String(row.nodeid ?? row.node_id ?? row.id ?? row.activity_id ?? "").trim();
      const startIso = parseAndNormalizeDate(row.startdate ?? row.start_date ?? row.start);
      const endIso   = parseAndNormalizeDate(row.enddate   ?? row.end_date   ?? row.end);

      if (!nodeId) push(details, EC.AP_NODE_ID_MISSING, "Node ID missing");
      if (seenIds.has(nodeId)) push(details, EC.AP_DUPLICATE_NODE_ID, `Duplicate Node ID: ${nodeId}`, { nodeId });
      seenIds.add(nodeId);

      if (!startIso) push(details, EC.AP_INVALID_START_DATE, `Invalid startDate for node ${nodeId}`, { nodeId });
      if (!endIso)   push(details, EC.AP_INVALID_END_DATE,   `Invalid endDate for node ${nodeId}`,   { nodeId });

      activities.push({ nodeId, startDate: startIso, endDate: endIso });
    })
    .on("end", () => {
      if (!activities.length) {
        return sendError(res, 422, EC.PM_NO_ACTIVITIES, "No activities parsed from activity-properties.csv");
      }

      // 2) parse adjacency matrix rows
      const rows = [];
      fs.createReadStream(am_filepath)
        .pipe(csv({ headers: false }))
        .on("data", (row) => rows.push(Object.values(row).map((v) => String(v).trim())))
        .on("end", () => {
          if (!rows.length) {
            return sendError(res, 422, EC.PM_NO_ADJ_ROWS, "No rows parsed from adjacency-matrix.csv");
          }

          // 3) build links from adjacency
          const grid = rows;
          const actById = new Map(activities.map((a) => [Number(a.nodeId), a]));

          const DAY_MS = 86400000;
          const links = [];
          for (let r = 0; r < grid.length; r++) {
            const rowVals = grid[r] || [];
            for (let c = 0; c < rowVals.length; c++) {
              const v = rowVals[c];
              if (v === "1" || v === 1) {
                const fromId = r + 1;
                const toId = c + 1;

                const from = actById.get(fromId);
                const to = actById.get(toId);
                if (!from || !to) continue; // skip if missing activity

                // Use earliest of from-dates and latest of to-dates to compute rough gap
                const fromTimes = [from.startDate, from.endDate].map((d) => new Date(d).getTime()).filter(Number.isFinite);
                const toTimes   = [to.startDate,   to.endDate  ].map((d) => new Date(d).getTime()).filter(Number.isFinite);
                if (!fromTimes.length || !toTimes.length) continue;

                const earliestFrom = Math.min(...fromTimes);
                const latestTo = Math.max(...toTimes);
                const gapDays = Math.round((latestTo - earliestFrom) / DAY_MS);

                links.push({ from, to, gapDays });
              }
            }
          }

          if (details.length) {
            return sendError(res, 422, EC.PM_VALIDATION_ERROR, "Validation issues found while building links", details);
          }

          return res.json({ links, diag: [], warnings: [] });
        });
    });
});

// --- server bootstrap ---
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
