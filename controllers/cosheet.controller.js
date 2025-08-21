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

            userId: data.userId ?? req.user?.id ?? null,

            // Optional: keep connectedBy for display only
            connectedBy: data.connect?.connectedBy ?? data.connectedBy ?? null,
          };

          if (!payload.userId) {
            return { success: false, error: "userId is required" };
          }

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

const updateConnectFields = async (req, res) => {
  try {
    const record = await model.CoSheet.findByPk(req.params.id);
    if (!record) return ReE(res, "CoSheet record not found", 404);

    // ✅ Now includes college details also
    const allowedFields = [
      // College details
      "sr",
      "collegeName",
      "coordinatorName",
      "mobileNumber",
      "emailId",
      "city",
      "state",
      "course",

      // Connect details
      "connectedBy",
      "dateOfConnect",
      "callResponse",
      "internshipType",
      "detailedResponse",
      "userId"
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
        } else if (f === "detailedResponse") {
          const detailed = req.body[f];
          updates[f] = detailed;

          if (detailed?.month) {
            const month = detailed.month.toLowerCase();
            if (!allowedMonths.includes(month)) {
              return ReE(res, "Invalid month in detailedResponse. Allowed: Jan–Dec", 400);
            }

            // Check if JD already sent for this college/month
            const jdExists = await model.CoSheet.findOne({
              where: {
                collegeName: updates.collegeName ?? record.collegeName,
                "detailedResponse.month": month,
                jdSent: true
              }
            });

            updates.jdSent = !!jdExists;
          }
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

// Get All CoSheets
const getCoSheets = async (req, res) => {
  try {
    const records = await model.CoSheet.findAll();
    return ReS(res, { success: true, data: records }, 200);
  } catch (error) {
    console.error("CoSheet Fetch All Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.getCoSheets = getCoSheets;

// Get Single CoSheet by ID
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
// Send JD to college email with detailed proposal
const sendJDToCollege = async (req, res) => {
  try {
    const { id } = req.params;
    const { cc, bcc } = req.body;

    const record = await model.CoSheet.findByPk(id);
    if (!record) return ReE(res, "CoSheet record not found", 404);

    if (!record.emailId) {
      return ReE(res, "No email found for this college", 400);
    }

    if (!record.internshipType) {
      return ReE(res, "No internshipType set for this record", 400);
    }

    // JD mapping
    const JD_MAP = {
      fulltime: "jds/fulltime.pdf",
      liveproject: "jds/liveproject.pdf",
      sip: "jds/sip.pdf",
      wip: "jds/wip.pdf",
      others: "jds/others.pdf",
    };

    const jdKeyType = record.internshipType
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
    const jdKey = JD_MAP[jdKeyType];

    if (!jdKey) {
      return ReE(res, `No JD mapped for internshipType: ${normalizedType}`, 400);
    }

    // fetch JD file from S3
    const jdFile = await s3
      .getObject({ Bucket: "fundsroomhr", Key: jdKey })
      .promise();

    const subject = `Collaboration Proposal for Live Projects, Internships & Placements – FundsAudit`;

    // HTML email body like your proposal
    const html = `
      <p>Respected ${record.coordinatorName || "Sir/Madam"},</p>

      <p>Warm greetings from FundsAudit!</p>

      <p>We are reaching out with an exciting collaboration opportunity for your institute ${record.collegeName ||
      ""}, aimed at enhancing student development through real-time industry exposure in the fintech space.</p>

      <p>Founded in 2020, FundsAudit is an ISO-certified, innovation-driven fintech startup, registered under the Startup India initiative with 400,000 active customers. We are members of AMFI, SEBI, BSE, and NSE. As part of our commitment to bridging the gap between academic learning and practical application, we propose a Student Development Program (SDP) for your MBA students (1st & 2nd year) specializing in Finance and Marketing.</p>

      <h4>Collaboration Proposal:</h4>
      <ul>
        <li><b>Flexible Participation:</b> 2-hour/day commitment (1 hour training + 1 hour individual work)</li>
        <li><b>Performance-Based Stipend:</b> INR 1,000 to INR 7,000 based on quality, innovation, and project delivery</li>
        <li><b>Value-Added Certifications:</b> Specialized certificates + POWER-Bi & Financial/Marketing Modelling certificate; recognition for top performers</li>
        <li><b>Open to:</b> MBA 1st & 2nd year students (Finance & Marketing)</li>
      </ul>

      <p>Next Steps: JD for the Internship is attached. If your institution is interested, we can formalize this collaboration by signing a Memorandum of Understanding (MoU). Upon signing, eligible students will be onboarded with orientation and training to commence the live project.</p>

      <p>As discussed on the call, kindly share your response by <b>23rd August 2025, 11 AM</b>. Preplacement interviews will be conducted on the same day, with joining on <b>25th August 2025</b>.</p>

      <p><b>Role:</b> Marketing Analyst & Financial Analyst<br/>
      <b>Eligibility:</b> Management Students</p>

      <p>Following the live project, students may also be considered for:</p>
      <ul>
        <li>Summer/Winter Internships</li>
        <li>Pre-placement offers (PPOs)</li>
        <li>Final placement opportunities</li>
      </ul>

      <p>Perks of the collaboration:</p>
      <ul>
        <li>Exposure to real-time fintech operations</li>
        <li>Skill development aligned with industry expectations</li>
        <li>Improved employability and practical insight alongside academics</li>
        <li>Final placement opportunities</li>
      </ul>

      <p>Looking forward to a meaningful and mutually beneficial association.</p>

      <p>Pooja M. Shedge<br/>
      Branch Manager – Pune<br/>
      +91 7385234536 | +91 7420861507<br/>
      Pune, Maharashtra<br/>
      <a href="https://www.fundsaudit.in/">https://www.fundsaudit.in/</a><br/>
      <a href="https://www.fundsweb.in/sub_sectors/subsector">https://www.fundsweb.in/sub_sectors/subsector</a>
      </p>
    `;

    // send mail with attachment + cc/bcc
    const mailResponse = await sendMail(
      record.emailId,
      subject,
      html,
      [
        {
          filename: `${record.internshipType}.pdf`,
          content: jdFile.Body,
        },
      ],
      cc,
      bcc
    );

    if (!mailResponse.success) {
      return ReE(res, "Failed to send JD email", 500);
    }

    await record.update({
      jdSentAt: new Date()
    });


    return ReS(res, { success: true, message: "JD sent successfully with proposal" }, 200);
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

    const monthLabel = new Date(fromDate).toLocaleString("en-US", { month: "long", year: "numeric" });

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
