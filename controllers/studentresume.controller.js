"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op, fn, col } = require("sequelize");
const { sendMail } = require("../middleware/mailer.middleware");


// Allowed values
const allowedInternshipTypes = ["fulltime", "parttime", "sip", "liveproject", "wip", "others"];
const allowedCourses = ["mba", "pgdm", "mba+pgdm", "bba/bcom", "engineering", "other"];

const createResume = async (req, res) => {
  try {
    const dataArray = Array.isArray(req.body) ? req.body : [req.body];

    // ✅ Resolve userId (if missing, accept null)
    const userId = req.body.userId ?? req.user?.id ?? null;

    // ✅ Find coSheetId (null if not found or no userId)
    let coSheetId = null;
    if (userId) {
      try {
        const coSheet = await model.CoSheet.findOne({ where: { userId } });
        if (coSheet) coSheetId = coSheet.id;
      } catch (err) {
        console.warn("CoSheet lookup failed:", err.message);
      }
    }

    // ✅ Prepare payloads (accept whatever comes in)
    const payloads = dataArray.map(data => ({
      sr: data.sr ?? null,
      resumeDate: data.resumeDate ?? null,
      collegeName: data.collegeName ?? null,
      course: data.course ?? null,
      internshipType: data.internshipType ?? null,
      followupBy: data.followupBy ?? null,
      studentName: data.studentName ?? null,
      mobileNumber: data.mobileNumber ?? null,
      emailId: data.emailId ?? null,
      domain: data.domain ?? null,
      interviewDate: data.interviewDate ?? null,
      dateOfOnboarding: data.dateOfOnboarding ?? null,
      coSheetId: coSheetId,
      userId: userId,
    }));

    // ✅ Bulk insert (NO duplicate check, accept everything)
    let records = [];
    try {
      records = await model.StudentResume.bulkCreate(payloads, {
        returning: true,
      });
    } catch (err) {
      console.error("Bulk insert failed:", err.message);
    }

    // ✅ Always respond 200, never throw 400/500
    return res.status(200).json({
      success: true,
      inserted: records.length,
      totalSent: payloads.length,
    });

  } catch (error) {
    console.error("StudentResume Create Error:", error);

    // ✅ Still return 200 OK
    return res.status(200).json({
      success: false,
      inserted: 0,
      totalSent: Array.isArray(req.body) ? req.body.length : 1,
      warning: error.message,
    });
  }
};

module.exports.createResume = createResume;


