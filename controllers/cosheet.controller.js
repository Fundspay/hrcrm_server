"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { sendMail } = require("../middleware/mailer.middleware");
const AWS = require("aws-sdk");
const { Op } = require("sequelize");


// / configure S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});


// Create / Upload CoSheet (Excel JSON)
const createCoSheet = async (req, res) => {
  try {
    const dataArray = Array.isArray(req.body) ? req.body : [req.body];
    if (!dataArray.length) return ReE(res, "No data provided", 400);

    const results = await Promise.all(
      dataArray.map(async (data) => {
        try {
          const payload = {
            // College details
            sr: data.collegeDetails?.sr ?? data.sr ?? null,
            collegeName: data.collegeDetails?.collegeName ?? data.collegeName ?? null,
            coordinatorName: data.collegeDetails?.coordinatorName ?? data.coordinatorName ?? null,
            mobileNumber: data.collegeDetails?.mobileNumber ?? data.mobileNumber ?? null,
            emailId: data.collegeDetails?.emailId ?? data.emailId ?? null,
            city: data.collegeDetails?.city ?? data.city ?? null,
            state: data.collegeDetails?.state ?? data.state ?? null,
            course: data.collegeDetails?.course ?? data.course ?? null,

            // Connect details
            dateOfConnect: data.connect?.dateOfConnect ?? data.dateOfConnect ?? null,
            callResponse: data.connect?.callResponse ?? data.callResponse ?? null,
            internshipType: data.connect?.internshipType ?? data.internshipType ?? null,
            detailedResponse: data.connect?.detailedResponse ?? data.detailedResponse ?? null,
            connectedBy: data.connect?.connectedBy ?? data.connectedBy ?? null,

            // Foreign key to User
            userId: data.userId ?? req.user?.id ?? null,
          };

          if (!payload.userId) {
            return { success: false, error: "userId is required" };
          }

          // Check if record already exists (you can adjust uniqueness rule here)
          const existing = await model.CoSheet.findOne({
            where: {
              userId: payload.userId,
              collegeName: payload.collegeName,
              mobileNumber: payload.mobileNumber,
              emailId: payload.emailId
            }
          });

          if (existing) {
            return { success: false, error: "Duplicate record skipped" };
          }

          // Create new record with a new ID
          const record = await model.CoSheet.create(payload);
          return { success: true, data: record };
        } catch (err) {
          console.error("Single CoSheet record create failed:", err);
          return { success: false, error: err.message };
        }
      })
    );

    return ReS(res, { success: true, data: results }, 201);
  } catch (error) {
    console.error("CoSheet Create Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.createCoSheet = createCoSheet;




const allowedMonths = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec"
];

// Update connect fields
const updateConnectFields = async (req, res) => {
  try {
    const record = await model.CoSheet.findByPk(req.params.id);
    if (!record) return ReE(res, "CoSheet record not found", 404);

    const allowedFields = [
      "sr", "collegeName", "coordinatorName", "mobileNumber", "emailId", "city", "state", "course",
      "connectedBy", "dateOfConnect", "callResponse", "internshipType", "detailedResponse", "userId"
    ];

    const allowedInternshipTypes = ["fulltime", "sip", "liveproject", "wip", "others"];
    const allowedCallResponses = ["connected", "not answered", "busy", "switch off", "invalid"];
    const updates = {};

    for (let f of allowedFields) {
      if (req.body[f] !== undefined) {
        if (f === "internshipType") {
          if (req.body[f] && !allowedInternshipTypes.includes(req.body[f].toLowerCase())) {
            return ReE(res, "Invalid internshipType. Allowed: fulltime, liveproject, wip, others", 400);
          }
          updates[f] = req.body[f].toLowerCase();
        } else if (f === "callResponse") {
          const val = req.body[f]?.toLowerCase();
          if (val && !allowedCallResponses.includes(val)) {
            return ReE(res, "Invalid callResponse. Allowed: connected, not answered, busy, switch off, invalid", 400);
          }
          updates[f] = val || null;
        } else {
          updates[f] = req.body[f];
        }
      }
    }

    if (!Object.keys(updates).length) {
      return ReE(res, "No fields to update", 400);
    }

    await record.update(updates);
    return ReS(res, { success: true, data: record }, 200);
  } catch (error) {
    console.error("CoSheet Update Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.updateConnectFields = updateConnectFields;

// Get all CoSheets
const getCoSheets = async (req, res) => {
  try {
    const records = await model.CoSheet.findAll();
    const users = await model.User.findAll({
      where: { isActive: true, isDeleted: false },
      attributes: ["id", "firstName", "lastName", "email"],
      order: [["firstName", "ASC"]],
    });

    return ReS(res, { success: true, data: records, users }, 200);
  } catch (error) {
    console.error("CoSheet Fetch All Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.getCoSheets = getCoSheets;


// Get single CoSheet
const getCoSheetById = async (req, res) => {
  try {
    const record = await model.CoSheet.findByPk(req.params.id);
    if (!record) return ReE(res, "CoSheet record not found", 404);
    return ReS(res, { success: true, data: record }, 200);
  } catch (error) {
    console.error("CoSheet Fetch Single Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.getCoSheetById = getCoSheetById;


// Send JD to college email
const sendJDToCollege = async (req, res) => {
  try {
    const { id } = req.params;
    const { cc, bcc } = req.body;
    const record = await model.CoSheet.findByPk(id);
    if (!record) return ReE(res, "CoSheet record not found", 404);
    if (!record.emailId) return ReE(res, "No email found for this college", 400);
    if (!record.internshipType) return ReE(res, "No internshipType set for this record", 400);

    const JD_MAP = {
      fulltime: "jds/fulltime.pdf",
      liveproject: "jds/liveproject.pdf",
      sip: "jds/sip.pdf",
      wip: "jds/wip.pdf",
      others: "jds/others.pdf",
    };

    const jdKeyType = record.internshipType.trim().toLowerCase().replace(/\s+/g, '');
    const jdKey = JD_MAP[jdKeyType];
    if (!jdKey) return ReE(res, `No JD mapped for internshipType: ${record.internshipType}`, 400);

    const jdFile = await s3.getObject({ Bucket: "fundsroomhr", Key: jdKey }).promise();

    const subject = `Collaboration Proposal for Live Projects, Internships & Placements – FundsAudit`;

    const html = `<p>Respected ${record.coordinatorName || "Sir/Madam"},</p>
      <p>Warm greetings from FundsAudit!</p>
      <p>JD attached for ${record.collegeName || ""}.</p>
    `;

    const mailResponse = await sendMail(
      record.emailId,
      subject,
      html,
      [{ filename: `${record.internshipType}.pdf`, content: jdFile.Body }],
      cc,
      bcc
    );

    if (!mailResponse.success) return ReE(res, "Failed to send JD email", 500);

    await record.update({ jdSentAt: new Date() });
    return ReS(res, { success: true, message: "JD sent successfully" }, 200);
  } catch (error) {
    console.error("Send JD Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.sendJDToCollege = sendJDToCollege;


const getCallStatsByUserWithTarget = async (req, res) => {
  try {
    const userId = req.params.userId;
    let { fromDate, toDate } = req.query;

    const now = new Date();

    // Default to current month
    if (!fromDate || !toDate) {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const formatLocalDate = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      fromDate = formatLocalDate(firstDay);
      toDate = formatLocalDate(lastDay);
    }

    // Fetch CoSheet records for user in date range
    const records = await model.CoSheet.findAll({
      where: {
        userId,
        dateOfConnect: { [Op.between]: [new Date(fromDate), new Date(toDate)] }
      }
    });

    const totalCalls = records.length;

    // Fetch user's target for the period
    const targetRecord = await model.MyTarget.findOne({
      where: { userId }
    });

    const targetCalls = targetRecord ? targetRecord.calls : 0;
    const achievedCalls = totalCalls;
    const remainingCalls = Math.max(targetCalls - achievedCalls, 0);
    const achievementPercent = targetCalls > 0 ? ((achievedCalls / targetCalls) * 100).toFixed(2) : 0;

    // Count call responses
    const allowedCallResponses = ["connected", "not answered", "busy", "switch off", "invalid"];
    const stats = {};
    allowedCallResponses.forEach((resp) => { stats[resp] = 0; });
    records.forEach((rec) => {
      const response = (rec.callResponse || "").toLowerCase();
      if (allowedCallResponses.includes(response)) stats[response]++;
    });
    const percentages = {};
    allowedCallResponses.forEach((resp) => {
      percentages[resp] = ((stats[resp] / totalCalls) * 100).toFixed(2);
    });

    const monthLabel = new Date(fromDate).toLocaleString("en-IN", { month: "long", year: "numeric" });

    return ReS(res, {
      success: true,
      data: {
        month: monthLabel,
        fromDate,
        toDate,
        totalCalls,
        targetCalls,
        achievedCalls,
        remainingCalls,
        achievementPercent,
        counts: stats,
        percentages
      }
    }, 200);

  } catch (error) {
    console.error("Call Stats Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getCallStatsByUserWithTarget = getCallStatsByUserWithTarget;


const getCallStatsAllUsers = async (req, res) => {
  try {
    const records = await model.CoSheet.findAll();

    if (!records.length) {
      return ReS(res, { success: true, message: "No records found", data: {} }, 200);
    }

    const allowedCallResponses = ["connected", "not answered", "busy", "switch off", "invalid"];
    const userStats = {};

    // Iterate through each record
    records.forEach((rec) => {
      const userId = rec.connectedBy;
      const response = (rec.callResponse || "").toLowerCase();

      if (!userStats[userId]) {
        // Initialize counts for this user
        userStats[userId] = { totalCalls: 0, counts: {}, percentages: {} };
        allowedCallResponses.forEach((resp) => {
          userStats[userId].counts[resp] = 0;
        });
      }

      userStats[userId].totalCalls++;
      if (allowedCallResponses.includes(response)) {
        userStats[userId].counts[response]++;
      }
    });

    // Calculate percentages per user
    Object.keys(userStats).forEach((userId) => {
      const stats = userStats[userId];
      allowedCallResponses.forEach((resp) => {
        stats.percentages[resp] = ((stats.counts[resp] / stats.totalCalls) * 100).toFixed(2);
      });
    });

    return ReS(res, { success: true, data: userStats }, 200);

  } catch (error) {
    console.error("All Users Call Stats Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getCallStatsAllUsers = getCallStatsAllUsers;

const getJdStatsWithTarget = async (req, res) => {
  try {
    const userId = req.params.userId;
    let { fromDate, toDate } = req.query;

    const now = new Date();

    // Default to current month
    if (!fromDate || !toDate) {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const formatLocalDate = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      fromDate = formatLocalDate(firstDay);
      toDate = formatLocalDate(lastDay);
    }

    // JD sent by this user
    const jdSentByUser = await model.CoSheet.count({
      where: {
        userId,
        jdSentAt: {
          [Op.between]: [new Date(fromDate), new Date(toDate)]
        }
      }
    });

    // JD sent by all users
    const jdSentByAllUsers = await model.CoSheet.count({
      where: {
        jdSentAt: {
          [Op.between]: [new Date(fromDate), new Date(toDate)]
        }
      }
    });

    // Fetch user's JD target
    const targetRecord = await model.MyTarget.findOne({ where: { userId } });
    const jdTarget = targetRecord ? targetRecord.jds : 0;
    const remainingJD = Math.max(jdTarget - jdSentByUser, 0);
    const achievementPercent = jdTarget > 0 ? ((jdSentByUser / jdTarget) * 100).toFixed(2) : 0;

    const monthLabel = new Date(fromDate).toLocaleString("en-US", {
      month: "long",
      year: "numeric"
    });

    return ReS(res, {
      success: true,
      data: {
        month: monthLabel,
        fromDate,
        toDate,
        jdTarget,
        jdSentByUser,
        remainingJD,
        achievementPercent,
        jdSentByAllUsers
      }
    }, 200);

  } catch (error) {
    console.error("JD Stats Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getJdStatsWithTarget = getJdStatsWithTarget;


const getInternshipStats = async (req, res) => {
  try {
    const userId = req.params.userId;
    let { fromDate, toDate } = req.query;

    const now = new Date();

    // ✅ Default to current month in LOCAL timezone
    if (!fromDate || !toDate) {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const formatLocalDate = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      fromDate = formatLocalDate(firstDay);
      toDate = formatLocalDate(lastDay);
    }

    const allowedInternshipTypes = ["fulltime", "sip", "live project", "wip", "others"];

    // ✅ Internship counts for this user
    const userCounts = {};
    for (const type of allowedInternshipTypes) {
      userCounts[type] = await model.CoSheet.count({
        where: {
          userId,
          internshipType: type,
          dateOfConnect: {
            [Op.between]: [new Date(fromDate), new Date(toDate)]
          }
        }
      });
    }

    // ✅ Internship counts for all users
    const totalCounts = {};
    for (const type of allowedInternshipTypes) {
      totalCounts[type] = await model.CoSheet.count({
        where: {
          internshipType: type,
          dateOfConnect: {
            [Op.between]: [new Date(fromDate), new Date(toDate)]
          }
        }
      });
    }

    // ✅ Month label
    const monthLabel = new Date(fromDate).toLocaleString("en-US", {
      month: "long",
      year: "numeric"
    });

    return ReS(res, {
      success: true,
      data: {
        month: monthLabel,
        fromDate,
        toDate,
        internshipByUser: userCounts,
        internshipByAllUsers: totalCounts
      }
    }, 200);

  } catch (error) {
    console.error("Internship Stats Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getInternshipStats = getInternshipStats;


// ✅ Get InternshipType → College + Month Stats from detailedResponse (filter by current/requested month)
const getInternshipTypeColleges = async (req, res) => {
  try {
    const userId = req.query.userId; // optional
    let { fromDate, toDate } = req.query;

    const now = new Date();

    // ✅ Default to current month if no range provided
    if (!fromDate || !toDate) {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const formatDate = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      fromDate = formatDate(firstDay);
      toDate = formatDate(lastDay);
    }

    // ✅ Allowed months
    const allowedMonths = [
      "january", "february", "march", "april", "may", "june",
      "july", "august", "september", "october", "november", "december"
    ];

    // ✅ Current/requested month
    const currentMonth = new Date(fromDate).getMonth(); // 0-11
    const currentMonthName = allowedMonths[currentMonth];

    // ✅ Build where clause
    const whereClause = {
      dateOfConnect: {
        [Op.between]: [new Date(fromDate), new Date(toDate)],
      },
    };
    if (userId) whereClause.userId = userId;

    // ✅ Fetch records
    const records = await model.CoSheet.findAll({
      where: whereClause,
      attributes: ["internshipType", "collegeName", "detailedResponse", "jdSentAt"],
    });

    // ✅ Process each record
    const result = [];

    records.forEach((rec) => {
      const detailedResp = (rec.detailedResponse || "").toLowerCase();

      // Only include if the detailedResponse mentions the current/requested month
      if (!detailedResp.includes(currentMonthName)) return;

      result.push({
        collegeName: rec.collegeName || "Unknown",
        internshipType: (rec.internshipType || "others").toLowerCase(),
        monthMentioned: currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1),
        jdSent: rec.jdSentAt ? true : false,
      });
    });

    // ✅ Month label (for overall filter range)
    const monthLabel = new Date(fromDate).toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    });

    return ReS(
      res,
      {
        success: true,
        month: monthLabel,
        fromDate,
        toDate,
        data: result,
      },
      200
    );
  } catch (error) {
    console.error("InternshipType Colleges Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getInternshipTypeColleges = getInternshipTypeColleges;

// Delete a CoSheet row by ID
const deleteCoSheet = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return ReE(res, "CoSheet ID is required", 400);

    const record = await model.CoSheet.findByPk(id);
    if (!record) return ReE(res, "CoSheet record not found", 404);

    await record.destroy();
    return ReS(res, { success: true, message: "CoSheet deleted successfully" }, 200);
  } catch (error) {
    console.error("CoSheet Delete Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.deleteCoSheet = deleteCoSheet;