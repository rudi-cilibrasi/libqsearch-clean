import {DataTypes, Model, Optional} from "sequelize";
import {sequelize} from "../configurations/databaseConnection";

export interface AnonymousActivityDayAttributes {
    principalId: string;
    activityDate: string;
    calculationStartedCount: number;
    calculationCompletedCount: number;
    createdAt: Date;
    updatedAt: Date;
}

type AnonymousActivityDayCreationAttributes = Optional<
    AnonymousActivityDayAttributes,
    "calculationStartedCount" | "calculationCompletedCount" | "createdAt" | "updatedAt"
>;

export class AnonymousActivityDay
    extends Model<AnonymousActivityDayAttributes, AnonymousActivityDayCreationAttributes>
    implements AnonymousActivityDayAttributes {
    declare principalId: string;
    declare activityDate: string;
    declare calculationStartedCount: number;
    declare calculationCompletedCount: number;
    declare createdAt: Date;
    declare updatedAt: Date;
}

AnonymousActivityDay.init(
    {
        principalId: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            field: "principal_id",
            references: {model: "anonymous_principals", key: "id"},
            onDelete: "CASCADE",
        },
        activityDate: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            primaryKey: true,
            field: "activity_date",
        },
        calculationStartedCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            field: "calculation_started_count",
        },
        calculationCompletedCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            field: "calculation_completed_count",
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            field: "created_at",
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            field: "updated_at",
        },
    },
    {
        sequelize,
        modelName: "AnonymousActivityDay",
        tableName: "anonymous_activity_days",
        timestamps: true,
        indexes: [
            {fields: ["activity_date", "principal_id"]},
        ],
    },
);
