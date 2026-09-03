const https = require("https");

const UPSTREAM = "https://timetable.sruniv.com";
let upstreamCookie = "";

function requestUpstream(req, res) {
  const target = new URL(req.url, UPSTREAM);
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const body = Buffer.concat(chunks);
    const headers = {
      Accept: "application/json, text/html",
      Cookie: upstreamCookie,
      "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
      Referer: `${UPSTREAM}/batchReport`,
      "X-CSRF-TOKEN": req.headers["x-csrf-token"] || "",
      "X-Requested-With": req.headers["x-requested-with"] || "",
    };
    if (body.length) {
      headers["Content-Type"] = req.headers["content-type"] || "application/x-www-form-urlencoded";
      headers["Content-Length"] = body.length;
    }
    const upstream = https.request(target, { method: req.method, headers }, (upstreamRes) => {
      const cookies = upstreamRes.headers["set-cookie"];
      if (cookies) {
        const cookieMap = new Map(upstreamCookie.split("; ").filter(Boolean).map((cookie) => cookie.split("=", 1)));
        cookies.forEach((cookie) => { const [name, value] = cookie.split(";", 1)[0].split("="); cookieMap.set(name, `${name}=${value}`); });
        upstreamCookie = [...cookieMap.values()].join("; ");
      }
      res.statusCode = upstreamRes.statusCode || 502;
      res.setHeader("Content-Type", upstreamRes.headers["content-type"] || "application/json");
      upstreamRes.pipe(res);
    });
    upstream.on("error", (error) => { res.statusCode = 502; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ error: error.message })); });
    upstream.end(body);
  });
}

function classroomData(res) {
  https.get("https://empty-class-rooms.vercel.app/", (upstreamRes) => {
    const chunks = [];
    upstreamRes.on("data", (chunk) => chunks.push(chunk));
    upstreamRes.on("end", () => {
      const match = Buffer.concat(chunks).toString("utf8").match(/const OCCUPANCY=(\{[\s\S]*?\});\s*const DAYS/);
      if (!match) { res.statusCode = 502; res.end(JSON.stringify({ error: "Classroom data was not found" })); return; }
      res.setHeader("Content-Type", "application/json");
      res.end(match[1]);
    });
  }).on("error", (error) => { res.statusCode = 502; res.end(JSON.stringify({ error: error.message })); });
}

module.exports = (req, res) => {
  if (req.url === "/classroom-data") { classroomData(res); return; }
  requestUpstream(req, res);
};
