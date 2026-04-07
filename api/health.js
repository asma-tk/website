const handler = (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  return res.status(200).json({
    ok: true,
    service: "ma9onnova-site",
    now: new Date().toISOString(),
  });
};

module.exports = handler;
module.exports.default = handler;
