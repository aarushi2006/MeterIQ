const Investigation = require("../models/Investigation");
const asyncHandler = require("../utils/asyncHandler");

const ALLOWED_STATUSES = ["OPEN", "IN PROGRESS", "RESOLVED"];
const ALLOWED_PRIORITIES = ["LOW", "MEDIUM", "HIGH"];

function actorName(req) {
  return req.user?.fullName || req.user?.email || req.user?.id || "System";
}

function makeId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${date}-${suffix}`;
}

exports.getInvestigations = asyncHandler(async (req, res) => {
  const { status = "all", region = "all", search = "" } = req.query;

  const query = {};
  if (status && status !== "all") query.status = status;
  if (region && region !== "all") query.region = region;
  if (search) {
    query.$or = [
      { id: { $regex: search, $options: "i" } },
      { meter_id: { $regex: search, $options: "i" } },
      { reason: { $regex: search, $options: "i" } },
      { assignedTo: { $regex: search, $options: "i" } },
    ];
  }

  const [investigations, counts] = await Promise.all([
    Investigation.find(query).sort({ updatedAt: -1, createdAt: -1 }).lean(),
    Investigation.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const statusCounts = { OPEN: 0, "IN PROGRESS": 0, RESOLVED: 0, total: 0 };
  for (const row of counts) {
    statusCounts[row._id] = row.count;
    statusCounts.total += row.count;
  }

  res.json({ investigations, total: investigations.length, statusCounts });
});

exports.getInvestigation = asyncHandler(async (req, res) => {
  const investigation = await Investigation.findOne({
    $or: [{ _id: req.params.id.match(/^[a-f0-9]{24}$/i) ? req.params.id : null }, { id: req.params.id }],
  }).lean();

  if (!investigation) {
    return res.status(404).json({ message: "Investigation not found" });
  }

  res.json(investigation);
});

exports.createInvestigation = asyncHandler(async (req, res) => {
  const {
    meter_id,
    reason,
    region,
    area,
    riskScore,
    riskLevel,
    priority,
    detectedDate,
    evidence,
    assignedTo,
    assignedRole,
    id,
  } = req.body || {};

  if (!meter_id || !String(meter_id).trim()) {
    return res.status(400).json({ message: "meter_id is required" });
  }
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ message: "reason is required" });
  }

  const now = new Date().toISOString();
  const requestedId = id ? String(id) : null;
  let investigationId = requestedId || makeId();

  if (requestedId && (await Investigation.exists({ id: requestedId }))) {
    return res.status(409).json({ message: `Investigation ${requestedId} already exists` });
  }

  // Extremely unlikely collision, but never return a 500 for it.
  let attempts = 0;
  while (!requestedId && (await Investigation.exists({ id: investigationId })) && attempts < 5) {
    investigationId = makeId();
    attempts += 1;
  }

  const investigation = await Investigation.create({
    id: investigationId,
    meter_id: String(meter_id),
    region: region || "Unknown",
    area,
    riskScore: Number.isFinite(Number(riskScore)) ? Number(riskScore) : undefined,
    riskLevel,
    priority: ALLOWED_PRIORITIES.includes(priority) ? priority : "MEDIUM",
    status: "OPEN",
    detectedDate: detectedDate || now,
    reason: String(reason),
    evidence,
    assignedTo,
    assignedRole,
    createdBy: actorName(req),
    notes: [],
    history: [
      {
        action: "CREATED",
        detail: `Case opened for meter ${meter_id}`,
        by: actorName(req),
        at: now,
      },
    ],
    updatedAt: now,
  });

  res.status(201).json(investigation);
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, resolution, assignedTo, assignedRole, priority } = req.body || {};

  if (status && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({
      message: `status must be one of: ${ALLOWED_STATUSES.join(", ")}`,
    });
  }
  if (priority && !ALLOWED_PRIORITIES.includes(priority)) {
    return res.status(400).json({
      message: `priority must be one of: ${ALLOWED_PRIORITIES.join(", ")}`,
    });
  }

  const investigation = await Investigation.findOne({
    $or: [{ _id: id.match(/^[a-f0-9]{24}$/i) ? id : null }, { id }],
  });

  if (!investigation) {
    return res.status(404).json({ message: "Investigation not found" });
  }

  const now = new Date().toISOString();
  const changes = [];
  if (status && status !== investigation.status) {
    changes.push(`Status ${investigation.status} → ${status}`);
    investigation.status = status;
  }
  if (resolution !== undefined && resolution !== null) {
    investigation.resolution = resolution;
    changes.push("Resolution recorded");
  }
  if (assignedTo !== undefined) {
    investigation.assignedTo = assignedTo || undefined;
    changes.push(assignedTo ? `Assigned to ${assignedTo}` : "Assignment cleared");
  }
  if (assignedRole !== undefined) investigation.assignedRole = assignedRole || undefined;
  if (priority && priority !== investigation.priority) {
    changes.push(`Priority ${investigation.priority} → ${priority}`);
    investigation.priority = priority;
  }

  investigation.updatedAt = now;
  investigation.history.push({
    action: status ? `STATUS_${status.replace(/\s+/g, "_")}` : "UPDATED",
    detail: changes.join("; ") || "Case updated",
    by: actorName(req),
    at: now,
  });

  await investigation.save();
  res.json(investigation);
});

exports.addNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { text } = req.body || {};

  if (!text || !String(text).trim()) {
    return res.status(400).json({ message: "Note text is required" });
  }

  const investigation = await Investigation.findOne({
    $or: [{ _id: id.match(/^[a-f0-9]{24}$/i) ? id : null }, { id }],
  });

  if (!investigation) {
    return res.status(404).json({ message: "Investigation not found" });
  }

  const now = new Date().toISOString();
  const author = actorName(req);
  investigation.notes.push({ author, text: String(text).trim(), time: now });
  investigation.history.push({
    action: "NOTE_ADDED",
    detail: String(text).trim().slice(0, 200),
    by: author,
    at: now,
  });
  investigation.updatedAt = now;

  await investigation.save();
  res.json(investigation);
});
