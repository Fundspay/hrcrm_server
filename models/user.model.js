"use strict";
module.exports = (sequelize, Sequelize) => {
    const User = sequelize.define(
        "User",
        {
            id: { autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },
            firstName: { type: Sequelize.STRING, allowNull: false },
            lastName: { type: Sequelize.STRING, allowNull: false },
            gender: { type: Sequelize.BIGINT, allowNull: true },
            email: { type: Sequelize.STRING, allowNull: true, unique: true },
            phoneNumber: { type: Sequelize.STRING, allowNull: true, unique: true },
            password: { type: Sequelize.STRING, allowNull: false },
            photoUrl: { type: Sequelize.STRING, allowNull: true },
            type: { type: Sequelize.BIGINT, allowNull: true }, // user type
            isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
            createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
            updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },

            // ✅ Must exactly match column name
            isDeleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        },
        {
            tableName: "Users", // ✅ force correct table name
            timestamps: true,
        }
    );

    User.associate = function (models) {
        User.belongsTo(models.UserType, {
            foreignKey: "type",
            onDelete: "RESTRICT",
            onUpdate: "RESTRICT",
            constraints: true,
        });

        User.belongsTo(models.Gender, {
            foreignKey: "gender",
            onDelete: "RESTRICT",
            onUpdate: "RESTRICT",
            constraints: true,
        });
    };

    return User;
};
