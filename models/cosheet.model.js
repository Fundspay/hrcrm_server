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

            // Foreign key to User
            userId: { type: Sequelize.BIGINT, allowNull: true },

            isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        },
        { timestamps: true }
    );

    CoSheet.associate = function (models) {
        // CoSheet belongs to User
        CoSheet.belongsTo(models.User, {
            foreignKey: 'userId',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
            constraints: true
        });
    };

    return CoSheet;
};
