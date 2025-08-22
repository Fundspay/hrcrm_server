"use strict";
module.exports = (sequelize, Sequelize) => {
  const InterviewAnalysis = sequelize.define(
    "InterviewAnalysis",
    {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },

      userId: { type: Sequelize.BIGINT, allowNull: false }, // FK → User.id
      totalInterviewsAllotted: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      month: { type: Sequelize.DATE, allowNull: false }, // first day of month
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    },
    { timestamps: true }
  );

  InterviewAnalysis.associate = function (models) {
    InterviewAnalysis.belongsTo(models.User, {
      foreignKey: "userId",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
      constraints: true,
    });
  };

  return InterviewAnalysis;
};
