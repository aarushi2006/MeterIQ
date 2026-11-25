const mongoose = require("mongoose");
const Investigation = require("../models/Investigation");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");

const ALLOWED_STATUSES = ["OPEN", "IN PROGRESS", "SUBMITTED FOR REVIEW", "RESOLVED"];
const ANALYST_STATUSES = ["IN PROGRESS", "SUBMITTED FOR REVIEW"];
const ALLOWED_PRIORITIES = ["LOW", "MEDIUM", "HIGH"];

const actorName = (req) => req.user?.fullName || req.user?.email || req.user?.id || "System";
const isManager = (req) => ["supervisor", "admin"].includes(req.user?.role);
const makeId = () => `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

function byIdOrCaseId(id) {
  return { $or: [{ _id: mongoose.isValidObjectId(id) ? id : null }, { id }] };
}

function analystAccess(req) {
  return {
    $or: [
      { assignedUser: req.user.id },
      { assignedUser: { $exists: false }, assignedTo: req.user.fullName },
      { assignedUser: { $exists: false }, assignedTo: req.user.email },
    ],
  };
}

function accessibleQuery(req, id) {
  const identifier = byIdOrCaseId(id);
  return isManager(req) ? identifier : { $and: [identifier, analystAccess(req)] };
}

async function resolveAssignee(assignedUser) {
  if (assignedUser === undefined) return undefined;
  if (!assignedUser) return null;
  if (!mongoose.isValidObjectId(assignedUser)) {
    const error = new Error("A valid analyst must be selected.");
    error.status = 400;
    throw error;
  }
  const analyst = await User.findOne({ _id: assignedUser, role: "analyst", isActive: true })
    .select("_id fullName role")
    .lean();
  if (!analyst) {
    const error = new Error("The selected analyst is unavailable.");
    error.status = 400;
    throw error;
  }
  return analyst;
}

function buildCounts(rows) {
  const counts = { OPEN: 0, "IN PROGRESS": 0, "SUBMITTED FOR REVIEW": 0, RESOLVED: 0, total: 0 };
  rows.forEach(({ _id, count }) => { counts[_id] = count; counts.total += count; });
  return counts;
}

exports.getInvestigations = asyncHandler(async (req, res) => {
  const {
    status = "all", region = "all", priority = "all", assignedUser = "all",
    dueBefore, dueAfter, search = "", sort = "updated_desc", page = 1, pageSize = 25,
  } = req.query;
  const filters = [];
  if (!isManager(req)) filters.push(analystAccess(req));
  if (status && status !== "all") filters.push({ status });
  if (region && region !== "all") filters.push({ region });
  if (priority && priority !== "all") filters.push({ priority });
  if (isManager(req) && assignedUser && assignedUser !== "all") {
    filters.push(assignedUser === "unassigned" ? { assignedUser: { $in: [null, undefined] } } : { assignedUser });
  }
  if (dueAfter || dueBefore) {
    const dueDate = {};
    if (dueAfter) dueDate.$gte = new Date(dueAfter);
    if (dueBefore) dueDate.$lte = new Date(`${dueBefore}T23:59:59.999Z`);
    if (!Object.values(dueDate).some((value) => Number.isNaN(value.getTime()))) filters.push({ dueDate });
  }
  if (search) filters.push({ $or: [
    { id: { $regex: search, $options: "i" } }, { meter_id: { $regex: search, $options: "i" } },
    { reason: { $regex: search, $options: "i" } }, { assignedTo: { $regex: search, $options: "i" } },
  ] });
  const query = filters.length ? { $and: filters } : {};
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safePageSize = Math.min(100, Math.max(1, Number.parseInt(pageSize, 10) || 25));
  const sorts = {
    updated_desc: { updatedAt: -1, createdAt: -1 },
    due_asc: { dueDate: 1, updatedAt: -1 },
    priority_desc: { priority: -1, updatedAt: -1 },
    created_desc: { createdAt: -1 },
  };
  const [investigations, counts] = await Promise.all([
    Investigation.find(query).sort(sorts[sort] || sorts.updated_desc).skip((safePage - 1) * safePageSize).limit(safePageSize).lean(),
    Investigation.aggregate([{ $match: query }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);
  const total = counts.reduce((sum, row) => sum + row.count, 0);
  res.json({ investigations, total, page: safePage, pageSize: safePageSize, totalPages: Math.max(1, Math.ceil(total / safePageSize)), statusCounts: buildCounts(counts) });
});

exports.getInvestigation = asyncHandler(async (req, res) => {
  const investigation = await Investigation.findOne(accessibleQuery(req, req.params.id)).lean();
  if (!investigation) return res.status(404).json({ message: "Investigation not found" });
  res.json(investigation);
});

exports.getEligibleAnalysts = asyncHandler(async (_req, res) => {
  const [analysts, workload] = await Promise.all([
    User.find({ role: "analyst", isActive: true }).select("_id fullName").sort({ fullName: 1 }).lean(),
    Investigation.aggregate([
      { $match: { assignedUser: { $exists: true } } },
      { $group: { _id: { user: "$assignedUser", status: "$status" }, count: { $sum: 1 } } },
    ]),
  ]);
  const counts = new Map();
  workload.forEach((row) => {
    const key = String(row._id.user);
    const value = counts.get(key) || { assigned: 0, pending: 0, inProgress: 0, submitted: 0, completed: 0 };
    value.assigned += row.count;
    if (row._id.status === "OPEN") value.pending += row.count;
    if (row._id.status === "IN PROGRESS") value.inProgress += row.count;
    if (row._id.status === "SUBMITTED FOR REVIEW") value.submitted += row.count;
    if (row._id.status === "RESOLVED") value.completed += row.count;
    counts.set(key, value);
  });
  res.json({ analysts: analysts.map((analyst) => ({ id: analyst._id, fullName: analyst.fullName, workload: counts.get(String(analyst._id)) || { assigned: 0, pending: 0, inProgress: 0, submitted: 0, completed: 0 } })) });
});

exports.createInvestigation = asyncHandler(async (req, res) => {
  const { meter_id, reason, region, area, riskScore, riskLevel, priority, detectedDate, evidence, assignmentInstructions, dueDate, assignedUser, id } = req.body || {};
  if (!meter_id || !String(meter_id).trim()) return res.status(400).json({ message: "meter_id is required" });
  if (!reason || !String(reason).trim()) return res.status(400).json({ message: "reason is required" });
  if (dueDate && Number.isNaN(new Date(dueDate).getTime())) return res.status(400).json({ message: "dueDate must be a valid date" });
  const assignee = await resolveAssignee(assignedUser);
  const now = new Date().toISOString();
  const requestedId = id ? String(id) : null;
  let investigationId = requestedId || makeId();
  if (requestedId && await Investigation.exists({ id: requestedId })) return res.status(409).json({ message: `Investigation ${requestedId} already exists` });
  let attempts = 0;
  while (!requestedId && await Investigation.exists({ id: investigationId }) && attempts < 5) { investigationId = makeId(); attempts += 1; }
  const investigation = await Investigation.create({
    id: investigationId, meter_id: String(meter_id), region: region || "Unknown", area,
    riskScore: Number.isFinite(Number(riskScore)) ? Number(riskScore) : undefined, riskLevel,
    priority: ALLOWED_PRIORITIES.includes(priority) ? priority : "MEDIUM", status: "OPEN", detectedDate: detectedDate || now,
    reason: String(reason), evidence, assignmentInstructions, dueDate: dueDate || undefined,
    assignedUser: assignee?._id, assignedTo: assignee?.fullName, assignedRole: assignee?.role,
    createdBy: actorName(req), notes: [], history: [{ action: "CREATED", detail: `Case opened for meter ${meter_id}`, by: actorName(req), at: now }], updatedAt: now,
  });
  res.status(201).json(investigation);
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const { status, resolution, priority, assignedUser, assignmentInstructions, dueDate } = req.body || {};
  if (status && !ALLOWED_STATUSES.includes(status)) return res.status(400).json({ message: `status must be one of: ${ALLOWED_STATUSES.join(", ")}` });
  if (priority && !ALLOWED_PRIORITIES.includes(priority)) return res.status(400).json({ message: `priority must be one of: ${ALLOWED_PRIORITIES.join(", ")}` });
  if (dueDate && Number.isNaN(new Date(dueDate).getTime())) return res.status(400).json({ message: "dueDate must be a valid date" });
  const investigation = await Investigation.findOne(byIdOrCaseId(req.params.id));
  if (!investigation) return res.status(404).json({ message: "Investigation not found" });
  const assignee = await resolveAssignee(assignedUser);
  const now = new Date().toISOString(); const changes = [];
  if (status && status !== investigation.status) { changes.push(`Status ${investigation.status} → ${status}`); investigation.status = status; }
  if (resolution !== undefined && resolution !== null) { investigation.resolution = resolution; changes.push("Resolution recorded"); }
  if (priority && priority !== investigation.priority) { changes.push(`Priority ${investigation.priority} → ${priority}`); investigation.priority = priority; }
  if (assignedUser !== undefined) { investigation.assignedUser = assignee?._id; investigation.assignedTo = assignee?.fullName; investigation.assignedRole = assignee?.role; changes.push(assignee ? `Assigned to ${assignee.fullName}` : "Assignment cleared"); }
  if (assignmentInstructions !== undefined) { investigation.assignmentInstructions = assignmentInstructions || undefined; changes.push("Assignment instructions updated"); }
  if (dueDate !== undefined) { investigation.dueDate = dueDate || undefined; changes.push("Due date updated"); }
  investigation.updatedAt = now; investigation.history.push({ action: status ? `STATUS_${status.replace(/\s+/g, "_")}` : "UPDATED", detail: changes.join("; ") || "Case updated", by: actorName(req), at: now });
  await investigation.save(); res.json(investigation);
});

exports.updateAnalystProgress = asyncHandler(async (req, res) => {
  if (isManager(req)) return exports.updateStatus(req, res);
  const { status } = req.body || {};
  if (!ANALYST_STATUSES.includes(status)) return res.status(400).json({ message: `status must be one of: ${ANALYST_STATUSES.join(", ")}` });
  const investigation = await Investigation.findOne(accessibleQuery(req, req.params.id));
  if (!investigation) return res.status(404).json({ message: "Investigation not found" });
  const now = new Date().toISOString();
  if (investigation.status !== status) { investigation.history.push({ action: `STATUS_${status.replace(/\s+/g, "_")}`, detail: `Status ${investigation.status} → ${status}`, by: actorName(req), at: now }); investigation.status = status; }
  investigation.updatedAt = now; await investigation.save(); res.json(investigation);
});

exports.addNote = asyncHandler(async (req, res) => {
  const { text } = req.body || {};
  if (!text || !String(text).trim()) return res.status(400).json({ message: "Note text is required" });
  const investigation = await Investigation.findOne(accessibleQuery(req, req.params.id));
  if (!investigation) return res.status(404).json({ message: "Investigation not found" });
  const now = new Date().toISOString(); const author = actorName(req);
  investigation.notes.push({ author, text: String(text).trim(), time: now });
  investigation.history.push({ action: "NOTE_ADDED", detail: String(text).trim().slice(0, 200), by: author, at: now });
  investigation.updatedAt = now; await investigation.save(); res.json(investigation);
});
