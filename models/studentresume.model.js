"use strict";
module.exports = (sequelize, Sequelize) => {
    const StudentResume = sequelize.define(
        "StudentResume",
        {
            id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },

            // SR (serial no.)
            sr: { type: Sequelize.INTEGER, allowNull: true },

            // Resume details
            resumeDate: { type: Sequelize.DATE, allowNull: true },
            collegeName: { type: Sequelize.STRING, allowNull: true },
            course: { type: Sequelize.STRING, allowNull: true },
            internshipType: { type: Sequelize.STRING, allowNull: true },

            // Who followed up with the college
            followupBy: { type: Sequelize.STRING, allowNull: true },

            // Student details
            studentName: { type: Sequelize.STRING, allowNull: true }, 
            mobileNumber: { type: Sequelize.STRING, allowNull: true },
            emailId: { type: Sequelize.STRING, allowNull: true },
            domain: { type: Sequelize.STRING, allowNull: true }, 

            // Interview details
            interviewDate: { type: Sequelize.DATE, allowNull: true },

            // Foreign key (optional) → Link to CoSheet if needed
            coSheetId: { type: Sequelize.BIGINT, allowNull: true },
            Dateofonboarding: { type: Sequelize.DATE, allowNull: true },
            userId: { type: Sequelize.BIGINT, allowNull: true },
            mailSentAt: { type: Sequelize.DATE, allowNull: true },

            // Status fields
            isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        },
        { timestamps: true }
    );

    StudentResume.associate = function (models) {
     
        StudentResume.belongsTo(models.CoSheet, {
            foreignKey: "coSheetId",
            onDelete: "SET NULL",
            onUpdate: "CASCADE",
            constraints: true,
        });

        StudentResume.belongsTo(models.User, {
            foreignKey: "userId",
            onDelete: "SET NULL",
            onUpdate: "CASCADE",
            constraints: true,
        
        });
    };

    return StudentResume;
};
