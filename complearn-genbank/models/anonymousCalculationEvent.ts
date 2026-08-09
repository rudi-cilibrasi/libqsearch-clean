import {DataTypes, Model} from "sequelize";
import {sequelize} from "../configurations/databaseConnection";

// A string table reference avoids an import cycle between Sequelize model files.
const AnonymousPrincipalTableName = "anonymous_principals";

export const ANONYMOUS_CALCULATION_EVENT_TYPES = [
    "calculation_started",
    "calculation_completed",
] as const;

export type AnonymousCalculationEventType = typeof ANONYMOUS_CALCULATION_EVENT_TYPES[number];
export type AnonymousCalculationInputKind = "objects" | "distance-matrix";

export interface AnonymousCalculationEventAttributes {
    id: string;
    principalId: string;
    runId: string;
    eventType: AnonymousCalculationEventType;
    inputKind: AnonymousCalculationInputKind;
    objectCount: number;
    occurredAt: Date;
}

export class AnonymousCalculationEvent
    extends Model<AnonymousCalculationEventAttributes>
    implements AnonymousCalculationEventAttributes {
    declare id: string;
    declare principalId: string;
    declare runId: string;
    declare eventType: AnonymousCalculationEventType;
    declare inputKind: AnonymousCalculationInputKind;
    declare objectCount: number;
    declare occurredAt: Date;
}

AnonymousCalculationEvent.init(
    {
        id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
        },
        principalId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: "principal_id",
            references: {model: AnonymousPrincipalTableName, key: "id"},
            onDelete: "CASCADE",
        },
        runId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: "run_id",
        },
        eventType: {
            type: DataTypes.STRING(32),
            allowNull: false,
            field: "event_type",
        },
        inputKind: {
            type: DataTypes.STRING(32),
            allowNull: false,
            field: "input_kind",
        },
        objectCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: "object_count",
        },
        occurredAt: {
            type: DataTypes.DATE,
            allowNull: false,
            field: "occurred_at",
        },
    },
    {
        sequelize,
        modelName: "AnonymousCalculationEvent",
        tableName: "anonymous_calculation_events",
        timestamps: false,
        indexes: [
            {
                unique: true,
                fields: ["principal_id", "run_id", "event_type"],
                name: "anonymous_event_principal_run_type_unique",
            },
            {fields: ["event_type", "occurred_at"]},
        ],
        validate: {
            eventTypeIsAllowed(this: AnonymousCalculationEvent): void {
                const eventType = this.eventType;
                if (!ANONYMOUS_CALCULATION_EVENT_TYPES.includes(eventType)) {
                    throw new Error("Unsupported anonymous calculation event type");
                }
            },
            inputKindIsAllowed(this: AnonymousCalculationEvent): void {
                const inputKind = this.inputKind;
                if (inputKind !== "objects" && inputKind !== "distance-matrix") {
                    throw new Error("Unsupported anonymous calculation input kind");
                }
            },
        },
    },
);
