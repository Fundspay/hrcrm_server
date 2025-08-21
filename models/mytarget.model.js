"use strict";
module.exports = (sequelize, Sequelize) => {
  const MyTarget = sequelize.define(
    "MyTarget",
    {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      userId: { type: Sequelize.BIGINT, allowNull: false }, 
      coSheetId: { type: Sequelize.BIGINT, allowNull: false }, 
      jds: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      calls: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    },
    { timestamps: true }
  );

  MyTarget.associate = function (models) {
    // Association with User
    MyTarget.belongsTo(models.User, {
      foreignKey: "userId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      constraints: true,
    });

    // Association with CoSheet
    MyTarget.belongsTo(models.CoSheet, {
      foreignKey: "coSheetId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      constraints: true,
    });
  };

  return MyTarget;
};
