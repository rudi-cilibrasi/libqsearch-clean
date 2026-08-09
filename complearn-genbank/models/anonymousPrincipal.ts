import {DataTypes, Model, Optional} from "sequelize";
import {sequelize} from "../configurations/databaseConnection";

export interface AnonymousPrincipalAttributes {
    id: string;
    credentialHash: string | null;
    credentialExpiresAt: Date | null;
    activatedAt: Date | null;
    firstCompletedAt: Date | null;
    lastSeenAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

type AnonymousPrincipalCreationAttributes = Optional<
    AnonymousPrincipalAttributes,
    "activatedAt" | "firstCompletedAt" | "createdAt" | "updatedAt"
>;

export class AnonymousPrincipal
    extends Model<AnonymousPrincipalAttributes, AnonymousPrincipalCreationAttributes>
    implements AnonymousPrincipalAttributes {
    declare id: string;
    declare credentialHash: string | null;
    declare credentialExpiresAt: Date | null;
    declare activatedAt: Date | null;
    declare firstCompletedAt: Date | null;
    declare lastSeenAt: Date;
    declare createdAt: Date;
    declare updatedAt: Date;
}

AnonymousPrincipal.init(
    {
        id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
        },
        credentialHash: {
            type: DataTypes.CHAR(64),
            allowNull: true,
            unique: true,
            field: "credential_hash",
        },
        credentialExpiresAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: "credential_expires_at",
        },
        activatedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: "activated_at",
        },
        firstCompletedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: "first_completed_at",
        },
        lastSeenAt: {
            type: DataTypes.DATE,
            allowNull: false,
            field: "last_seen_at",
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
        modelName: "AnonymousPrincipal",
        tableName: "anonymous_principals",
        timestamps: true,
        indexes: [
            {fields: ["activated_at"]},
            {fields: ["first_completed_at"]},
            {fields: ["credential_expires_at"]},
        ],
    },
);
