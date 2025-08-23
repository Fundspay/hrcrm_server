"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");

// GET Daily Connect Analysis for all users (JD sent)
const getDailyAnalysis = async (req, res) => {
  try {
    let { fromDate, toDate } = req.query;

    const now = new Date();
    if (!fromDate || !toDate) {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const formatLocalDate = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      fromDate = formatLocalDate(firstDay);
      toDate = formatLocalDate(lastDay);
    }

    const records = await model.CoSheet.findAll({
      where: {
        detailedResponse: { [Op.iLike]: "%JD%" },
        dateOfConnect: { [Op.between]: [new Date(fromDate), new Date(toDate)] },
      },
      include: [{ model: model.User, attributes: ["id", "firstName", "lastName"] }],
    });

    if (!records.length) return ReS(res, { success: true, data: [] }, 200);

    const analysis = {};
    records.forEach((rec) => {
      if (!rec.dateOfConnect) return;

      const dateKey = rec.dateOfConnect.toISOString().split("T")[0];
      const day = rec.dateOfConnect.toLocaleString("en-US", { weekday: "long" });

      if (!analysis[dateKey]) analysis[dateKey] = { date: dateKey, day, total: 0 };

      const hrName = `${rec.User?.firstName || ""} ${rec.User?.lastName || ""}`.trim();
      if (!hrName) return;

      if (!analysis[dateKey][hrName]) analysis[dateKey][hrName] = 0;
      analysis[dateKey][hrName] += 1;
      analysis[dateKey].total += 1;
    });

    const result = Object.values(analysis);

    return ReS(res, { success: true, data: result }, 200);
  } catch (error) {
    console.error("Daily Analysis Error:", error);
    return ReE(res, error.message, 500);
  }
};

// GET Daily Connect Analysis for a particular user
const getDailyAnalysisByUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    let { fromDate, toDate } = req.query;
    if (!userId) return ReE(res, "userId is required", 400);

    const now = new Date();
    if (!fromDate || !toDate) {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const formatLocalDate = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      fromDate = formatLocalDate(firstDay);
      toDate = formatLocalDate(lastDay);
    }

    const records = await model.CoSheet.findAll({
      where: {
        userId,
        detailedResponse: { [Op.iLike]: "%JD%" },
        dateOfConnect: { [Op.between]: [new Date(fromDate), new Date(toDate)] },
      },
      include: [{ model: model.User, attributes: ["id", "firstName", "lastName"] }],
    });

    if (!records.length) return ReS(res, { success: true, data: [] }, 200);

    // ===== Group by date and count JDs =====
    const analysis = {};
    records.forEach((rec) => {
      if (!rec.dateOfConnect) return;

      const dateKey = rec.dateOfConnect.toISOString().split("T")[0];
      const day = rec.dateOfConnect.toLocaleString("en-US", { weekday: "long" });

      if (!analysis[dateKey]) analysis[dateKey] = { date: dateKey, day, total: 0, jdCount: 0 };

      const hrName = `${rec.User?.firstName || ""} ${rec.User?.lastName || ""}`.trim() || `User ${userId}`;

      if (!analysis[dateKey][hrName]) analysis[dateKey][hrName] = 0;
      analysis[dateKey][hrName] += 1;
      analysis[dateKey].total += 1;
      analysis[dateKey].jdCount += 1;
    });

    // ===== Calculate target JDs from MyTarget =====
    const targetRecord = await model.MyTarget.findOne({
      where: {
        userId,
        startDate: { [Op.lte]: toDate },
        endDate: { [Op.gte]: fromDate },
      },
    });

    const targetJds = targetRecord ? targetRecord.jds : 0;
    const totalJdSent = records.length;
    const jdAchievementPercent = targetJds > 0 ? ((totalJdSent / targetJds) * 100).toFixed(2) : 0;

    const result = Object.values(analysis).map((item) => ({
      ...item,
      targetJds,
      totalJdSent,
      jdAchievementPercent,
    }));

    return ReS(res, { success: true, data: result }, 200);
  } catch (error) {
    console.error("Daily Analysis By User Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports = {
  getDailyAnalysis,
  getDailyAnalysisByUser,
};
