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
      "expectedResponseDate"
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

// 🔹 Resume Analysis Endpoint with followUpResponse breakdown
const getResumeAnalysis = async (req, res) => {
  try {
    const userId = req.query.userId || req.params.userId;
    if (!userId) return ReE(res, "userId is required", 400);

    const { fromDate, toDate } = req.query;

    const where = {
      userId,
      resumeDate: { [Op.ne]: null },
    };
    if (fromDate) where.resumeDate[Op.gte] = fromDate;
    if (toDate) where.resumeDate[Op.lte] = toDate;

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
        [fn("MAX", col("followUpBy")), "followUpBy"],
        "followUpResponse",
        [fn("SUM", col("resumeCount")), "totalResumes"],
      ],
      group: ["userId", "followUpResponse"],
      raw: true,
    });

    // --- Fetch Targets ---
    const targets = await model.MyTarget.findAll({
      where: {
        userId,
        ...(fromDate && toDate
          ? { targetDate: { [Op.between]: [new Date(fromDate), new Date(toDate)] } }
          : fromDate
            ? { targetDate: { [Op.gte]: new Date(fromDate) } }
            : toDate
              ? { targetDate: { [Op.lte]: new Date(toDate) } }
              : {}),
      },
      attributes: ["targetDate", "followUps", "resumetarget"],
      raw: true,
    });

    const totalFollowUpTarget = targets.reduce((sum, t) => sum + (t.followUps || 0), 0);
    const totalResumeTarget = targets.reduce((sum, t) => sum + (t.resumetarget || 0), 0);

    // --- Aggregate results ---
    let totalAchievedFollowUps = 0;
    let totalAchievedResumes = 0;

    const breakdown = {};
    categories.forEach((c) => (breakdown[c] = 0));

    let followUpBy = null;

    data.forEach((d) => {
      const responseKey = d.followUpResponse?.toLowerCase();
      if (responseKey && categories.includes(responseKey)) {
        breakdown[responseKey] += Number(d.totalResumes);
        totalAchievedFollowUps += Number(d.totalResumes);
        totalAchievedResumes += Number(d.totalResumes);
      }
      if (d.followUpBy) followUpBy = d.followUpBy;
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
        breakdownTotals: breakdown, // <-- added aggregated breakdown totals
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

const getResumeAnalysisPerCoSheet = async (req, res) => {
  try {
    const { userId } = req.params;
    const { fromDate, toDate, period = "daily" } = req.query;
    if (!userId) return ReE(res, "userId is required", 400);

    const now = new Date();
    const startDate = fromDate ? new Date(fromDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = toDate ? new Date(toDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const data = await model.CoSheet.findAll({
      where: {
        userId,
        resumeDate: { [Op.between]: [startDate, endDate] },
      },
      attributes: [
        "id",
        "followUpBy",
        [fn("DATE", col("resumeDate")), "resumeDay"],
        "followUpResponse",
        [fn("SUM", col("resumeCount")), "resumeCount"],
      ],
      group: ["id", "followUpBy", "resumeDay", "followUpResponse"],
      order: [["id", "ASC"], ["resumeDay", "ASC"]],
      raw: true,
    });

    if (!data.length) return ReS(res, { success: true, analysis: [] }, 200);

    const coSheetIds = [...new Set(data.map((d) => d.id))];

    // fetch targets
    const targets = await model.MyTarget.findAll({
      where: {
        userId,
        targetDate: { [Op.between]: [startDate, endDate] },
      },
      attributes: ["targetDate", "resumetarget"],
      raw: true,
    });

    const targetMap = {};
    targets.forEach((t) => {
      const key = new Date(t.targetDate).toISOString().slice(0, 10);
      targetMap[key] = t.resumetarget;
    });

    const result = [];

    for (let id of coSheetIds) {
      const coSheetData = data.filter((d) => d.id === id);
      const followUpUsers = [...new Set(coSheetData.map((d) => d.followUpBy).filter(Boolean))];

      const actualStart = new Date(Math.min(...coSheetData.map((d) => new Date(d.resumeDay))));
      const actualEnd = new Date(Math.max(...coSheetData.map((d) => new Date(d.resumeDay))));

      let periods = [];
      if (period === "daily") {
        for (let d = new Date(actualStart); d <= actualEnd; d.setDate(d.getDate() + 1)) {
          periods.push(new Date(d).toISOString().slice(0, 10));
        }
      } else {
        for (let m = new Date(actualStart.getFullYear(), actualStart.getMonth(), 1);
          m <= new Date(actualEnd.getFullYear(), actualEnd.getMonth(), 1);
          m.setMonth(m.getMonth() + 1)) {
          periods.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
        }
      }

      const categories = ["resumes received", "sending in 1-2 days", "delayed", "no response", "unprofessional"];

      const breakdown = periods.map((p) => {
        const obj = { period: p, totalResumes: 0, resumetarget: targetMap[p] || 0 };
        categories.forEach((c) => (obj[c.replace(/\s/g, "_")] = 0));
        followUpUsers.forEach((u) => (obj[`followUpBy_${u}`] = 0));
        return obj;
      });

      coSheetData.forEach((d) => {
        if (!d.resumeDay) return;
        const periodKey = period === "daily" ? d.resumeDay : d.resumeDay.slice(0, 7);
        const index = breakdown.findIndex((b) => b.period === periodKey);
        if (index !== -1) {
          const catKey = d.followUpResponse?.replace(/\s/g, "_");
          if (catKey) breakdown[index][catKey] += Number(d.resumeCount);
          if (d.followUpBy) breakdown[index][`followUpBy_${d.followUpBy}`] += Number(d.resumeCount);
          breakdown[index].totalResumes += Number(d.resumeCount);
        }
      });

      const totalResumes = breakdown.reduce((sum, b) => sum + b.totalResumes, 0);
      const totalTarget = breakdown.reduce((sum, b) => sum + (b.resumetarget || 0), 0);
      const efficiency = totalTarget ? ((totalResumes / totalTarget) * 100).toFixed(2) : 0;

      result.push({
        coSheetId: id,
        followUpUsers,
        breakdown,
        totalResumes,
        totalTarget,
        efficiency: Number(efficiency),
      });
    }

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

    // 🔹 Fetch all CoSheet entries where userId matches
    const coSheetData = await model.CoSheet.findAll({
      where: { userId },
      order: [["resumeDate", "ASC"]],
      raw: true,
    });

    if (!coSheetData || coSheetData.length === 0) {
      return ReE(res, "No follow-up data found for this userId", 404);
    }

    return ReS(res, {
      success: true,
      userId,
      totalRecords: coSheetData.length,
      data: coSheetData,
    });
  } catch (error) {
    console.error("Get FollowUp Data Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getFollowUpData = getFollowUpData;

