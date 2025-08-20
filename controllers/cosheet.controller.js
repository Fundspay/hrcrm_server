"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");

// Create / Upload CoSheet (Excel JSON)
const createCoSheet = async (req, res) => {
  try {
    const dataArray = Array.isArray(req.body) ? req.body : [req.body];
    if (!dataArray.length) return ReE(res, "No data provided", 400);

    const results = await Promise.all(
      dataArray.map(async (data) => {
        try {
          const payload = {
            sr: data.collegeDetails?.sr ?? data.sr ?? null,
            collegeName: data.collegeDetails?.collegeName ?? data.collegeName ?? null,
            coordinatorName: data.collegeDetails?.coordinatorName ?? data.coordinatorName ?? null,
            mobileNumber: data.collegeDetails?.mobileNumber ?? data.mobileNumber ?? null,
            emailId: data.collegeDetails?.emailId ?? data.emailId ?? null,
            city: data.collegeDetails?.city ?? data.city ?? null,
            state: data.collegeDetails?.state ?? data.state ?? null,
            course: data.collegeDetails?.course ?? data.course ?? null,
            connectedBy: data.connect?.connectedBy ?? data.connectedBy ?? null,
            dateOfConnect: data.connect?.dateOfConnect ?? data.dateOfConnect ?? null,
            callResponse: data.connect?.callResponse ?? data.callResponse ?? null,
            internshipType: data.connect?.internshipType ?? data.internshipType ?? null,
            detailedResponse: data.connect?.detailedResponse ?? data.detailedResponse ?? null,
          };

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

// Update Connect Fields
const updateConnectFields = async (req, res) => {
  try {
    const record = await model.CoSheet.findByPk(req.params.id);
    if (!record) return ReE(res, "CoSheet record not found", 404);

    const connectFields = ['connectedBy','dateOfConnect','callResponse','internshipType','detailedResponse'];
    const updates = {};
    connectFields.forEach(f => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    if (!Object.keys(updates).length) return ReE(res, "No fields to update", 400);

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
