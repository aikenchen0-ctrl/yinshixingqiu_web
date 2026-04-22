const { spawn } = require("child_process");
const path = require("path");

const KB_DIR = path.join(__dirname, "..", "..", "xueyinaAgent");
const KB_DB_PATH = path.join(KB_DIR, "kb", "data", "xueyin_kb.sqlite");
const QUERY_SCRIPT = path.join(KB_DIR, "kb", "query_kb.py");
const PYTHON_BIN = String(process.env.PYTHON_BIN || process.env.PYTHON || "python3").trim() || "python3";

/**
 * Query the local knowledge base via Python subprocess.
 * @param {object} options
 * @param {string} options.query - Search query
 * @param {number} [options.limit=8] - Max results
 * @param {string} [options.topic] - Optional topic filter
 * @param {string} [options.dateFrom] - Optional date from (YYYY-MM-DD)
 * @param {string} [options.dateTo] - Optional date to (YYYY-MM-DD)
 * @returns {Promise<Array>}
 */
function queryKB({ query, limit = 8, topic, dateFrom, dateTo }) {
  return new Promise((resolve, reject) => {
    const args = [QUERY_SCRIPT, query, "--db", KB_DB_PATH, "--limit", String(limit), "--json"];
    if (topic) args.push("--topic", topic);
    if (dateFrom) args.push("--date-from", dateFrom);
    if (dateTo) args.push("--date-to", dateTo);

    const proc = spawn(PYTHON_BIN, args, { cwd: KB_DIR, env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
    let stdout = "";
    let stderr = "";

    proc.stdout.setEncoding("utf8");
    proc.stderr.setEncoding("utf8");

    proc.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Python KB query failed (exit ${code}): ${stderr}`));
        return;
      }
      try {
        const results = JSON.parse(stdout.trim());
        resolve(results);
      } catch (err) {
        reject(new Error(`Failed to parse KB response: ${err.message}\nOutput: ${stdout}\nError: ${stderr}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

module.exports = { queryKB };
