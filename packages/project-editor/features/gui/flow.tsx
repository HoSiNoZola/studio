import React from "react";
import { guid } from "eez-studio-shared/guid";
import { humanize } from "eez-studio-shared/string";
import { action, computed, observable } from "mobx";
import { objectToClipboardData } from "project-editor/core/clipboard";
import {
    ClassInfo,
    cloneObject,
    EezObject,
    getLabel,
    getParent,
    IEditorState,
    IEezObject,
    PropertyType,
    registerClass
} from "project-editor/core/object";
import {
    ITreeObjectAdapter,
    TreeObjectAdapter
} from "project-editor/core/objectAdapter";
import { visitObjects } from "project-editor/core/search";
import { getDocumentStore } from "project-editor/core/store";
import { Component } from "project-editor/features/gui/component";
import { IDesignerContext } from "project-editor/features/gui/flow-editor/designer-interfaces";
import { Rect } from "eez-studio-shared/geometry";

////////////////////////////////////////////////////////////////////////////////

export class ConnectionLine extends EezObject {
    @observable source: string;
    @observable output: string;
    @observable target: string;
    @observable input: string;

    static classInfo: ClassInfo = {
        label: (connectionLine: ConnectionLine) => {
            return `${getLabel(connectionLine.sourceComponent!)}@${humanize(
                connectionLine.output
            )} ➝ ${getLabel(connectionLine.targetComponent!)}@${humanize(
                connectionLine.input
            )}`;
        },

        properties: [
            {
                name: "source",
                type: PropertyType.String,
                hideInPropertyGrid: true
            },
            {
                name: "output",
                type: PropertyType.String,
                hideInPropertyGrid: true
            },
            {
                name: "target",
                type: PropertyType.String,
                hideInPropertyGrid: true
            },
            {
                name: "input",
                type: PropertyType.String,
                hideInPropertyGrid: true
            }
        ],

        isSelectable: () => true
    };

    @computed get sourceComponent() {
        const page = getParent(getParent(this)) as Flow;
        return page.wiredComponents.get(this.source);
    }

    @computed get targetComponent() {
        const page = getParent(getParent(this)) as Flow;
        return page.wiredComponents.get(this.target);
    }

    @computed get sourcePosition() {
        if (!(this.sourceComponent && this.sourceComponent._geometry)) {
            return undefined;
        }

        const outputGeometry = this.sourceComponent._geometry.outputs[
            this.output
        ];
        if (!outputGeometry) {
            return undefined;
        }

        return {
            x: this.sourceComponent.left + outputGeometry.position.x,
            y: this.sourceComponent.top + outputGeometry.position.y
        };
    }

    @computed get targetPosition() {
        if (!(this.targetComponent && this.targetComponent._geometry)) {
            return undefined;
        }
        const inputGeometry = this.targetComponent._geometry.inputs[this.input];
        if (!inputGeometry) {
            return undefined;
        }

        return {
            x: this.targetComponent.left + inputGeometry.position.x,
            y: this.targetComponent.top + inputGeometry.position.y
        };
    }
}

registerClass(ConnectionLine);

////////////////////////////////////////////////////////////////////////////////

export abstract class Flow extends EezObject {
    static classInfo: ClassInfo = {
        properties: [
            {
                name: "components",
                type: PropertyType.Array,
                typeClass: Component,
                hideInPropertyGrid: true
            },
            {
                name: "connectionLines",
                type: PropertyType.Array,
                typeClass: ConnectionLine,
                hideInPropertyGrid: true
            }
        ]
    };

    components: Component[];
    connectionLines: ConnectionLine[];

    @computed get wiredComponents() {
        const widgets = new Map<string, Component>();

        const v = visitObjects(this.components);
        while (true) {
            let visitResult = v.next();
            if (visitResult.done) {
                break;
            }
            if (visitResult.value instanceof Component) {
                const widget = visitResult.value;
                if (widget.wireID) {
                    widgets.set(widget.wireID, widget);
                }
            }
        }

        return widgets;
    }

