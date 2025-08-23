"use strict";

const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");

// Upsert Interview Analysis
const upsertInterviewAnalysis = async (req, res) => {
  try {
    const { userId, totalInterviewsAllotted, month } = req.body;

    if (!userId) return ReE(res, "userId is required", 400);
    if (totalInterviewsAllotted === undefined) return ReE(res, "totalInterviewsAllotted is required", 400);
    if (!month) return ReE(res, "month is required", 400);

    // Check if user exists
    const user = await model.User.findByPk(userId);
    if (!user) return ReE(res, "User not registered", 400);

    // Upsert for given user & month
    const [record, created] = await model.InterviewAnalysis.upsert(
      { userId, totalInterviewsAllotted, month },
      { returning: true }
    );

    return ReS(res, {
      success: true,
      message: created ? "Analysis created" : "Analysis updated",
      data: record,
    }, 200);
  } catch (error) {
    console.error("Upsert Analysis Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.upsertInterviewAnalysis = upsertInterviewAnalysis;

// Fetch all analysis with interview stats
const getAllInterviewAnalysis = async (req, res) => {
  try {
    const records = await model.InterviewAnalysis.findAll({
      include: [{ model: model.User, attributes: ["id", "firstName", "lastName"] }],
    });

    // Map additional stats from InterviewDetails
    const data = await Promise.all(records.map(async (rec) => {
      const r = rec.toJSON();

      // Fetch interviews conducted by this user
      const interviews = await model.InterviewDetails.findAll({
        where: { interviewedBy: r.userId },
      });

      const totalConducted = interviews.length;
      const statusCount = {
        selected: 0,
        rejected: 0,
        "on-hold": 0,
        "not-answered": 0,
        "not-interested": 0,
      };

      const dates = [];

      interviews.forEach((i) => {
        // Count selection statuses
        const status = i.finalStatus ? i.finalStatus.toLowerCase() : "not-answered";
        if (statusCount[status] !== undefined) statusCount[status] += 1;

        // Collect interview dates
        dates.push(i.interviewDate ? i.interviewDate.toISOString().split("T")[0] : null);
      });

      return {
        sr: r.id,
        interviewerName: r.User ? `${r.User.firstName} ${r.User.lastName}` : null,
        totalInterviewsAllotted: r.totalInterviewsAllotted,
        totalInterviewsConducted: totalConducted,
        selectionStatus: statusCount,
        datesOfInterviews: dates.filter(d => d !== null),
      };
    }));

    return ReS(res, { success: true, data }, 200);
  } catch (error) {
    console.error("Fetch Analysis Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.getAllInterviewAnalysis = getAllInterviewAnalysis;

// Fetch analysis by userId
const getInterviewAnalysisByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) return ReE(res, "userId is required", 400);

    // Find analysis record(s) for this user
    const record = await model.InterviewAnalysis.findOne({
      where: { userId },
      include: [{ model: model.User, attributes: ["id", "firstName", "lastName"] }],
    });

    if (!record) return ReE(res, "No analysis found for this user", 404);

    const r = record.toJSON();

    // Fetch interviews conducted by this user
    const interviews = await model.InterviewDetails.findAll({
      where: { interviewedBy: r.userId },
    });

    const totalConducted = interviews.length;
    const statusCount = {
      selected: 0,
      rejected: 0,
      "on-hold": 0,
      "not-answered": 0,
      "not-interested": 0,
    };

    const dates = [];

    interviews.forEach((i) => {
      const status = i.finalStatus ? i.finalStatus.toLowerCase() : "not-answered";
      if (statusCount[status] !== undefined) statusCount[status] += 1;

      dates.push(i.interviewDate ? i.interviewDate.toISOString().split("T")[0] : null);
    });

    return ReS(res, {
      success: true,
      data: {
        sr: r.id,
        interviewerName: r.User ? `${r.User.firstName} ${r.User.lastName}` : null,
        totalInterviewsAllotted: r.totalInterviewsAllotted,
        totalInterviewsConducted: totalConducted,
        selectionStatus: statusCount,
        datesOfInterviews: dates.filter(d => d !== null),
      }
    }, 200);

  } catch (error) {
    console.error("Fetch Analysis by UserId Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.getInterviewAnalysisByUserId = getInterviewAnalysisByUserId;
