/*
 * EEZ Modular Firmware
 * Copyright (C) 2021-present, Envox d.o.o.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

#include <stdio.h>
#include <stdlib.h>
#include <emscripten.h>

#include <eez/core/alloc.h>

#include <eez/flow/flow.h>
#include <eez/flow/components.h>
#include <eez/flow/flow_defs_v3.h>
#include <eez/flow/expression.h>
#include <eez/flow/queue.h>
#include <eez/flow/debugger.h>
#include <eez/flow/hooks.h>

using namespace eez::gui;

namespace eez {
namespace flow {

////////////////////////////////////////////////////////////////////////////////

// When passed quoted string as '"str"' it will return unquoted string as 'str'.
// Returns false if passed value is not a valid string.
bool parseScpiString(const char *&textArg, size_t &textLenArg) {
	const char *text = textArg;
	size_t textLen = textLenArg;

	if (textLen < 2 || text[0] != '"' || text[textLen - 1] != '"') {
		return false;
	}

	text++;
	textLen -= 2;

	// make sure there is no single quote (") inside
	// scpi can return list of strings as "str1","str2","str3",...
	// and we don't want to recognize this as string
	for (size_t i = 0; i < textLen; i++) {
		if (text[i] == '"') {
			if (i == textLen - 1 || text[i + 1] != '"') {
				return false;
			}
			i++;
		}
	}

	textArg = text;
	textLenArg = textLen;
	return true;
}

////////////////////////////////////////////////////////////////////////////////

struct ScpiComponentExecutionState : public ComponenentExecutionState {
	uint8_t op;
	int instructionIndex;
	char commandOrQueryText[256];

	static ScpiComponentExecutionState *g_waitingForScpiResult;

    char *errorMessage;
    char *result;
    int resultLen;

	bool resultIsReady;

	ScpiComponentExecutionState() {
		instructionIndex = 0;
		commandOrQueryText[0] = 0;
	}

    ~ScpiComponentExecutionState() {
        if (errorMessage) {
            ::free(errorMessage);
        }
        if (result) {
            ::free(result);
        }
    }

	bool scpi(eez::gui::ArrayValue *instrument) {
		if (g_waitingForScpiResult) {
			if (g_waitingForScpiResult == this && g_waitingForScpiResult->resultIsReady) {
				g_waitingForScpiResult = nullptr;
				return true;
			}

			return false;
		}

		g_waitingForScpiResult = this;

        errorMessage = 0;
        result = 0;
        resultLen = 0;

        resultIsReady = false;

		EM_ASM({
            executeScpi($0, new Uint8Array(Module.HEAPU8.buffer, $1, $2));
        }, instrument, commandOrQueryText, strlen(commandOrQueryText));

		return false;
	}

    bool getLatestScpiResult(FlowState *flowState, unsigned componentIndex, const char **resultText, size_t *resultTextLen) {
        if (errorMessage) {
            throwError(flowState, componentIndex, errorMessage);
            ObjectAllocator<ScpiComponentExecutionState>::deallocate(this);
            flowState->componenentExecutionStates[componentIndex] = nullptr;
            return false;
        }

        if (resultLen >= 2 && result[resultLen - 2] == '\r' && result[resultLen - 1] == '\n') {
            resultLen -= 2;
            result[resultLen] = 0;
        }

        if (resultLen >= 3 && result[0] == '"' && result[resultLen - 1] == '"') {
            // replace "" with "
            size_t j = 1;
            size_t i;
            for (i = 1; i < resultLen - 2; i++, j++) {
                result[j] = result[i];
                if (result[i] == '"' && result[i + 1] == '"') {
                    i++;
                }
            }
            result[j] = result[i];
            result[j + 1] = '"';
            resultLen -= i - j;
        }

        *resultText = result;
        *resultTextLen = resultLen;
        return true;
    }
};

ScpiComponentExecutionState *ScpiComponentExecutionState::g_waitingForScpiResult = nullptr;

////////////////////////////////////////////////////////////////////////////////

EM_PORT_API(void) onScpiResult(char *errorMessage, char *result, int resultLen) {
	if (!isFlowRunningHook()) {
		return;
	}

    ScpiComponentExecutionState::g_waitingForScpiResult->errorMessage = errorMessage;
	ScpiComponentExecutionState::g_waitingForScpiResult->result = result;
	ScpiComponentExecutionState::g_waitingForScpiResult->resultLen = resultLen;

	ScpiComponentExecutionState::g_waitingForScpiResult->resultIsReady = true;
}

////////////////////////////////////////////////////////////////////////////////

struct ScpiActionComponent : public Component {
	uint8_t instructions[1];
};

void executeScpiComponent(FlowState *flowState, unsigned componentIndex) {
    auto component = (ScpiActionComponent *)flowState->flow->components[componentIndex];

    auto propertyValue = component->propertyValues[defs_v3::SCPIACTION_COMPONENT_PROPERTY_INSTRUMENT];
    Value instrumentValue;
    if (!evalExpression(flowState, componentIndex, propertyValue->evalInstructions, instrumentValue)) {
        throwError(flowState, componentIndex, "Failed to evaluate Instrument in SCPI\n");
        return;
    }
    if (instrumentValue.getType() != VALUE_TYPE_ARRAY && instrumentValue.getType() != VALUE_TYPE_ARRAY_REF) {
        throwError(flowState, componentIndex, "Invalid Instrument value in SCPI\n");
        return;
    }
    auto instrumentArrayValue = instrumentValue.getArray();

	auto instructions = component->instructions;

	static const int SCPI_PART_STRING = 1;
	static const int SCPI_PART_EXPR = 2;
	static const int SCPI_PART_QUERY_WITH_ASSIGNMENT = 3;
	static const int SCPI_PART_QUERY = 4;
	static const int SCPI_PART_COMMAND = 5;
	static const int SCPI_PART_END = 6;

	auto scpiComponentExecutionState = (ScpiComponentExecutionState *)flowState->componenentExecutionStates[componentIndex];

	if (!scpiComponentExecutionState) {
		scpiComponentExecutionState = ObjectAllocator<ScpiComponentExecutionState>::allocate(0x38e134d2);
		scpiComponentExecutionState->op = instructions[scpiComponentExecutionState->instructionIndex++];

		flowState->componenentExecutionStates[componentIndex] = scpiComponentExecutionState;
	}

	while (true) {
		if (scpiComponentExecutionState->op == SCPI_PART_STRING) {
			uint16_t sizeLowByte = instructions[scpiComponentExecutionState->instructionIndex++];
			uint16_t sizeHighByte = instructions[scpiComponentExecutionState->instructionIndex++];
			uint16_t stringLength = sizeLowByte | (sizeHighByte << 8);
			stringAppendStringLength(
				scpiComponentExecutionState->commandOrQueryText,
				sizeof(scpiComponentExecutionState->commandOrQueryText),
				(const char *)instructions + scpiComponentExecutionState->instructionIndex,
				(size_t)stringLength
			);
			scpiComponentExecutionState->instructionIndex += stringLength;
		} else if (scpiComponentExecutionState->op == SCPI_PART_EXPR) {
			Value value;
			int numInstructionBytes;
			if (!evalExpression(flowState, componentIndex, instructions + scpiComponentExecutionState->instructionIndex, value, &numInstructionBytes)) {
				throwError(flowState, componentIndex, "Failed to evaluate assignable expression in SCPI\n");

				ObjectAllocator<ScpiComponentExecutionState>::deallocate(scpiComponentExecutionState);
				flowState->componenentExecutionStates[componentIndex] = nullptr;

				return;
			}
			scpiComponentExecutionState->instructionIndex += numInstructionBytes;

			char valueStr[256];
			value.toText(valueStr, sizeof(valueStr));

			stringAppendString(
				scpiComponentExecutionState->commandOrQueryText,
				sizeof(scpiComponentExecutionState->commandOrQueryText),
				valueStr
			);
		} else if (scpiComponentExecutionState->op == SCPI_PART_QUERY_WITH_ASSIGNMENT) {
			if (!scpiComponentExecutionState->g_waitingForScpiResult) {
				logScpiQuery(flowState, componentIndex, scpiComponentExecutionState->commandOrQueryText);
			}

			if (!scpiComponentExecutionState->scpi(instrumentArrayValue)) {
				if (!addToQueue(flowState, componentIndex)) {
					throwError(flowState, componentIndex, "Execution queue is full\n");
				}
				return;
			}

			const char *resultText;
			size_t resultTextLen;
			if (!scpiComponentExecutionState->getLatestScpiResult(flowState, componentIndex, &resultText, &resultTextLen)) {
				return;
			}

			logScpiQueryResult(flowState, componentIndex, resultText, resultTextLen);

			Value dstValue;
			int numInstructionBytes;
			if (!evalAssignableExpression(flowState, componentIndex, instructions + scpiComponentExecutionState->instructionIndex, dstValue, &numInstructionBytes)) {
				throwError(flowState, componentIndex, "Failed to evaluate assignable expression in SCPI\n");

				ObjectAllocator<ScpiComponentExecutionState>::deallocate(scpiComponentExecutionState);
				flowState->componenentExecutionStates[componentIndex] = nullptr;

				return;
			}
			scpiComponentExecutionState->instructionIndex += numInstructionBytes;

			scpiComponentExecutionState->commandOrQueryText[0] = 0;

			Value srcValue;
			if (parseScpiString(resultText, resultTextLen)) {
				srcValue = Value::makeStringRef(resultText, resultTextLen, 0x09143fa4);
			} else {
				char *strEnd;
				long num = strtol(resultText, &strEnd, 10);
				if (*strEnd == 0) {
					srcValue = Value((int)num, VALUE_TYPE_INT32);
				} else {
					float fnum = strtof(resultText, &strEnd);
					if (*strEnd == 0) {
						srcValue = Value(fnum, VALUE_TYPE_FLOAT);
					} else {
						srcValue = Value::makeStringRef(resultText, resultTextLen, 0x09143fa4);
					}
				}
			}

			assignValue(flowState, componentIndex, dstValue, srcValue);
		} else if (scpiComponentExecutionState->op == SCPI_PART_QUERY) {
			if (!scpiComponentExecutionState->g_waitingForScpiResult) {
				logScpiQuery(flowState, componentIndex, scpiComponentExecutionState->commandOrQueryText);
			}

			if (!scpiComponentExecutionState->scpi(instrumentArrayValue)) {
				if (!addToQueue(flowState, componentIndex)) {
					throwError(flowState, componentIndex, "Execution queue is full\n");
				}
				return;
			}

			const char *resultText;
			size_t resultTextLen;
			if (!scpiComponentExecutionState->getLatestScpiResult(flowState, componentIndex, &resultText, &resultTextLen)) {
				return;
			}

			scpiComponentExecutionState->commandOrQueryText[0] = 0;
		} else if (scpiComponentExecutionState->op == SCPI_PART_COMMAND) {
			if (!scpiComponentExecutionState->g_waitingForScpiResult) {
				logScpiCommand(flowState, componentIndex, scpiComponentExecutionState->commandOrQueryText);
			}

			if (!scpiComponentExecutionState->scpi(instrumentArrayValue)) {
				if (!addToQueue(flowState, componentIndex)) {
					throwError(flowState, componentIndex, "Execution queue is full\n");
				}
				return;
			}

			const char *resultText;
			size_t resultTextLen;
			if (!scpiComponentExecutionState->getLatestScpiResult(flowState, componentIndex, &resultText, &resultTextLen)) {
				return;
			}

			scpiComponentExecutionState->commandOrQueryText[0] = 0;
		} else if (scpiComponentExecutionState->op == SCPI_PART_END) {
			ObjectAllocator<ScpiComponentExecutionState>::deallocate(scpiComponentExecutionState);
			flowState->componenentExecutionStates[componentIndex] = nullptr;

			propagateValueThroughSeqout(flowState, componentIndex);
			return;
		}

		scpiComponentExecutionState->op = instructions[scpiComponentExecutionState->instructionIndex++];
	}
}

} // namespace flow
} // namespace eez