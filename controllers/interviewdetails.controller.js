"use strict";

const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");

// Upsert Interview Details
const upsertInterviewDetails = async (req, res) => {
  try {
    const {
      interviewID,
      interviewedBy,
      interviewDate,
      interviewTime,
      interviewRound,
      scorecard,
      finalStatus,
      comments,
    } = req.body;

    if (!interviewedBy) return ReE(res, "interviewedBy (user ID) is required", 400);
    if (!interviewDate) return ReE(res, "interviewDate is required", 400);

    // Check if user exists
    const user = await model.User.findOne({ where: { id: interviewedBy } });
    if (!user) return ReE(res, "User ID is not registered", 400);

    // Validate scorecard
    const allowedScoreFields = ["knowledge", "approach", "skills", "others"];
    if (!scorecard) return ReE(res, "scorecard is required", 400);
    for (const field of allowedScoreFields) {
      const value = scorecard[field];
      if (value === undefined || value === null)
        return ReE(res, `${field} is required in scorecard`, 400);
      if (!Number.isInteger(value) || value < 0 || value > 10) {
        return ReE(res, `${field} must be an integer between 0 and 10`, 400);
      }
    }

    // Validate finalStatus
    const allowedStatuses = ["selected", "rejected", "on-hold"];
    if (finalStatus && !allowedStatuses.includes(finalStatus.toLowerCase())) {
      return ReE(res, `finalStatus must be one of: ${allowedStatuses.join(", ")}`, 400);
    }

    // Calculate averageScore
    const averageScore = (
      (scorecard.knowledge + scorecard.approach + scorecard.skills + scorecard.others) / 4
    ).toFixed(2);

    const upsertData = {
      interviewedBy,
      interviewDate,
      interviewTime: interviewTime || null,
      interviewRound: interviewRound || null,
      knowledge: scorecard.knowledge,
      approach: scorecard.approach,
      skills: scorecard.skills,
      others: scorecard.others,
      averageScore,
      finalStatus: finalStatus ? finalStatus.toLowerCase() : null,
      comments: comments || null,
      updatedAt: new Date(),
    };

    await model.InterviewDetails.upsert(
      { interviewID, ...upsertData },
      { returning: true }
    );

    // Fetch updated record with interviewer info
    const record = await model.InterviewDetails.findOne({
      where: { interviewID },
      include: [
        { model: model.User, as: "interviewer", attributes: ["id", "firstName", "lastName"] },
      ],
    });

    const data = {
      ...record.toJSON(),
      interviewedByName: record.interviewer
        ? `${record.interviewer.firstName} ${record.interviewer.lastName}`
        : null,
    };

    return ReS(res, {
      success: true,
      message: interviewID ? "Interview updated" : "Interview created",
      data,
    }, 200);
  } catch (error) {
    console.error("Upsert Interview Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.upsertInterviewDetails = upsertInterviewDetails;


// Get Interview Details by ID
const getInterviewDetails = async (req, res) => {
  try {
    const { interviewID } = req.params;

    const record = await model.InterviewDetails.findOne({
      where: { interviewID },
      include: [
        { model: model.User, as: "interviewer", attributes: ["id", "firstName", "lastName"] },
      ],
    });

    if (!record) return ReS(res, { success: true, data: null }, 200);

    const data = {
      ...record.toJSON(),
      interviewedByName: record.interviewer
        ? `${record.interviewer.firstName} ${record.interviewer.lastName}`
        : null,
    };

    return ReS(res, { success: true, data }, 200);
  } catch (error) {
    console.error("Get Interview Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.getInterviewDetails = getInterviewDetails;

// Get All Interviews
const getAllInterviews = async (req, res) => {
  try {
    const records = await model.InterviewDetails.findAll({
      include: [
        { model: model.User, as: "interviewer", attributes: ["id", "firstName", "lastName"] },
      ],
    });

    if (!records.length) return ReS(res, { success: true, data: [] }, 200);

    const data = records.map((rec) => {
      const r = rec.toJSON();
      return {
        ...r,
        interviewedByName: rec.interviewer
          ? `${rec.interviewer.firstName} ${rec.interviewer.lastName}`
          : null,
      };
    });

    return ReS(res, { success: true, data }, 200);
  } catch (error) {
    console.error("Fetch All Interviews Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.getAllInterviews = getAllInterviews;