// ✅ Update Resume Record
const updateResume = async (req, res) => {
  try {
    const record = await model.StudentResume.findByPk(req.params.id);
    if (!record) return ReE(res, "Resume record not found", 404);

    const updates = {};
    const allowedFields = [
      "sr", "resumeDate", "collegeName", "course", "internshipType",
      "followupBy", "studentName", "mobileNumber", "emailId",
      "domain", "interviewDate", "userId", "dateOfOnboarding"
    ];

    for (let f of allowedFields) {
      if (req.body[f] !== undefined) {
        if (f === "internshipType") {
          const val = req.body[f]?.toLowerCase();
          if (val && !allowedInternshipTypes.includes(val)) {
            return ReE(res, `Invalid internshipType. Allowed: ${allowedInternshipTypes.join(", ")}`, 400);
          }
          updates[f] = val;
        } else if (f === "course") {
          const val = req.body[f]?.toLowerCase();
          if (val && !allowedCourses.includes(val)) {
            return ReE(res, `Invalid course. Allowed: ${allowedCourses.join(", ")}`, 400);
          }
          updates[f] = val;
        } else {
          updates[f] = req.body[f];
        }
      }
    }

    // ✅ Always ensure coSheetId matches userId (from updates or existing record)
    const effectiveUserId = updates.userId ?? record.userId;
    if (effectiveUserId) {
      const coSheet = await model.CoSheet.findOne({ where: { userId: effectiveUserId } });
      updates.coSheetId = coSheet ? coSheet.id : null;
    }

    if (!Object.keys(updates).length) {
      return ReE(res, "No fields to update", 400);
    }

    await record.update(updates);
    return ReS(res, { success: true, data: record }, 200);

  } catch (error) {
    console.error("StudentResume Update Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.updateResume = updateResume;


// ✅ List all resumes
const listResumes = async (req, res) => {
  try {
    // Fetch all resumes with associated CoSheet data
    const records = await model.StudentResume.findAll({
      include: [
        { model: model.CoSheet, attributes: ["id", "collegeName"] }
      ],
      order: [["createdAt", "DESC"]],
    });

    // Fetch all users separately
    const users = await model.User.findAll({
      attributes: ["id", "firstName", "lastName", "email"],
      raw: true,
    });

    return ReS(res, { success: true, data: records, users }, 200);
  } catch (error) {
    console.error("StudentResume List Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.listResumes = listResumes;

// ✅ Delete resume by ID
const deleteResume = async (req, res) => {
  try {
    const record = await model.StudentResume.findByPk(req.params.id);
    if (!record) return ReE(res, "Resume not found", 404);

    await record.destroy();

    return ReS(res, { success: true, message: "Resume deleted successfully" }, 200);
  } catch (error) {
    console.error("StudentResume Delete Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.deleteResume = deleteResume;

const getCollegeAnalysis = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;
    if (!userId) return ReE(res, "UserId is required", 400);

    // Join StudentResume with CoSheet (only to fetch resumeDate)
    const resumes = await model.StudentResume.findAll({
      where: { userId: userId },
      attributes: ["id", "studentName", "collegeName", "interviewDate","resumeDate"],
      order: [["collegeName", "ASC"]],
    });

    if (!resumes.length) return ReS(res, [], 200);

    // Group by StudentResume.collegeName
    const grouped = {};
    resumes.forEach((r) => {
      const college = r.collegeName || "Unknown College";

      if (!grouped[college]) {
        grouped[college] = {
          collegeName: college,
          numberOfStudentResumes: 0,
          resumeDates: [],
          interviewDates: [],
        };
      }

      grouped[college].numberOfStudentResumes += 1;

      // ✅ resumeDate from CoSheet
      if (r.resumeDate) {
        const formatted = new Date(r.resumeDate).toLocaleDateString("en-GB");
        if (!grouped[college].resumeDates.includes(formatted)) {
          grouped[college].resumeDates.push(formatted);
        }
      }

      // ✅ interviewDate from StudentResume
      if (r.interviewDate) {
        const formatted = new Date(r.interviewDate).toLocaleDateString("en-GB");
        grouped[college].interviewDates.push(formatted);
      }
    });

    // Format response
    const result = Object.values(grouped).map((g, index) => ({
      sr: index + 1,
      collegeName: g.collegeName,
      numberOfStudentResumes: g.numberOfStudentResumes,
      dateOfResumesReceived: g.resumeDates.map((d, i) => `${i + 1}. ${d}`),
      dateOfInterviewsScheduled: g.interviewDates.map((d, i) => `${i + 1}. ${d}`),
    }));

    return ReS(res, result, 200);
  } catch (error) {
    console.error("College Analysis Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getCollegeAnalysis = getCollegeAnalysis;

const getDailyCalendarAnalysis = async (req, res) => {
  try {
    const { fromDate, toDate, userId } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, error: "userId is required" });
    }

    // Default date range → current month
    let startDate = fromDate
      ? new Date(fromDate)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    let endDate = toDate
      ? new Date(toDate)
      : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

    // ✅ Fetch resumes (from StudentResume)
    const resumes = await model.StudentResume.findAll({
      where: {
        userId,
        resumeDate: { [Op.between]: [startDate, endDate] }
      },
      attributes: [
        [literal(`DATE("resumeDate")`), "date"], // ✅ force DB DATE, no timezone shift
        "collegeName",
        [fn("COUNT", col("id")), "resumeCount"]
      ],
      group: ["date", "collegeName"],
      raw: true
    });

    // ✅ Fetch interviews (from StudentResume)
    const interviews = await model.StudentResume.findAll({
      where: {
        userId,
        interviewDate: { [Op.between]: [startDate, endDate] }
      },
      attributes: [
        [literal(`DATE("interviewDate")`), "date"], // ✅ force DB DATE
        "collegeName",
        [fn("COUNT", col("id")), "interviewCount"]
      ],
      group: ["date", "collegeName"],
      raw: true
    });

    // ✅ Merge data into calendar format
    const map = {};

    resumes.forEach(r => {
      const date = r.date;
      if (!map[date]) {
        map[date] = {
          date,
          day: new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" }), // ✅ fix timezone shift
          resumesReceived: 0,
          resumesColleges: [],
          interviewsScheduled: 0,
          interviewsColleges: []
        };
      }
      map[date].resumesReceived += parseInt(r.resumeCount);
      map[date].resumesColleges.push(
        `${map[date].resumesColleges.length + 1}. ${r.collegeName} (${r.resumeCount})`
      );
    });

    interviews.forEach(i => {
      const date = i.date;
      if (!map[date]) {
        map[date] = {
          date,
          day: new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" }), // ✅ fix timezone shift
          resumesReceived: 0,
          resumesColleges: [],
          interviewsScheduled: 0,
          interviewsColleges: []
        };
      }
      map[date].interviewsScheduled += parseInt(i.interviewCount);
      map[date].interviewsColleges.push(
        `${map[date].interviewsColleges.length + 1}. ${i.collegeName} (${i.interviewCount})`
      );
    });

    // ✅ Convert map → sorted array
    const result = Object.values(map).sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error("Error in Daily Calendar Analysis:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports.getDailyCalendarAnalysis = getDailyCalendarAnalysis;


const getUserWorkAnalysis = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    // Build where clause dynamically
    let whereClause = {};
    if (fromDate && toDate) {
      whereClause.resumeDate = {
        [Op.between]: [new Date(fromDate), new Date(toDate)],
      };
    }

    // Fetch resumes + CoSheet info
    const resumes = await model.StudentResume.findAll({
      where: whereClause,
      include: [
        {
          model: model.CoSheet,
          attributes: ["collegeName"], // only use collegeName from CoSheet if available
        },
      ],
    });

    // Group by followUpBy
    const analysis = {};
    resumes.forEach((resume) => {
      const followupBy = resume.followupBy || "Unknown";

      if (!analysis[followupBy]) {
        analysis[followupBy] = {
          followupBy,
          colleges: new Map(),
          totalResumes: 0,
          onboardingDates: [],
        };
      }

      // prefer CoSheet.collegeName if present, else fallback to StudentResume.collegeName
      const collegeName =
        resume.CoSheet?.collegeName || resume.collegeName || "Unknown College";

      const resumeDate = resume.resumeDate
        ? resume.resumeDate.toISOString().split("T")[0]
        : null;

      // since resumeCount column does not exist, default each row to 1
      const resumeCount = 1;

      // increment counts
      if (!analysis[followupBy].colleges.has(collegeName)) {
        analysis[followupBy].colleges.set(collegeName, 0);
      }
      analysis[followupBy].colleges.set(
        collegeName,
        analysis[followupBy].colleges.get(collegeName) + resumeCount
      );

      analysis[followupBy].totalResumes += resumeCount;

      if (resumeDate) {
        analysis[followupBy].onboardingDates.push(`${resumeDate} (${resumeCount})`);
      }
    });

    // Format response
    const result = Object.values(analysis).map((item, index) => ({
      sr: index + 1,
      followupBy: item.followupBy,
      countOfColleges: item.colleges.size,
      totalResumes: item.totalResumes,
      collegeName: Array.from(item.colleges.entries()).map(
        ([name, count], idx) => `${idx + 1}. ${name} (${count})`
      ),
      dateOfOnboarding: [...new Set(item.onboardingDates)],
    }));

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error in getUserWorkAnalysis:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports.getUserWorkAnalysis = getUserWorkAnalysis;


const getRAnalysis = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    let whereClause = {};
    if (fromDate && toDate) {
      whereClause.resumeDate = {
        [Op.between]: [new Date(fromDate), new Date(toDate)],
      };
    }

    // Fetch resumes + CoSheet info
    const resumes = await model.StudentResume.findAll({
      where: whereClause,
      include: [{ model: model.CoSheet, attributes: ["collegeName"] }],
    });

    // Totals
    const totalResumes = resumes.length;
    const totalInterviews = resumes.filter((r) => r.interviewDate).length;

    // College responses (unique colleges that submitted resumes)
    const collegeSet = new Set(
      resumes.map((r) => r.CoSheet?.collegeName || r.collegeName || "Unknown College")
    );
    const totalColleges = collegeSet.size;
    const avgResponsePerCollege =
      totalColleges > 0 ? parseFloat((totalResumes / totalColleges).toFixed(1)) : 0;

    // Group by followUpBy (user wise performance)
    const userStats = {};
    resumes.forEach((r) => {
      const user = r.followupBy || "Individual";
      userStats[user] = (userStats[user] || 0) + 1;
    });

    // Sort users by performance
    const sortedUsers = Object.entries(userStats).sort((a, b) => b[1] - a[1]);

    const topPerformers = [];
    const lowPerformers = [];

    sortedUsers.forEach(([name, count], idx) => {
      if (idx < 3) topPerformers.push(`${idx + 1}. ${name} (${count})`);
    });

    sortedUsers
      .slice(-3)
      .forEach(([name, count], idx) => {
        // Only include in lowPerformers if not already in topPerformers
        if (!topPerformers.some((s) => s.includes(name))) {
          lowPerformers.push(`${idx + 1}. ${name} (${count})`);
        }
      });

    return res.json({
      success: true,
      data: {
        totalResumesReceived: totalResumes,
        totalInterviewsScheduled: totalInterviews,
        totalCollegesResponses: totalColleges,
        averageResponsePerCollege: avgResponsePerCollege,
        topPerformers,
        lowPerformers,
      },
    });
  } catch (error) {
    console.error("Error in getRAnalysis:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports.getRAnalysis = getRAnalysis;

// ✅ List resumes by userId with user info and total count
const listResumesByUserId = async (req, res) => {
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
    const fullName = `${firstName} ${lastName}`.trim();

    // 🔹 Step 2: Fetch StudentResume entries where followupBy matches fullName or firstName (case-insensitive)
    const resumes = await model.StudentResume.findAll({
      where: {
        userId,
        [Op.or]: [
          { followupBy: { [Op.iLike]: fullName } },
          { followupBy: { [Op.iLike]: firstName } },
        ],
      },
      order: [["createdAt", "ASC"]],
      raw: true,
    });

    // 🔹 Step 3: Fetch all users for reference
    const users = await model.User.findAll({
      attributes: ["id", "firstName", "lastName", "email"],
      raw: true,
    });

    const userList = users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      fullName: `${u.firstName?.trim() || ""} ${u.lastName?.trim() || ""}`.trim(),
      email: u.email,
    }));

    return ReS(res, {
      success: true,
      userId,
      followUpBy: fullName,
      totalRecords: resumes.length,
      data: resumes,
      users: userList,
    });
  } catch (error) {
    console.error("ListResumes Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.listResumesByUserId = listResumesByUserId;


const getUserTargetAnalysis = async (req, res) => {
  try {
    const { fromDate, toDate, userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, error: "userId is required" });

    let startDate = fromDate ? new Date(fromDate) : new Date();
    startDate.setHours(0, 0, 0, 0);
    let endDate = toDate ? new Date(toDate) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const resumes = await model.StudentResume.findAll({
      where: {
        userId,
        resumeDate: { [Op.between]: [startDate, endDate] },
      },
      attributes: ["followupBy", "resumeDate", "interviewDate", "collegeName"],
      raw: true, // make it easier to work with plain objects
    });

    const targets = await model.MyTarget.findAll({
      where: {
        userId,
        targetDate: { [Op.between]: [startDate, endDate] },
      },
      attributes: [
        [fn("SUM", col("collegeTarget")), "collegeTarget"],
        [fn("SUM", col("interviewsTarget")), "interviewsTarget"],
        [fn("SUM", col("resumesReceivedTarget")), "resumesReceivedTarget"],
      ],
      raw: true,
    });

    const targetData = targets[0] || {
      collegeTarget: 0,
      interviewsTarget: 0,
      resumesReceivedTarget: 0,
    };

    const achieved = {};

    resumes.forEach((resume) => {
      const key = (resume.followupBy || "Unknown").trim().toLowerCase();
      const displayName = resume.followupBy || "Unknown";

      if (!achieved[key]) {
        achieved[key] = {
          followupBy: displayName,
          collegesAchieved: new Set(),
          resumesAchieved: 0,
          interviewsAchieved: 0,
          resumeDates: [],
          interviewDates: [],
        };
      }

      if (resume.collegeName) achieved[key].collegesAchieved.add(resume.collegeName);

      achieved[key].resumesAchieved += 1;

      if (resume.resumeDate) {
        const formattedResumeDate = new Date(resume.resumeDate).toLocaleDateString("en-GB", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
        });
        achieved[key].resumeDates.push(formattedResumeDate);
      }

      if (resume.interviewDate) {
        const formattedInterviewDate = new Date(resume.interviewDate).toLocaleDateString("en-GB", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
        });
        achieved[key].interviewDates.push(formattedInterviewDate);
        achieved[key].interviewsAchieved += 1;
      }
    });

    const result = Object.values(achieved).map((item) => ({
      followupBy: item.followupBy,
      collegeTarget: Number(targetData.collegeTarget),
      collegesAchieved: item.collegesAchieved.size,
      interviewsTarget: Number(targetData.interviewsTarget),
      interviewsAchieved: item.interviewsAchieved,
      resumesReceivedTarget: Number(targetData.resumesReceivedTarget),
      resumesAchieved: item.resumesAchieved,
      resumeDates: item.resumeDates,
      interviewDates: item.interviewDates,
    }));

    return res.json({ success: true, data: result.length ? result : [{
      followupBy: "N/A",
      collegeTarget: Number(targetData.collegeTarget),
      collegesAchieved: 0,
      interviewsTarget: Number(targetData.interviewsTarget),
      interviewsAchieved: 0,
      resumesReceivedTarget: Number(targetData.resumesReceivedTarget),
      resumesAchieved: 0,
      resumeDates: [],
      interviewDates: [],
    }]});
  } catch (error) {
    console.error("Error in getUserTargetAnalysis:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports.getUserTargetAnalysis = getUserTargetAnalysis;


const sendMailToStudent = async (req, res) => {
  try {
    const { id } = req.params; // studentResumeId
    const { type, customMessage, time, link } = req.body;

    // Fetch student details
    const student = await model.StudentResume.findByPk(id);
    if (!student) return ReE(res, "Student record not found", 404);

    if (!student.emailId) {
      return ReE(res, "No email found for this student", 400);
    }

    // Use interviewDate from the model
    const interviewDate = student.interviewDate
      ? new Date(student.interviewDate).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : "TBD";

    // Subject line
    const subject = "Pre-Placement Talk & Telephonic Interview – FundsAudit";

    // Student-facing HTML template
    const hardcodedHtml = `
      <p>Dear ${student.studentName || "Student"},</p>

      <p>As discussed on telephonic conversation,</p>

      <p>This is to inform you that the <b>Pre-Placement Talk</b> is scheduled on <b>${interviewDate}</b> at <b>${time}</b>.</p>

      <p>After the Pre-Placement Talk, Telephonic Interviews will be conducted for shortlisted students.</p>

      <p>📅 <b>Meeting Date:</b> ${interviewDate}<br/>
      🕚 <b>Timing:</b> ${time}<br/>
      🔗 <b>Link:</b> <a href="${link}">${link}</a></p>

      <p>Please ensure your attendance at the Pre-Placement Talk. Only students attending the talk will be eligible for the Telephonic Interview round.</p>

      <p>Looking forward to your participation.</p>

      <p>Regards,<br/>
      HR Department,<br/>
      FundsAudit<br/>
      +91 7385234536<br/>
      +91 7420861507<br/>
      Pune, Maharashtra<br/>
      <a href="https://www.fundsaudit.in/">https://www.fundsaudit.in/</a>
      </p>
    `;

    // Choose between hardcoded or custom
    const html = type === "custom" ? customMessage : hardcodedHtml;

    // Send email
    const mailResponse = await sendMail(student.emailId, subject, html);

    if (!mailResponse.success) {
      return ReE(res, "Failed to send email to student", 500);
    }
    // Update email sent time and interview time
    await student.update({
      mailSentAt: new Date(),
      interviewTime: time || student.interviewTime,
    });

    return ReS(res, { success: true, message: "Email sent successfully to student" }, 200);
  } catch (error) {
    console.error("Send Student Mail Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.sendMailToStudent = sendMailToStudent;

const getUserResumesAchieved = async (req, res) => {
  try {
    const { fromDate, toDate, userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, error: "userId is required" });

    // ---- Get user full name ----
    const user = await model.User.findOne({
      where: { id: userId },
      attributes: ["firstName", "lastName"],
      raw: true,
    });
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    const firstName = user.firstName.trim();
    const lastName = user.lastName ? user.lastName.trim() : "";
    const fullName = `${firstName} ${lastName}`.trim();

    // ---- Date Range Handling ----
    let dateFilter = {};
    if (fromDate && toDate) {
      const startDate = new Date(fromDate);
      const endDate = new Date(toDate);
      dateFilter = { resumeDate: { [Op.between]: [startDate, endDate] } };
    }
    // if no fromDate/toDate, leave dateFilter empty to get all records

    // ---- Fetch resumes matching user's name ----
    const resumes = await model.StudentResume.findAll({
      where: {
        userId,
        [Op.or]: [
          { followupBy: { [Op.iLike]: fullName } },
          { followupBy: { [Op.iLike]: firstName } },
        ],
        ...dateFilter,
      },
      raw: true,
    });

    // ---- Fetch all users ----
    const users = await model.User.findAll({
      attributes: ["id", "firstName", "lastName", "email"],
      raw: true,
    });

    return res.json({
      success: true,
      resumesAchieved: resumes.length,
      resumesData: resumes,
      users,
    });
  } catch (error) {
    console.error("Error in getUserResumesAchieved:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports.getUserResumesAchieved = getUserResumesAchieved;

const getUserInterviewsAchieved = async (req, res) => {
  try {
    const { fromDate, toDate, userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, error: "userId is required" });

    // ---- Get user full name ----
    const user = await model.User.findOne({
      where: { id: userId },
      attributes: ["firstName", "lastName"],
      raw: true,
    });
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    const firstName = user.firstName.trim();
    const lastName = user.lastName ? user.lastName.trim() : "";
    const fullName = `${firstName} ${lastName}`.trim();

    // ---- Date Range Handling ----
    let dateFilter = {};
    if (fromDate && toDate) {
      const startDate = new Date(fromDate);
      const endDate = new Date(toDate);
      dateFilter = { resumeDate: { [Op.between]: [startDate, endDate] } };
    }

    // ---- Fetch interviews matching user's name ----
    const interviews = await model.StudentResume.findAll({
      where: {
        userId,
        [Op.or]: [
          { followupBy: { [Op.iLike]: fullName } },
          { followupBy: { [Op.iLike]: firstName } },
        ],
        interviewDate: { [Op.ne]: null },
        ...dateFilter,
      },
      raw: true,
    });

    // ---- Fetch all users ----
    const users = await model.User.findAll({
      attributes: ["id", "firstName", "lastName", "email"],
      raw: true,
    });

    return res.json({
      success: true,
      interviewsAchieved: interviews.length,
      interviewsData: interviews,
      users,
    });
  } catch (error) {
    console.error("Error in getUserInterviewsAchieved:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports.getUserInterviewsAchieved = getUserInterviewsAchieved;


const listResumesByUserIdfuture = async (req, res) => {
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
    const fullName = `${firstName} ${lastName}`.trim();

    // 🔹 Step 2: Define tomorrow's date for filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0); // today's start
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // 🔹 Step 3: Fetch future StudentResume entries
    const resumes = await model.StudentResume.findAll({
      where: {
        userId,
        [Op.or]: [
          { followUpBy: { [Op.iLike]: fullName } },
          { followUpBy: { [Op.iLike]: firstName } },
        ],
        resumeDate: { [Op.gte]: tomorrow }, // only future dates
      },
      order: [["resumeDate", "ASC"]],
      raw: true,
    });

    return ReS(res, {
      success: true,
      userId,
      followUpBy: fullName,
      totalRecords: resumes.length,
      data: resumes,
    });
  } catch (error) {
    console.error("ListResumes Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.listResumesByUserIdfuture = listResumesByUserIdfuture;
