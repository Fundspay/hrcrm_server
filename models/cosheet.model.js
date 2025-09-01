"use strict";
module.exports = (sequelize, Sequelize) => {
    const CoSheet = sequelize.define(
        "CoSheet",
        {
            id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },

            // College details
            sr: { type: Sequelize.INTEGER, allowNull: true },
            collegeName: { type: Sequelize.STRING, allowNull: true },
            coordinatorName: { type: Sequelize.STRING, allowNull: true },
            mobileNumber: { type: Sequelize.STRING, allowNull: true },
            emailId: { type: Sequelize.STRING, allowNull: true },
            city: { type: Sequelize.STRING, allowNull: true },
            state: { type: Sequelize.STRING, allowNull: true },
            course: { type: Sequelize.STRING, allowNull: true },

            // Connect details
            connectedBy: { type: Sequelize.STRING, allowNull: true },
            dateOfConnect: { type: Sequelize.DATE, allowNull: true },
            callResponse: { type: Sequelize.STRING, allowNull: true },
            internshipType: { type: Sequelize.STRING, allowNull: true },
            detailedResponse: { type: Sequelize.STRING, allowNull: true },
            jdSentAt: { type: Sequelize.DATE, allowNull: true },

            // Resume Details
            followUpBy: { type: Sequelize.STRING, allowNull: true },
            followUpDate: { type: Sequelize.DATE, allowNull: true },
            followUpResponse: { type: Sequelize.STRING, allowNull: true },
            resumeDate: { type: Sequelize.DATE, allowNull: true },
            resumeCount: { type: Sequelize.INTEGER, allowNull: true },
            expectedResponseDate: { type: Sequelize.DATE, allowNull: true },
            followupemailsent: { type: Sequelize.BOOLEAN, allowNull: true },

            // Foreign key to User
            userId: { type: Sequelize.BIGINT, allowNull: true },

            isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        },
        { timestamps: true }
    );

    CoSheet.associate = function (models) {
        CoSheet.belongsTo(models.User, {
            foreignKey: "userId",
            onDelete: "SET NULL",
            onUpdate: "CASCADE",
        });
    };

    return CoSheet;
};
