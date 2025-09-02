"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");

// Allowed values
const allowedInternshipTypes = ["fulltime", "parttime", "sip", "liveproject", "wip", "others"];
const allowedCourses = ["mba", "pgdm", "mba+pgdm", "bba/bcom", "engineering", "other"];

// ✅ Create Resume Record
const createResume = async (req, res) => {
  try {
    const dataArray = Array.isArray(req.body) ? req.body : [req.body];
    if (!dataArray.length) return ReE(res, "No data provided", 400);

    const results = await Promise.all(
      dataArray.map(async (data) => {
        try {
          const userId = data.userId ?? req.user?.id;
          if (!userId) {
            return { success: false, error: "userId is required" };
          }

          // ✅ Fetch only coSheetId for that user
          const coSheet = await model.CoSheet.findOne({
            where: { userId },
            attributes: ["id"],
          });

          if (!coSheet) {
            return { success: false, error: "No CoSheet found for this user" };
          }

          const coSheetId = coSheet.id;

          // ✅ Duplicate check (studentName + mobileNumber + emailId)
          const duplicate = await model.StudentResume.findOne({
            where: {
              userId,
              studentName: data.studentName ?? null,
              mobileNumber: data.mobileNumber ?? null,
              emailId: data.emailId ?? null,
            },
          });

          if (duplicate) {
            return {
              success: false,
              warning: "Duplicate record found. Skipped insert.",
              data: duplicate,
            };
          }

          // ✅ Build payload
          const payload = {
            sr: data.sr ?? null,
            resumeDate: data.resumeDate ?? null,
            collegeName: data.collegeName ?? null,
            course: data.course ?? null, // take as is
            internshipType: data.internshipType ?? null, // take as is
            followupBy: data.followupBy ?? null,
            studentName: data.studentName ?? null,
            mobileNumber: data.mobileNumber ?? null,
            emailId: data.emailId ?? null,
            domain: data.domain ?? null,
            interviewDate: data.interviewDate ?? null,
            dateOfOnboarding: data.dateOfOnboarding ?? null,
            coSheetId, // ✅ Always from CoSheet
            userId,
          };

          const record = await model.StudentResume.create(payload);
          return { success: true, data: record };
        } catch (err) {
          console.error("Single StudentResume create failed:", err);
          return { success: false, error: err.message };
        }
      })
    );

    // If all failed → 400
    const allFailed = results.every((r) => !r.success && !r.warning);
    if (allFailed) {
      return ReE(res, "All resume creations failed", 400);
    }

    return ReS(res, { success: true, data: results }, 201);
  } catch (error) {
    console.error("StudentResume Create Error:", error);
    return ReE(res, error.message, 500);
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
    const records = await model.StudentResume.findAll({
      include: [
        { model: model.CoSheet, attributes: ["id", "collegeName"] },
        { model: model.User, attributes: ["id"] },
      ],
      order: [["createdAt", "DESC"]],
    });

    return ReS(res, { success: true, data: records }, 200);
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

// ✅ List resumes by userId
const listResumesByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return ReE(res, "userId is required", 400);

    const resumes = await model.StudentResume.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
    });

    return ReS(res, { success: true, data: resumes }, 200);
  } catch (error) {
    console.error("ListResumes Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.listResumesByUserId = listResumesByUserId;



const getUserTargetAnalysis = async (req, res) => {
  try {
    const { fromDate, toDate, userId } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, error: "userId is required" });
    }

    // ---- Date Range Handling ----
    let startDate, endDate;
    if (fromDate && toDate) {
      startDate = new Date(fromDate);
      endDate = new Date(toDate);
    } else {
      // Default = today
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    }

    // ---- Fetch resumes ----
    const resumes = await model.StudentResume.findAll({
      where: {
        userId,
        resumeDate: { [Op.between]: [startDate, endDate] },
      },
      attributes: ["followupBy", "resumeDate", "interviewDate", "collegeName"],
    });

    // ---- Fetch Targets ----
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

    // ---- Group Achievements by followupBy ----
    const achieved = {};
    resumes.forEach((resume) => {
      const followupBy = resume.followupBy || "Unknown";

      if (!achieved[followupBy]) {
        achieved[followupBy] = {
          followupBy,
          collegesAchieved: new Set(),
          resumesAchieved: 0,
          interviewsAchieved: 0,
        };
      }

      if (resume.collegeName) {
        achieved[followupBy].collegesAchieved.add(resume.collegeName);
      }

      achieved[followupBy].resumesAchieved += 1;

      if (resume.interviewDate) {
        achieved[followupBy].interviewsAchieved += 1;
      }
    });

    // ---- Final Response ----
    const result = Object.values(achieved).map((item) => ({
      followupBy: item.followupBy,
      collegeTarget: Number(targetData.collegeTarget),
      collegesAchieved: item.collegesAchieved.size,
      interviewsTarget: Number(targetData.interviewsTarget),
      interviewsAchieved: item.interviewsAchieved,
      resumesReceivedTarget: Number(targetData.resumesReceivedTarget),
      resumesAchieved: item.resumesAchieved,
    }));

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error in getUserWorkAnalysis:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports.getUserTargetAnalysis = getUserTargetAnalysis;
