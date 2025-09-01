"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op, fn, col } = model.Sequelize;
const moment = require("moment");


const updateResumeFields = async (req, res) => {
  try {
    const record = await model.CoSheet.findByPk(req.params.id);
    if (!record) return ReE(res, "CoSheet record not found", 404);

    const resumeFields = [
      "followUpBy",
      "followUpDate",
      "followUpResponse",
      "resumeDate",
      "resumeCount",
      "expectedResponseDate",
      "userId"
    ];

    const allowedFollowUpResponses = [
      "resumes received",
      "sending in 1-2 days",
      "delayed",
      "no response",
      "unprofessional",
    ];

    const updates = {};

    for (let f of resumeFields) {
      if (req.body[f] !== undefined) {
        if (f === "followUpResponse") {
          const val = req.body[f]?.toLowerCase();
          if (val && !allowedFollowUpResponses.includes(val)) {
            return ReE(
              res,
              "Invalid followUpResponse. Allowed: resumes received, sending in 1-2 days, delayed, no response, unprofessional",
              400
            );
          }
          updates[f] = val || null;
        } else {
          updates[f] = req.body[f];
        }
      }
    }

    if (!Object.keys(updates).length) {
      return ReE(res, "No resume fields to update", 400);
    }

    await record.update(updates);
    return ReS(res, { success: true, data: record }, 200);

  } catch (error) {
    console.error("CoSheet Resume Update Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.updateResumeFields = updateResumeFields;

const getResumeAnalysis = async (req, res) => {
  try {
    const userId = req.query.userId || req.params.userId;
    if (!userId) return ReE(res, "userId is required", 400);

    const { fromDate, toDate } = req.query;

    const where = { userId };
    let targetWhere = { userId };

    if (fromDate || toDate) {
      // --- filter by given range
      where.resumeDate = {};
      if (fromDate) where.resumeDate[Op.gte] = new Date(fromDate);
      if (toDate) where.resumeDate[Op.lte] = new Date(toDate);

      targetWhere.targetDate = {};
      if (fromDate) targetWhere.targetDate[Op.gte] = new Date(fromDate);
      if (toDate) targetWhere.targetDate[Op.lte] = new Date(toDate);
    } else {
      // --- default: today's data
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      where.resumeDate = { [Op.between]: [startOfDay, endOfDay] };
      targetWhere.targetDate = { [Op.between]: [startOfDay, endOfDay] };
    }

    const categories = [
      "resumes received",
      "sending in 1-2 days",
      "delayed",
      "no response",
      "unprofessional",
    ];

    // --- Fetch CoSheet data ---
    const data = await model.CoSheet.findAll({
      where,
      attributes: [
        "userId",
        "followUpBy",
        "followUpResponse",
        [fn("SUM", col("resumeCount")), "totalResumes"],
      ],
      group: ["userId", "followUpBy", "followUpResponse"],
      raw: true,
    });

    // --- Fetch Targets ---
    const targets = await model.MyTarget.findAll({
      where: targetWhere,
      attributes: ["targetDate", "followUps", "resumetarget"],
      raw: true,
    });

    const totalFollowUpTarget = targets.reduce(
      (sum, t) => sum + (t.followUps || 0),
      0
    );
    const totalResumeTarget = targets.reduce(
      (sum, t) => sum + (t.resumetarget || 0),
      0
    );

    // --- Aggregate results ---
    let totalAchievedFollowUps = 0; // count of follow-ups (rows where followUpBy != null)
    let totalAchievedResumes = 0; // sum of resumes

    const breakdown = {};
    categories.forEach((c) => (breakdown[c] = 0));

    let followUpBy = null;

    data.forEach((d) => {
      // count follow-ups
      if (d.followUpBy) {
        totalAchievedFollowUps += 1; // each followUpBy row = 1 follow-up
        followUpBy = d.followUpBy;
      }

      // count resumes
      const responseKey = d.followUpResponse?.toLowerCase();
      if (responseKey && categories.includes(responseKey)) {
        breakdown[responseKey] += Number(d.totalResumes || 0);
        totalAchievedResumes += Number(d.totalResumes || 0);
      }
    });

    const analysis = [
      {
        userId,
        followUpBy,
        achievedResumes: totalAchievedResumes,
        achievedFollowUps: totalAchievedFollowUps,
        breakdown,
      },
    ];

    const followUpEfficiency = totalFollowUpTarget
      ? ((totalAchievedFollowUps / totalFollowUpTarget) * 100).toFixed(2)
      : 0;
    const resumeEfficiency = totalResumeTarget
      ? ((totalAchievedResumes / totalResumeTarget) * 100).toFixed(2)
      : 0;

    return ReS(res, {
      success: true,
      analysis,
      totals: {
        totalFollowUpTarget,
        totalAchievedFollowUps,
        followUpEfficiency: Number(followUpEfficiency),
        totalResumeTarget,
        totalAchievedResumes,
        resumeEfficiency: Number(resumeEfficiency),
        breakdownTotals: breakdown,
      },
    });
  } catch (error) {
    console.error("Resume Analysis Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getResumeAnalysis = getResumeAnalysis;


// 🔹 Total Resume Analysis Endpoint (daily/monthly) with followUpBy
const gettotalResumeAnalysis = async (req, res) => {
  try {
    const { userId } = req.params;
    const { fromDate, toDate, period = "daily" } = req.query;
    if (!userId) return ReE(res, "userId is required", 400);

    const now = new Date();
    const startDate = fromDate
      ? new Date(fromDate)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = toDate
      ? new Date(toDate)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const where = {
      userId,
      resumeDate: { [Op.between]: [startDate, endDate] },
    };

    const categories = ["resumes received", "sending in 1-2 days", "delayed", "no response", "unprofessional"];

    // Fetch aggregated data
    const data = await model.CoSheet.findAll({
      where,
      attributes: [
        [fn("DATE", col("resumeDate")), "resumeDay"],
        "followUpBy",
        "followUpResponse",
        [fn("SUM", col("resumeCount")), "resumeCount"]
      ],
      group: [fn("DATE", col("resumeDate")), "followUpBy", "followUpResponse"],
      order: [[fn("DATE", col("resumeDate")), "ASC"]],
      raw: true,
    });

    // Determine periods
    let periods = [];
    if (period === "daily") {
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        periods.push(new Date(d).toISOString().slice(0, 10));
      }
    } else { // monthly
      const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      for (let m = new Date(startMonth); m <= endMonth; m.setMonth(m.getMonth() + 1)) {
        periods.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
      }
    }

    // Initialize breakdown
    const breakdown = periods.map(p => {
      let obj = { period: p, totalResumes: 0, followUpBy: null };
      categories.forEach(c => obj[c.replace(/\s/g, "_")] = 0);
      return obj;
    });

    // Fill breakdown
    data.forEach(d => {
      const periodKey = period === "daily" ? d.resumeDay : d.resumeDay.slice(0, 7);
      const index = breakdown.findIndex(b => b.period === periodKey);
      if (index !== -1) {
        const catKey = d.followUpResponse?.replace(/\s/g, "_");
        if (catKey) breakdown[index][catKey] += Number(d.resumeCount);
        breakdown[index].totalResumes += Number(d.resumeCount);
        if (d.followUpBy) breakdown[index].followUpBy = d.followUpBy;
      }
    });

    // Calculate totals
    const total = { totalResumes: 0 };
    categories.forEach(c => total[c.replace(/\s/g, "_")] = 0);
    breakdown.forEach(b => {
      total.totalResumes += b.totalResumes;
      categories.forEach(c => total[c.replace(/\s/g, "_")] += b[c.replace(/\s/g, "_")]);
    });

    return ReS(res, { success: true, breakdown, total }, 200);

  } catch (error) {
    console.error("Resume Daily/Monthly Analysis Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.gettotalResumeAnalysis = gettotalResumeAnalysis;

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const getResumeAnalysisPerCoSheet = async (req, res) => {
  try {
    const { userId } = req.params;
    const { fromDate, toDate } = req.query;

    const now = new Date();

    // --- Default = today only ---
    const startDate = fromDate
      ? new Date(fromDate)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endDate = toDate
      ? new Date(toDate)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // --- Build all days in range ---
    let periods = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      periods.push(formatLocalDate(new Date(d)));
    }

    // --- Build CoSheet query ---
    const whereClause = {
      resumeDate: { [Op.between]: [startDate, endDate] },
    };
    if (userId) whereClause.userId = userId;

    const data = await model.CoSheet.findAll({
      where: whereClause,
      attributes: [
        [fn("DATE", col("resumeDate")), "resumeDay"],
        [fn("SUM", col("resumeCount")), "resumeCount"],
      ],
      group: ["resumeDay"],
      raw: true,
    });

    const resumeMap = {};
    data.forEach((d) => {
      const key = formatLocalDate(new Date(d.resumeDay));
      resumeMap[key] = Number(d.resumeCount);
    });

    // --- Fetch Targets ---
    const targetWhere = {
      targetDate: { [Op.between]: [startDate, endDate] },
    };
    if (userId) targetWhere.userId = userId;

    const targets = await model.MyTarget.findAll({
      where: targetWhere,
      attributes: ["targetDate", "resumetarget"],
      raw: true,
    });

    const targetMap = {};
    targets.forEach((t) => {
      const key = formatLocalDate(new Date(t.targetDate));
      targetMap[key] = t.resumetarget;
    });

    // --- Build Final Result ---
    const result = periods.map((p) => {
      const totalResumes = resumeMap[p] || 0;
      const totalTarget = targetMap[p] || 0;
      const efficiency = totalTarget
        ? ((totalResumes / totalTarget) * 100).toFixed(2)
        : 0;

      return {
        period: p,
        resumes_recieved: totalResumes,
        resumetarget: totalTarget,
        efficiency: Number(efficiency),
      };
    });

    return ReS(res, { success: true, analysis: result }, 200);
  } catch (error) {
    console.error("Resume Analysis Per CoSheet Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getResumeAnalysisPerCoSheet = getResumeAnalysisPerCoSheet;

// 🔹 Endpoint: Get Resume Totals Per FollowUpBy (global, all users)
const getFollowUpResumeTotals = async (req, res) => {
  try {
    const { fromDate, toDate, period = "daily" } = req.query;

    const now = new Date();
    const startDate = fromDate
      ? new Date(fromDate)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = toDate
      ? new Date(toDate)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const where = {
      resumeDate: { [Op.between]: [startDate, endDate] },
    };

    // Fetch resumes grouped by followUpBy and period
    const data = await model.CoSheet.findAll({
      where,
      attributes: [
        "followUpBy",
        [fn("DATE", col("resumeDate")), "resumeDay"],
        [fn("SUM", col("resumeCount")), "resumeCount"],
      ],
      group: ["followUpBy", fn("DATE", col("resumeDate"))],
      order: [[fn("DATE", col("resumeDate")), "ASC"]],
      raw: true,
    });

    if (!data.length) return ReS(res, { success: true, analysis: [] }, 200);

    // 🔹 Build breakdown per followUpBy
    const grouped = {};
    data.forEach((d) => {
      const followUp = d.followUpBy || "Unknown";
      const periodKey = period === "daily" ? d.resumeDay : d.resumeDay.slice(0, 7);

      if (!grouped[followUp]) {
        grouped[followUp] = { followUpBy: followUp, breakdown: {}, totalResumes: 0 };
      }
      if (!grouped[followUp].breakdown[periodKey]) {
        grouped[followUp].breakdown[periodKey] = 0;
      }

      grouped[followUp].breakdown[periodKey] += Number(d.resumeCount);
      grouped[followUp].totalResumes += Number(d.resumeCount);
    });

    const analysis = Object.values(grouped);

    return ReS(res, { success: true, analysis }, 200);

  } catch (error) {
    console.error("FollowUp Resume Totals Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getFollowUpResumeTotals = getFollowUpResumeTotals;

// ================================
// Get all CoSheet data by followUpBy user
// ================================
const getFollowUpData = async (req, res) => {
  try {
    const userId = req.query.userId || req.params.userId;
    if (!userId) return ReE(res, "userId is required", 400);

    // 🔹 Step 1: Get user full name
    const user = await model.User.findOne({
      where: { id: userId },
      attributes: ["firstName", "lastName"],
      raw: true,
    });

    if (!user) {
      return ReE(res, "User not found", 404);
    }

    const firstName = user.firstName.trim();
    const lastName = user.lastName ? user.lastName.trim() : "";

    // 🔹 Step 2: Fetch CoSheet entries where followUpBy contains first or last name
    const coSheetData = await model.CoSheet.findAll({
      where: {
        userId,
        [Op.or]: [
          { followUpBy: { [Op.iLike]: `%${firstName}%` } },
          { followUpBy: { [Op.iLike]: `%${lastName}%` } },
        ],
      },
      order: [["resumeDate", "ASC"]],
      raw: true,
    });

    return ReS(res, {
      success: true,
      userId,
      followUpBy: `${firstName} ${lastName}`.trim(),
      totalRecords: coSheetData.length,
      data: coSheetData,
    });
  } catch (error) {
    console.error("Get FollowUp Data Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getFollowUpData = getFollowUpData;


// Generic function to fetch category rows
const fetchCategoryData = async (req, res, category) => {
  try {
    const userId = req.query.userId || req.params.userId;
    if (!userId) return ReE(res, "userId is required", 400);

    const rows = await model.CoSheet.findAll({
      where: {
        userId,
        followUpResponse: category,
      },
      raw: true,
    });

    return ReS(res, {
      success: true,
      userId,
      category,
      rows,
    });
  } catch (error) {
    console.error(`Fetch ${category} Error:`, error);
    return ReE(res, error.message, 500);
  }
};

// Export separate handlers
const getResumesReceived = (req, res) =>
  fetchCategoryData(req, res, "resumes received");
module.exports.getResumesReceived = getResumesReceived;

const getSendingIn12Days = (req, res) =>
  fetchCategoryData(req, res, "sending in 1-2 days");
module.exports.getSendingIn12Days = getSendingIn12Days;

const getDelayed = (req, res) => fetchCategoryData(req, res, "delayed");
module.exports.getDelayed = getDelayed;

const getNoResponse = (req, res) => fetchCategoryData(req, res, "no response");
module.exports.getNoResponse = getNoResponse;

const getUnprofessional = (req, res) =>
  fetchCategoryData(req, res, "unprofessional");
module.exports.getUnprofessional = getUnprofessional;

const getAllPendingFollowUps = async (req, res) => {
  try {
    // Define the response categories to include
    const responseCategories = [
      "sending in 1-2 days",
      "delayed",
      "no response",
      "unprofessional",
    ];

    // Fetch all CoSheet rows that match the categories
    const coSheetData = await model.CoSheet.findAll({
      where: {
        followUpResponse: { [Op.in]: responseCategories },
      },
      order: [["resumeDate", "ASC"]],
      raw: true,
    });

    return ReS(res, {
      success: true,
      totalRecords: coSheetData.length,
      data: coSheetData,
    });
  } catch (error) {
    console.error("Get All Pending FollowUps Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getAllPendingFollowUps = getAllPendingFollowUps;

