import type { Assets, DataBuffer } from "project-editor/build/assets";
import type { Variable } from "project-editor/features/variable/variable";
import {
    getArrayElementTypeFromType,
    getStructureFromType,
    isArrayType,
    isEnumType,
    isStructType,
    ValueType
} from "project-editor/features/variable/value-type";
import { evalConstantExpression } from "project-editor/flow/expression";
import { Section } from "project-editor/core/store";
import { MessageType } from "project-editor/core/object";
import {
    FLOW_VALUE_TYPE_ARRAY,
    FLOW_VALUE_TYPE_BOOLEAN,
    FLOW_VALUE_TYPE_DOUBLE,
    FLOW_VALUE_TYPE_FLOAT,
    FLOW_VALUE_TYPE_INT32,
    FLOW_VALUE_TYPE_NULL,
    FLOW_VALUE_TYPE_STRING,
    FLOW_VALUE_TYPE_UINT32,
    FLOW_VALUE_TYPE_UNDEFINED
} from "project-editor/build/value-types";

export interface FlowValue {
    type: number;
    value: any;
    valueType: ValueType;
}

export function getValueType(valueType: ValueType) {
    if (valueType == "undefined") {
        return FLOW_VALUE_TYPE_UNDEFINED;
    } else if (valueType == "null") {
        return FLOW_VALUE_TYPE_NULL;
    } else if (valueType == "integer") {
        return FLOW_VALUE_TYPE_INT32;
    } else if (valueType == "float") {
        return FLOW_VALUE_TYPE_FLOAT;
    } else if (valueType == "double") {
        return FLOW_VALUE_TYPE_DOUBLE;
    } else if (valueType == "boolean") {
        return FLOW_VALUE_TYPE_BOOLEAN;
    } else if (valueType == "string") {
        return FLOW_VALUE_TYPE_STRING;
    } else if (isEnumType(valueType)) {
        return FLOW_VALUE_TYPE_INT32;
    } else if (isArrayType(valueType) || isStructType(valueType)) {
        return FLOW_VALUE_TYPE_ARRAY;
    } else {
        return FLOW_VALUE_TYPE_UINT32;
    }
}

function getVariableFlowValue(assets: Assets, variable: Variable): FlowValue {
    let type;

    if (variable.type) {
        type = getValueType(variable.type);
    } else {
        assets.DocumentStore.outputSectionsStore.write(
            Section.OUTPUT,
            MessageType.ERROR,
            "Variable type not set",
            variable
        );
        type = FLOW_VALUE_TYPE_UNDEFINED;
    }

    try {
        const { value } = evalConstantExpression(
            assets.rootProject,
            variable.defaultValue
        );

        return {
            type,
            value,
            valueType: variable.type
        };
    } catch (err) {
        assets.DocumentStore.outputSectionsStore.write(
            Section.OUTPUT,
            MessageType.ERROR,
            err.toString(),
            variable
        );

        return {
            type,
            value: null,
            valueType: "null"
        };
    }
}

export function buildConstantFlowValue(
    assets: Assets,
    dataBuffer: DataBuffer,
    flowValue: FlowValue
) {
    buildFlowValue(assets, dataBuffer, flowValue);
}

export function buildVariableFlowValue(
    assets: Assets,
    dataBuffer: DataBuffer,
    variable: Variable
) {
    buildFlowValue(assets, dataBuffer, getVariableFlowValue(assets, variable));
}

function buildFlowValue(
    assets: Assets,
    dataBuffer: DataBuffer,
    flowValue: FlowValue
) {
    if (flowValue.value === undefined) {
        dataBuffer.writeUint8(FLOW_VALUE_TYPE_UNDEFINED); // type_
        dataBuffer.writeUint8(0); // unit_
        dataBuffer.writeUint16(0); // options_
        dataBuffer.writeUint32(0); // reserved_
        dataBuffer.writeUint32(0);
        dataBuffer.writeUint32(0);
    } else if (flowValue.value === null) {
        dataBuffer.writeUint8(FLOW_VALUE_TYPE_NULL); // type_
        dataBuffer.writeUint8(0); // unit_
        dataBuffer.writeUint16(0); // options_
        dataBuffer.writeUint32(0); // reserved_
        dataBuffer.writeUint32(0);
        dataBuffer.writeUint32(0);
    } else {
        dataBuffer.writeUint8(flowValue.type); // type_
        dataBuffer.writeUint8(0); // unit_
        dataBuffer.writeUint16(0); // options_
        dataBuffer.writeUint32(0); // reserved_
        // union
        if (flowValue.type == FLOW_VALUE_TYPE_BOOLEAN) {
            dataBuffer.writeUint32(flowValue.value);
            dataBuffer.writeUint32(0);
        } else if (flowValue.type == FLOW_VALUE_TYPE_INT32) {
            dataBuffer.writeInt32(flowValue.value);
            dataBuffer.writeUint32(0);
        } else if (flowValue.type == FLOW_VALUE_TYPE_FLOAT) {
            dataBuffer.writeFloat(flowValue.value);
            dataBuffer.writeUint32(0);
        } else if (flowValue.type == FLOW_VALUE_TYPE_DOUBLE) {
            dataBuffer.writeDouble(flowValue.value);
        } else if (flowValue.type == FLOW_VALUE_TYPE_STRING) {
            dataBuffer.writeObjectOffset(() => {
                dataBuffer.writeString(flowValue.value);
            });
            dataBuffer.writeUint32(0);
        } else if (flowValue.type == FLOW_VALUE_TYPE_ARRAY) {
            dataBuffer.writeObjectOffset(() => {
                let elements: FlowValue[];

                if (Array.isArray(flowValue.value)) {
                    const elementType = (getArrayElementTypeFromType(
                        flowValue.valueType
                    ) || "any") as ValueType;

                    elements = flowValue.value.map((element: any) => ({
                        type: getValueType(elementType),
                        value: element,
                        valueType: elementType
                    }));
                } else {
                    const elementType = getStructureFromType(
                        assets.DocumentStore.project,
                        flowValue.valueType
                    );

                    elements = [];
                    const sortedKeys = Object.keys(flowValue.value).sort();
                    for (const key of sortedKeys) {
                        const element = flowValue.value[key];

                        let fieldValueType: ValueType;
                        if (elementType) {
                            const field = elementType.fields.find(
                                field => field.name == key
                            );
                            if (field) {
                                fieldValueType = field.type;
                            } else {
                                fieldValueType = "any";
                            }
                        } else {
                            fieldValueType = "any";
                        }

                        elements.push({
                            type: getValueType(fieldValueType),
                            value: element,
                            valueType: fieldValueType
                        });
                    }
                }

                dataBuffer.writeUint32(elements.length); // arraySize
                dataBuffer.writeUint32(
                    assets.getTypeIndex(flowValue.valueType)
                ); // reserved
                elements.forEach(element =>
                    buildFlowValue(assets, dataBuffer, element)
                );
            }, 8);
            dataBuffer.writeUint32(0);
        } else {
            dataBuffer.writeUint64(0);
        }
    }
}