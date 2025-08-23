"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");

// GET Daily Connect Analysis (JD sent)
const getDailyAnalysis = async (req, res) => {
  try {
    // Fetch all CoSheets where detailedResponse contains "JD"
    const records = await model.CoSheet.findAll({
      where: {
        detailedResponse: { [Op.iLike]: "%JD%" }
      },
      include: [
        { model: model.User, attributes: ["id", "firstName", "lastName"] },
      ],
    });

    if (!records.length) return ReS(res, { success: true, data: [] }, 200);

    const analysis = {};
    records.forEach((rec) => {
      if (!rec.dateOfConnect) return;

      const dateKey = rec.dateOfConnect.toISOString().split("T")[0];
      const day = rec.dateOfConnect.toLocaleString("en-US", { weekday: "long" });

      if (!analysis[dateKey]) analysis[dateKey] = { date: dateKey, day, total: 0 };

      const hrName = `${rec.User?.firstName || ""} ${rec.User?.lastName || ""}`.trim();
      if (!hrName) return; // skip if no HR name

      if (!analysis[dateKey][hrName]) analysis[dateKey][hrName] = 0;
      analysis[dateKey][hrName] += 1;
      analysis[dateKey].total += 1; // increment total JD count
    });

    const result = Object.values(analysis);

    return ReS(res, { success: true, data: result }, 200);
  } catch (error) {
    console.error("Daily Analysis Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getDailyAnalysis = getDailyAnalysis;


// GET Daily Connect Analysis per User
const getDailyAnalysisByUser = async (req, res) => {
  try {
    const userId = req.params.userId; // instead of req.query
    if (!userId) return ReE(res, "userId is required", 400);
    
    // Fetch CoSheets for the specific user where detailedResponse contains "JD"
    const records = await model.CoSheet.findAll({
      where: {
        userId,
        detailedResponse: { [Op.iLike]: "%JD%" }
      },
      include: [
        { model: model.User, attributes: ["id", "firstName", "lastName"] },
      ],
    });

    if (!records.length) return ReS(res, { success: true, data: [] }, 200);

    // Group by date
    const analysis = {};
    records.forEach((rec) => {
      if (!rec.dateOfConnect) return;

      const dateKey = rec.dateOfConnect.toISOString().split("T")[0];
      const day = rec.dateOfConnect.toLocaleString("en-US", { weekday: "long" });

      if (!analysis[dateKey]) {
        analysis[dateKey] = {
          date: dateKey,
          day,
          total: 0,
          jdCount: 0
        };
      }

      // Count JD for the user
      const hrName = `${rec.User?.firstName || ""} ${rec.User?.lastName || ""}`.trim() || `User ${userId}`;

      if (!analysis[dateKey][hrName]) analysis[dateKey][hrName] = 0;
      analysis[dateKey][hrName] += 1;

      analysis[dateKey].total += 1; // total JDs for the date
      analysis[dateKey].jdCount += 1; // total JDs for this user/date
    });

    const result = Object.values(analysis);

    return ReS(res, { success: true, data: result }, 200);
  } catch (error) {
    console.error("Daily Analysis By User Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getDailyAnalysisByUser = getDailyAnalysisByUser;

