/////////////////////////////////////////////////////////////////////
// Copyright (c) Autodesk, Inc. All rights reserved
// Written by Forge Partner Development
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM 'AS IS' AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
/////////////////////////////////////////////////////////////////////

(function () {
    const SensorStyleDefinitions = {
        co2: {
            url: '../img/sensors/co2.svg',
            color: 0xffffff,
        },
        temperature: {
            url: '../img/sensors/thermometer.svg',
            color: 0xffffff,
        },
        default: {
            url: '../img/sensors/circle.svg',
            color: 0xffffff,
        },
    };

    class BIM360IotConnectedExtension extends Autodesk.Viewing.Extension {
        constructor(viewer, options) {
            super(viewer, options);

            this.sensorDbId = 1;
            this.dbId2DeviceIdMap = {};
            this.deviceId2DbIdMap = {};
            this.modelExternalIdMaps = {};
            this.styleMap = [];
            this.currentHeatmapSensorType = 'temperature';

            this.onSelectedFloorChanged = this.onSelectedFloorChanged.bind(this);
        }

        get assetTool() {
            const assetExt = this.viewer.getExtension('BIM360AssetExtension');
            return assetExt;
        }

        get dataProvider() {
            const assetExt = this.assetTool;
            return assetExt && assetExt.dataProvider;
        }

        get spaceFilterTool() {
            const spaceFilter = this.assetTool?.spaceFilterPanel;
            return spaceFilter;
        }

        get levelSelector() {
            const levelExt = this.viewer.getExtension('Autodesk.AEC.LevelsExtension');
            return levelExt && levelExt.floorSelector;
        }

        get dataVizTool() {
            const dataVizExt = this.viewer.getExtension('Autodesk.DataVisualization');
            return dataVizExt;
        }

        async load() {
            await viewer.waitForLoadDone();

            await this.init();
            await this.render();

            return true;
        }

        async init() {
            let aecModelData = await viewer.model.getDocumentNode().getDocument().downloadAecModelData();

            // Pre-load extensions
            await viewer.loadExtension('Autodesk.AEC.LevelsExtension', { doNotCreateUI: true });
            await viewer.loadExtension('Autodesk.DataVisualization');
            await viewer.loadExtension('BIM360AssetExtension');

            // Pre-load sensor data
            const sensors = await this.dataProvider.getSensorsFromAssetData();
            this.dataProvider.sensors = sensors;

            await this.buildExternalIdMaps();

            // Create model-to-style map from style definitions.
            Object.entries(SensorStyleDefinitions).forEach(([type, styleDef]) => {
                this.styleMap[type] = new Autodesk.DataVisualization.Core.ViewableStyle(
                    Autodesk.DataVisualization.Core.ViewableType.SPRITE,
                    new THREE.Color(styleDef.color),
                    styleDef.url
                );
            });

            this.levelSelector.addEventListener(
                Autodesk.AEC.FloorSelector.SELECTED_FLOOR_CHANGED,
                this.onSelectedFloorChanged
            );
        }

        async render() {
            await this.renderSensors();
        }

        async buildExternalIdMaps() {
            try {
                const getExternalIdMapping = (model) => {
                    return new Promise((resolve, reject) => {
                        model.getExternalIdMapping(
                            map => resolve(map),
                            error => reject(new Error(error))
                        )
                    });
                };

                const models = this.viewer.getAllModels();
                for (let i = 0; i < models.length; i++) {
                    const model = models[i];
                    const extIdMap = await getExternalIdMapping(model);
                    const modelKey = model.getModelKey();
                    this.modelExternalIdMaps[modelKey] = extIdMap;
                }
            } catch (ex) {
                console.error(`[BIM360IotConnectedExtension]: ${ex}`);
                return false;
            }

            return true;
        }

        async getAssetViewerId(externalId, model) {
            try {
                const modelKey = model.getModelKey();
                const extIdMap = this.modelExternalIdMaps[modelKey];
                if (!extIdMap)
                    throw new Error(`External Id map of model \`${modelKey}\` not found`);

                return extIdMap[externalId];
            } catch (ex) {
                console.error(`[BIM360IotConnectedExtension]: ${ex}`);
                return null;
            }
        }

        async getNodeBoxAsync(dbId, model) {
            return new Promise((resolve, reject) => {
                const tree = model.getInstanceTree();
                const frags = model.getFragmentList();

                let bounds = new THREE.Box3();
                tree.enumNodeFragments(dbId, function (fragId) {
                    let box = new THREE.Box3();
                    frags.getWorldBounds(fragId, box);
                    bounds.union(box);
                }, true);
                return resolve(bounds);
            });
        }

        async renderSensors() {
            const { sensors } = this.dataProvider;
            if (!sensors || sensors.length <= 0) return;

            const DataVizCore = Autodesk.DataVisualization.Core;
            // const viewableType = DataVizCore.ViewableType.SPRITE;
            // const spriteColor = new THREE.Color(0xffffff);
            // const spriteHighlightedColor = new THREE.Color(0xffffff);
            // const style = new DataVizCore.ViewableStyle(
            //     viewableType,
            //     spriteColor,
            //     '../img/sensors/thermometer.svg'
            // );

            const model = this.viewer.model;
            const viewableData = new DataVizCore.ViewableData();
            viewableData.spriteSize = 24; // Sprites as points of size 24 x 24 pixels

            for (let i = 0; i < sensors.length; i++) {
                const sensor = sensors[i];
                const assetExtId = sensor.externalId;

                const assetDbId = await this.getAssetViewerId(assetExtId, model);
                if (!assetDbId) {
                    console.error(`No viewer object found for Asset External Id \`${assetExtId}\`!`);
                    continue;
                }

                const sensorDbId = this.sensorDbId;
                const assetBox = await this.getNodeBoxAsync(assetDbId, model);
                const position = assetBox.center();
                sensor.position = position;

                const sensorType = sensor.name.toLowerCase();
                sensor.type = sensorType;

                const style = this.styleMap[sensorType] || this.styleMap['default'];
                const viewable = new DataVizCore.SpriteViewable(position, style, sensorDbId);
                viewable.externalId = sensor.id;
                this.dbId2DeviceIdMap[sensorDbId] = assetExtId;

                if (!this.deviceId2DbIdMap.hasOwnProperty(assetExtId)) {
                    this.deviceId2DbIdMap[assetExtId] = [sensorDbId];
                } else {
                    this.deviceId2DbIdMap[assetExtId].push(sensorDbId);
                }

                this.sensorIdPrefix++;
                viewableData.addViewable(viewable);
            }

            await viewableData.finish();
            this.dataVizTool.addViewables(viewableData);

            // this.viewer.addEventListener(DataVizCore.MOUSE_CLICK, (event) => {
            //     console.log(event);
            //     this.dataVizTool.highlightViewables(event.dbId);
            // });
        }

        getLevel(currentElevation, floors) {
            if (currentElevation < floors[0].zMin) {
                return floors[0];
            } else if (currentElevation > floors[floors.length - 1].zMax) {
                return floors[floors.length - 1];
            } else {
                return floors.find(f => f.zMin <= currentElevation && f.zMax >= currentElevation);
            }
        }

        onSelectedFloorChanged(event) {
            const { levelIndex } = event;

            this.clearHeatmap();

            if (levelIndex === null) {
                return;
            }

            const floor = this.levelSelector.floorData[levelIndex];
            this.renderHeatmapByFloor(floor);
        }

        clearHeatmap() {
            this.dataVizTool.removeSurfaceShading();
        }

        async renderHeatmapByFloor(floor) {
            const { sensors } = this.dataProvider;
            if (!floor || !sensors || sensors.length <= 0) return;

            const data = [];
            for (let i = 0; i < sensors.length; i++) {
                const sensor = sensors[i];
                const position = sensor.position;
                if (floor.zMin > position.z || floor.zMax < position.z)
                    continue;

                data.push({
                    id: sensor.id,
                    position: sensor.position,
                    type: sensor.type,
                    sensorTypes: [sensor.type]
                });
            }

            // Generate surfaceshading data by mapping devices to rooms.
            const model = this.spaceFilterTool.roomModel;
            const structureInfo = new Autodesk.DataVisualization.Core.ModelStructureInfo(model);
            const heatmapData = await structureInfo.generateSurfaceShadingData(data);

            // Setup surfaceshading
            await this.dataVizTool.setupSurfaceShading(model, heatmapData);

            const supportedTypes = Array.from(new Set(data.map(d => d.type)));
            supportedTypes.forEach(type => this.dataVizTool.registerSurfaceShadingColors(type, [0xff0000, 0x0000ff]));

            /**
             * Interface for application to decide the current value for the heatmap
             * @param {Object} device device
             * @param {string} sensorType sensor type
             */
            function getSensorValue(device, sensorType) {
                let value = Math.random();
                return value;
            }

            this.dataVizTool.renderSurfaceShading(floor.name, this.currentHeatmapSensorType, getSensorValue);
        }

        async unload() {
            return true;
        }
    }

    Autodesk.Viewing.theExtensionManager.registerExtension('BIM360IotConnectedExtension', BIM360IotConnectedExtension);
})();