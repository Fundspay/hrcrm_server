"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op, fn, col, literal } = require("sequelize");
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

// 🔹 Resume Analysis Endpoint
const getResumeAnalysis = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) return ReE(res, "userId is required", 400);

    const where = { userId };

    const data = await model.CoSheet.findAll({
      where,
      attributes: [
        "userId",
        [model.sequelize.fn("MAX", model.sequelize.col("followUpBy")), "followUpBy"], // pick followUpBy for that user
        [model.sequelize.fn("DATE", model.sequelize.col("resumeDate")), "resumeDay"],
        [model.sequelize.fn("SUM", model.sequelize.col("resumeCount")), "totalResumes"],
      ],
      group: ["userId", "resumeDay"],  // ✅ group only by userId & day
      order: [[model.sequelize.fn("DATE", model.sequelize.col("resumeDate")), "ASC"]],
      raw: true,
    });

    return ReS(res, { success: true, analysis: data }, 200);

  } catch (error) {
    console.error("Resume Daily Analysis Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.getResumeAnalysis = getResumeAnalysis;


const gettotalResumeAnalysis = async (req, res) => {
  try {
    const { userId, fromDate, toDate, period = "daily" } = req.query;
    if (!userId) return ReE(res, "userId is required", 400);

    const where = { userId };
    if (fromDate) where.resumeDate = { [Op.gte]: fromDate };
    if (toDate) where.resumeDate = { ...where.resumeDate, [Op.lte]: toDate };

    // Get raw data grouped by day or month
    const data = await model.CoSheet.findAll({
      where,
      attributes: [
        [model.sequelize.fn("DATE", model.sequelize.col("resumeDate")), "resumeDay"],
        "followUpResponse",
        [model.sequelize.fn("SUM", model.sequelize.col("resumeCount")), "resumeCount"]
      ],
      group: ["resumeDay", "followUpResponse"],
      order: [["resumeDate", "ASC"]],
      raw: true,
    });

    // Prepare responses categories
    const categories = ["resumes received", "sending in 1-2 days", "delayed", "no response", "unprofessional"];

    // Determine range of dates for daily or months for monthly
    const start = fromDate ? new Date(fromDate) : (data[0] ? new Date(data[0].resumeDay) : new Date());
    const end = toDate ? new Date(toDate) : new Date();

    let periods = [];
    if (period === "daily") {
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        periods.push(new Date(d).toISOString().slice(0, 10));
      }
    } else { // monthly
      const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
      const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
      for (let m = new Date(startMonth); m <= endMonth; m.setMonth(m.getMonth() + 1)) {
        periods.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
      }
    }

    // Initialize breakdown with zeros
    let breakdown = periods.map(p => {
      let obj = { period: p, totalResumes: 0 };
      categories.forEach(c => obj[c.replace(/\s/g, "_")] = 0);
      return obj;
    });

    // Fill breakdown with actual data
    data.forEach(d => {
      let periodKey = period === "daily" ? d.resumeDay : d.resumeDay.slice(0, 7);
      let index = breakdown.findIndex(b => b.period === periodKey);
      if (index !== -1) {
        const catKey = d.followUpResponse?.replace(/\s/g, "_");
        if (catKey) breakdown[index][catKey] = Number(d.resumeCount);
        breakdown[index].totalResumes += Number(d.resumeCount);
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
    const { userId, fromDate, toDate, period = "daily" } = req.query;
    if (!userId) return ReE(res, "userId is required", 400);

    const where = { userId };
    if (fromDate) where.resumeDate = { [Op.gte]: fromDate };
    if (toDate) where.resumeDate = { ...where.resumeDate, [Op.lte]: toDate };

    const data = await model.CoSheet.findAll({
      where,
      attributes: [
        "id", // CoSheet ID
        "followUpBy",
        [model.sequelize.fn("DATE", model.sequelize.col("resumeDate")), "resumeDay"],
        "followUpResponse",
        [model.sequelize.fn("SUM", model.sequelize.col("resumeCount")), "resumeCount"]
      ],
      group: ["id", "followUpBy", "resumeDay", "followUpResponse"],
      order: [["id", "ASC"], ["resumeDate", "ASC"]],
      raw: true,
    });

    const categories = ["resumes received", "sending in 1-2 days", "delayed", "no response", "unprofessional"];

    // Get all CoSheet IDs
    const coSheetIds = [...new Set(data.map(d => d.id))];

    const result = [];

    for (let id of coSheetIds) {
      const coSheetData = data.filter(d => d.id === id);
      const followUpUsers = [...new Set(coSheetData.map(d => d.followUpBy))];

      // Determine periods
      let start = fromDate ? new Date(fromDate) : new Date(Math.min(...coSheetData.map(d => new Date(d.resumeDay))));
      let end = toDate ? new Date(toDate) : new Date(Math.max(...coSheetData.map(d => new Date(d.resumeDay))));
      let periods = [];
      if (period === "daily") {
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          periods.push(new Date(d).toISOString().slice(0, 10));
        }
      } else { // monthly
        const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
        const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
        for (let m = new Date(startMonth); m <= endMonth; m.setMonth(m.getMonth() + 1)) {
          periods.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
        }
      }

      const breakdown = periods.map(p => {
        let obj = { period: p, totalResumes: 0 };
        categories.forEach(c => obj[c.replace(/\s/g, "_")] = 0);
        followUpUsers.forEach(u => obj[`followUpBy_${u}`] = 0);
        return obj;
      });

      // Fill data
      coSheetData.forEach(d => {
        const periodKey = period === "daily" ? d.resumeDay : d.resumeDay.slice(0, 7);
        const index = breakdown.findIndex(b => b.period === periodKey);
        if (index !== -1) {
          const catKey = d.followUpResponse?.replace(/\s/g, "_");
          if (catKey) breakdown[index][catKey] += Number(d.resumeCount);
          if (d.followUpBy) breakdown[index][`followUpBy_${d.followUpBy}`] += Number(d.resumeCount);
          breakdown[index].totalResumes += Number(d.resumeCount);
        }
      });

      // Calculate efficiency per CoSheet
      const totalResumes = breakdown.reduce((sum, b) => sum + b.totalResumes, 0);
      const receivedResumes = breakdown.reduce((sum, b) => sum + b.resumes_received, 0);
      const efficiency = totalResumes ? ((receivedResumes / totalResumes) * 100).toFixed(2) : 0;

      result.push({
        coSheetId: id,
        followUpUsers,
        breakdown,
        totalResumes,
        efficiency: Number(efficiency)
      });
    }

    return ReS(res, { success: true, analysis: result }, 200);

  } catch (error) {
    console.error("Resume Analysis Per CoSheet Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getResumeAnalysisPerCoSheet = getResumeAnalysisPerCoSheet;
  


