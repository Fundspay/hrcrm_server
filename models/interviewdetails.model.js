"use strict";
module.exports = (sequelize, Sequelize) => {
  const InterviewDetails = sequelize.define(
    "InterviewDetails",
    {
      interviewID: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      interviewedBy: { type: Sequelize.BIGINT, allowNull: false }, // FK -> User.id
      interviewDate: { type: Sequelize.DATE, allowNull: true },

      knowledge: { type: Sequelize.INTEGER, allowNull: true },
      approach: { type: Sequelize.INTEGER, allowNull: true },
      skills: { type: Sequelize.INTEGER, allowNull: true },
      others: { type: Sequelize.INTEGER, allowNull: true },

      averageScore: { type: Sequelize.FLOAT, allowNull: true },
      finalStatus: { type: Sequelize.STRING, allowNull: true },

      comments: { type: Sequelize.TEXT, allowNull: true },

      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    },
    { timestamps: true }
  );

  InterviewDetails.associate = function (models) {
    // Association without alias
    InterviewDetails.belongsTo(models.User, {
      foreignKey: "interviewedBy",
      targetKey: "id",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
  };

  return InterviewDetails;
};
