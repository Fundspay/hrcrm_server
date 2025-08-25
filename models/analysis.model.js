"use strict";
module.exports = (sequelize, Sequelize) => {
  const DailyConnectAnalysis = sequelize.define(
    "DailyConnectAnalysis",
    {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      day: { type: Sequelize.STRING, allowNull: false },
      userId: { type: Sequelize.BIGINT, allowNull: false }, // HR
      jdCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    },
    { timestamps: true }
  );

  DailyConnectAnalysis.associate = function (models) {
    DailyConnectAnalysis.belongsTo(models.User, {
      foreignKey: "userId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      constraints: true,
    });

    DailyConnectAnalysis.belongsTo(models.MyTarget, {
      foreignKey: "userId", // link by userId for target
      targetKey: "userId",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
  };

  return DailyConnectAnalysis;
};
