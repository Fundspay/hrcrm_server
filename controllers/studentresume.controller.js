"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op, fn, col, literal } = require("sequelize");

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
          const userId = data.UserId ?? req.user?.id;
          if (!userId) {
            return { success: false, error: "UserId is required" };
          }

          // Find coSheetId for that user
          const coSheet = await model.CoSheet.findOne({ where: { userId } });
          const coSheetId = coSheet ? coSheet.id : null;

          // Validate internshipType
          if (data.internshipType && !allowedInternshipTypes.includes(data.internshipType.toLowerCase())) {
            return { success: false, error: `Invalid internshipType. Allowed: ${allowedInternshipTypes.join(", ")}` };
          }

          // Validate course
          if (data.course && !allowedCourses.includes(data.course.toLowerCase())) {
            return { success: false, error: `Invalid course. Allowed: ${allowedCourses.join(", ")}` };
          }

          const payload = {
            sr: data.sr ?? null,
            resumeDate: data.resumeDate ?? null,
            collegeName: data.collegeName ?? null,
            course: data.course ? data.course.toLowerCase() : null,
            internshipType: data.internshipType ? data.internshipType.toLowerCase() : null,
            followupBy: data.followupBy ?? null,
            studentName: data.studentName ?? null,
            mobileNumber: data.mobileNumber ?? null,
            emailId: data.emailId ?? null,
            domain: data.domain ?? null,
            interviewDate: data.interviewDate ?? null,
            Dateofonboarding: data.Dateofonboarding ?? null,
            coSheetId,
            UserId: userId,
          };

          const record = await model.StudentResume.create(payload);
          return { success: true, data: record };
        } catch (err) {
          console.error("Single StudentResume create failed:", err);
          return { success: false, error: err.message };
        }
      })
    );

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
      "domain", "interviewDate", "UserId", "Dateofonboarding"
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

    // ✅ If UserId updated, recalculate coSheetId
    if (updates.UserId) {
      const coSheet = await model.CoSheet.findOne({ where: { userId: updates.UserId } });
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
        { model: model.User, attributes: ["id", "name", "email"] },
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


// ✅ List resumes by UserId
const listResumesByUserId = async (req, res) => {
  try {
    const userId = req.params.userId ?? req.user?.id;
    if (!userId) return ReE(res, "UserId is required", 400);

    const records = await model.StudentResume.findAll({
      where: { UserId: userId },
      include: [
        { model: model.CoSheet, attributes: ["id", "collegeName"] },
        { model: model.User, attributes: ["id", "name", "email"] },
      ],
      order: [["createdAt", "DESC"]],
    });

    return ReS(res, { success: true, data: records }, 200);
  } catch (error) {
    console.error("StudentResume ListByUser Error:", error);
    return ReE(res, error.message, 500);
  }
};
module.exports.listResumesByUserId = listResumesByUserId;


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
      include: [
        {
          model: model.CoSheet,
          attributes: ["resumeDate"], // only resumeDate needed
        },
      ],
      where: { UserId: userId },
      attributes: ["id", "studentName", "collegeName", "interviewDate"],
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
      if (r.CoSheet?.resumeDate) {
        const formatted = new Date(r.CoSheet.resumeDate).toLocaleDateString("en-GB");
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
    let startDate = fromDate ? new Date(fromDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    let endDate = toDate ? new Date(toDate) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

    // ✅ Fetch resumes (from StudentResume)
    const resumes = await StudentResume.findAll({
      where: {
        userId,
        resumeDate: { [Op.between]: [startDate, endDate] }
      },
      attributes: [
        [fn("DATE", col("resumeDate")), "date"],
        "collegeName",
        [fn("COUNT", col("id")), "resumeCount"]
      ],
      group: ["date", "collegeName"],
      raw: true
    });

    // ✅ Fetch interviews (from StudentResume)
    const interviews = await StudentResume.findAll({
      where: {
        userId,
        interviewDate: { [Op.between]: [startDate, endDate] }
      },
      attributes: [
        [fn("DATE", col("interviewDate")), "date"],
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
          day: new Date(date).toLocaleDateString("en-US", { weekday: "long" }),
          resumesReceived: 0,
          resumesColleges: [],
          interviewsScheduled: 0,
          interviewsColleges: []
        };
      }
      map[date].resumesReceived += parseInt(r.resumeCount);
      map[date].resumesColleges.push(`${map[date].resumesColleges.length + 1}. ${r.collegeName} (${r.resumeCount})`);
    });

    interviews.forEach(i => {
      const date = i.date;
      if (!map[date]) {
        map[date] = {
          date,
          day: new Date(date).toLocaleDateString("en-US", { weekday: "long" }),
          resumesReceived: 0,
          resumesColleges: [],
          interviewsScheduled: 0,
          interviewsColleges: []
        };
      }
      map[date].interviewsScheduled += parseInt(i.interviewCount);
      map[date].interviewsColleges.push(`${map[date].interviewsColleges.length + 1}. ${i.collegeName} (${i.interviewCount})`);
    });

    // ✅ Convert map → sorted array
    const result = Object.values(map).sort((a, b) => new Date(a.date) - new Date(b.date));

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
    const resumes = await StudentResume.findAll({
      where: whereClause,
      include: [
        {
          model: CoSheet,
          attributes: ["collegeName", "followUpBy", "resumeDate", "resumeCount"],
        },
      ],
    });

    // Group by followUpBy (user who onboarded)
    const analysis = {};
    resumes.forEach((resume) => {
      const followupBy = resume.CoSheet?.followUpBy || "Unknown";

      if (!analysis[followupBy]) {
        analysis[followupBy] = {
          followupBy,
          colleges: new Map(), // use map for unique colleges
          totalResumes: 0,
          collegeNames: [],
          onboardingDates: [],
        };
      }

      // Track colleges and resumes
      const collegeName = resume.CoSheet?.collegeName || resume.collegeName || "Unknown College";
      const resumeDate = resume.resumeDate ? resume.resumeDate.toISOString().split("T")[0] : null;

      // If college not already added, add it
      if (!analysis[followupBy].colleges.has(collegeName)) {
        analysis[followupBy].colleges.set(collegeName, 0);
      }

      // Increment resume count for that college
      analysis[followupBy].colleges.set(
        collegeName,
        analysis[followupBy].colleges.get(collegeName) + 1
      );

      analysis[followupBy].totalResumes += 1;

      // Collect onboarding date (resumeDate from CoSheet/StudentResume)
      if (resumeDate) {
        analysis[followupBy].onboardingDates.push(`${resumeDate} (${1})`);
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
      dateOfOnboarding: [...new Set(item.onboardingDates)], // unique dates
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

    // Fetch resumes + their CoSheet info
    const resumes = await StudentResume.findAll({
      where: whereClause,
      include: [{ model: CoSheet, attributes: ["collegeName", "followUpBy"] }],
    });

    // Totals
    const totalResumes = resumes.length;
    const totalInterviews = resumes.filter((r) => r.interviewDate).length;

    // College responses (unique colleges that submitted resumes)
    const collegeSet = new Set(resumes.map((r) => r.CoSheet?.collegeName || r.collegeName));
    const totalColleges = collegeSet.size;

    const avgResponsePerCollege = totalColleges > 0 ? (totalResumes / totalColleges).toFixed(1) : 0;

    // Group by followUpBy (user wise performance)
    const userStats = {};
    resumes.forEach((r) => {
      const user = r.CoSheet?.followUpBy || "Individual";

      if (!userStats[user]) userStats[user] = 0;
      userStats[user] += 1;
    });

    // Sort users by performance
    const sortedUsers = Object.entries(userStats).sort((a, b) => b[1] - a[1]);

    const topPerformers = sortedUsers.slice(0, 3).map(
      ([name, count], idx) => `${idx + 1}. ${name} (${count})`
    );
    const lowPerformers = sortedUsers.slice(-3).map(
      ([name, count], idx) => `${idx + 1}. ${name} (${count})`
    );

    // Final response
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