    objectsToClipboardData(objects: IEezObject[]) {
        const flowFragment = new FlowFragment();
        flowFragment.addObjects(this, objects);
        return objectToClipboardData(flowFragment);
    }

    pasteFlowFragment(flowFragment: FlowFragment) {
        const DocumentStore = getDocumentStore(this);

        DocumentStore.UndoManager.setCombineCommands(true);

        flowFragment.rewire();

        flowFragment.components.forEach(widget => {
            widget.left += 20;
            widget.top += 20;
        });

        DocumentStore.addObjects(
            this.connectionLines,
            flowFragment.connectionLines
        );

        const widgets = DocumentStore.addObjects(
            this.components,
            flowFragment.components
        );

        DocumentStore.UndoManager.setCombineCommands(false);

        return widgets;
    }

    abstract get pageRect(): Rect;

    abstract renderComponents(
        designerContext: IDesignerContext
    ): React.ReactNode;
}

////////////////////////////////////////////////////////////////////////////////

export class FlowFragment extends EezObject {
    components: Component[];
    connectionLines: ConnectionLine[];

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "components",
                type: PropertyType.Array,
                typeClass: Component
            },
            {
                name: "connectionLines",
                type: PropertyType.Array,
                typeClass: ConnectionLine
            }
        ],

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            if (jsObject.widgets) {
                jsObject.components = jsObject.widgets;
                delete jsObject.widgets;
            }
        }
    };

    addObjects(flow: Flow, objects: IEezObject[]) {
        this.components = [];
        this.connectionLines = [];

        const DocumentStore = getDocumentStore(flow);

        const wireIDMap = new Map<string, string>();

        objects.forEach((object: Component) => {
            const clone = cloneObject(DocumentStore, object) as Component;
            if (object.wireID) {
                wireIDMap.set(object.wireID, object.wireID);
            }
            this.components.push(clone);
        });

        flow.connectionLines.forEach(connectionLine => {
            const source = wireIDMap.get(connectionLine.source);
            const target = wireIDMap.get(connectionLine.target);
            if (source && target) {
                const clone = cloneObject(
                    DocumentStore,
                    connectionLine
                ) as ConnectionLine;
                this.connectionLines.push(clone);
            }
        });
    }

    rewire() {
        const wireIDMap = new Map<string, string>();

        this.components.forEach((object: Component) => {
            if (object.wireID) {
                const wireID = guid();
                wireIDMap.set(object.wireID, wireID);
                object.wireID = wireID;
            }
        });

        this.connectionLines.forEach(connectionLine => {
            const newSource = wireIDMap.get(connectionLine.source)!;
            const newTarget = wireIDMap.get(connectionLine.target)!;
            connectionLine.source = newSource;
            connectionLine.target = newTarget;
        });
    }
}

registerClass(FlowFragment);

////////////////////////////////////////////////////////////////////////////////

export class FlowTabState implements IEditorState {
    flow: Flow;
    componentContainerDisplayItem: ITreeObjectAdapter;

    constructor(object: IEezObject) {
        this.flow = object as Flow;
        this.componentContainerDisplayItem = new TreeObjectAdapter(this.flow);
    }

    @computed
    get selectedObject(): IEezObject | undefined {
        return this.componentContainerDisplayItem.selectedObject || this.flow;
    }

    @computed
    get selectedObjects() {
        return this.componentContainerDisplayItem.selectedObjects;
    }

    loadState(state: any) {
        this.componentContainerDisplayItem.loadState(state);
    }

    saveState() {
        return this.componentContainerDisplayItem.saveState();
    }

    @action
    selectObject(object: IEezObject) {
        let ancestor: IEezObject | undefined;
        for (ancestor = object; ancestor; ancestor = getParent(ancestor)) {
            let item = this.componentContainerDisplayItem.getObjectAdapter(
                ancestor
            );
            if (item) {
                this.componentContainerDisplayItem.selectItems([item]);
                return;
            }
        }
    }
}