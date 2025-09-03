"use strict";

const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");



const listResumeFields = (req, res) => {
  try {
    const fields = Object.keys(model.StudentResume.rawAttributes);

    return ReS(res, { success: true, fields }, 200);
  } catch (error) {
    console.error("List Resume Fields Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.listResumeFields = listResumeFields;

const updateInterviewScore = async (req, res) => {
  try {
    const record = await model.StudentResume.findByPk(req.params.id);
    if (!record) return ReE(res, "Resume record not found", 404);

    const updates = {};
    const allowedFields = [
      "interviewedBy",
      "knowledgeScore",
      "approachScore",
      "skillsScore",
      "otherScore",
      "comment",
      "finalSelectionStatus"
    ];

    const allowedStatuses = [
      "selected",
      "not selected",
      "on hold",
      "not answered / busy",
      "not interested"
    ];

    for (let f of allowedFields) {
      if (req.body[f] !== undefined) {
        if (f === "finalSelectionStatus") {
          const val = req.body[f]?.toLowerCase();
          if (val && !allowedStatuses.includes(val)) {
            return ReE(res, `Invalid finalSelectionStatus. Allowed: ${allowedStatuses.join(", ")}`, 400);
          }
          updates[f] = val;
        } else {
          updates[f] = req.body[f];
        }
      }
    }

    // ✅ Auto-calculate totalAverageScore if scores are provided
    const scores = [
      updates.knowledgeScore ?? record.knowledgeScore,
      updates.approachScore ?? record.approachScore,
      updates.skillsScore ?? record.skillsScore,
      updates.otherScore ?? record.otherScore,
    ].filter((s) => s !== null && s !== undefined);

    if (scores.length === 4) {
      updates.totalAverageScore = (
        scores.reduce((a, b) => a + Number(b), 0) / 4
      ).toFixed(2);
    }

    if (!Object.keys(updates).length) {
      return ReE(res, "No fields to update", 400);
    }

    await record.update(updates);
    return ReS(res, { success: true, data: record }, 200);

  } catch (error) {
    console.error("Interview Score Update Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.updateInterviewScore = updateInterviewScore;


