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
    const Utility = {
        getClosestValue: function (av, entry) {
            let tsValues = av.tsValues;
            let values = av.avg;

            let smallSide = null;
            let largeSide = null;
            let smallSideIndex;
            let largeSideIndex;

            for (var i = 0; i < tsValues.length; i++) {
                if (tsValues[i] <= entry && values[i] != null) {
                    smallSide = values[i];
                    smallSideIndex = i;
                } else if (tsValues[i] > entry && values[i] != null) {
                    largeSide = values[i];
                    largeSideIndex = i;
                    break;
                }
            }

            if (smallSide != null && largeSide != null) {
                let sTime = tsValues[smallSideIndex];
                let lTime = tsValues[largeSideIndex];
                let p = (entry - sTime) / (lTime - sTime);
                return smallSide * (1 - p) + largeSide * p;
            } else {
                return smallSide || largeSide || 0;
            }
        },
        getNormalizedValue: function (value, range) {
            let normalized = (value - range.min) / (range.max - range.min);

            normalized = Utility.clamp(normalized, 0, 1);
            return normalized;
        },
        clamp: function (value, lower, upper) {
            if (value == undefined) {
                return lower;
            }

            if (value > upper) {
                return upper;
            } else if (value < lower) {
                return lower;
            } else {
                return value;
            }
        },
        /**
         * Converts a Date object into equivalent Epoch seconds
         * @param {Date} time A Date object
         * @returns {number} Time value expressed in Unix Epoch seconds
         */
        getTimeInEpochSeconds: function (time) {
            const epochSeconds = new Date(time).getTime() / 1000.0;
            return ~~epochSeconds; // Equivalent to Math.floor()
        }
    };

    const SENSOR_DATA_CHANGED_EVENT = 'sensorDataChangedEvent';
    class SensorDataHelper extends THREE.EventDispatcher {
        constructor(dataProvider) {
            super();

            this.dataProvider = dataProvider;
            this.data = {};
            this.timeRange = null;
        }

        get sensors() {
            return this.dataProvider.sensors;
        }

        getDataFromCache(sensorId, sensorType) {
            if (this.data.hasOwnProperty(sensorId)) {
                const data = this.data[sensorId];
                return data.find(d => d.name.toLowerCase() == sensorType.toLowerCase());
            } else {
                return null;
            }
        }

        async getRemoteTimeRange(projectId) {
            return new Promise((resolve, reject) => {
                fetch(`/api/iot/projects/${projectId}/records:time-range`, {
                    method: 'get',
                    headers: new Headers({
                        'Content-Type': 'application/json'
                    })
                })
                    .then((response) => {
                        if (response.status === 200) {
                            return response.json();
                        } else {
                            return reject(new Error(response.statusText));
                        }
                    })
                    .then((data) => {
                        if (!data) return reject(new Error('Failed to fetch sensor history time range data from the server'));
                        return resolve(data);
                    })
                    .catch((error) => reject(new Error(error)));
            });
        }

        async getTimeRange() {
            try {
                if (this.timeRange == null) {
                    const project = await this.dataProvider.getHqProject();
                    this.timeRange = await this.getRemoteTimeRange(project.projectId);
                }
                return this.timeRange;
            } catch (ex) {
                return null;
            }
        }

        async getRemoteData(projectId, sensorId, sensorType, startTimestamp, endTimestamp) {
            return new Promise((resolve, reject) => {
                let query = `type=${sensorType}&startTimestamp=${startTimestamp}&endTimestamp=${endTimestamp}`;

                fetch(`/api/iot/projects/${projectId}/sensors/${sensorId}/records:aggregate?${query}`, {
                    method: 'get',
                    headers: new Headers({
                        'Content-Type': 'application/json'
                    })
                })
                    .then((response) => {
                        if (response.status === 200) {
                            return response.json();
                        } else {
                            return reject(new Error(response.statusText));
                        }
                    })
                    .then((data) => {
                        if (!data) return reject(new Error('Failed to fetch aggregate sensor history data from the server'));

                        data.tsValues = data.time.map(Utility.getTimeInEpochSeconds);

                        data.avgMin = Math.min(...data.avg);
                        data.avgMax = Math.max(...data.avg);

                        return resolve(data);
                    })
                    .catch((error) => reject(new Error(error)));
            });
        }

        async fetchData(startTimestamp, endTimestamp) {
            try {
                delete this.data;
                this.data = {};

                const project = await this.dataProvider.getHqProject();
                const sensors = this.sensors;

                for (let i = 0; i < sensors.length; i++) {
                    const sensor = sensors[i];
                    const sensorType = sensor.name.charAt(0).toUpperCase() + sensor.name.slice(1);
                    const data = await this.getRemoteData(project.projectId, sensor.id, sensorType, startTimestamp, endTimestamp);
                    if (this.data[sensor.id]) {
                        this.data[sensor.id].push(data);
                    } else {
                        this.data[sensor.id] = [data];
                    }
                }

                this.dispatchEvent({
                    type: SENSOR_DATA_CHANGED_EVENT,
                    data: this.data
                });

                return this.data;
            } catch (ex) {
                return null;
            }
        }
    }

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
            this.dataHelper = null;
            this.currentTime = null;

            this.onSelectedFloorChanged = this.onSelectedFloorChanged.bind(this);
            this.onSensorDataUpdated = this.onSensorDataUpdated.bind(this);
            this.getSensorValue = this.getSensorValue.bind(this);
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

        onSelectedFloorChanged(event) {
            const { levelIndex } = event;

            this.clearHeatmap();

            if (levelIndex === null) {
                return;
            }

            const floor = this.levelSelector.floorData[levelIndex];
            this.renderHeatmapByFloor(floor);
        }

        onSensorDataUpdated() {
            this.dataVizTool.updateSurfaceShading(this.getSensorValue);
        }

        /**
         * Interface for application to decide the current value for the heatmap
         * @param {Object} device device
         * @param {string} sensorType sensor type
         */
        getSensorValue(device, sensorType) {
            //let value = Math.random();

            const { sensors } = this.dataProvider;
            if (!sensors || sensors.length <= 0) return;

            const sensor = sensors.find(s => s.id == device.id);
            console.log(sensor, sensorType);

            let cachedData = this.dataHelper.getDataFromCache(sensor.id, sensorType);
            if (cachedData) {
                const value = Utility.getClosestValue(cachedData, this.currentTime);
                const range = {
                    min: cachedData.avgMin,
                    max: cachedData.avgMax
                };

                let normalized = Utility.getNormalizedValue(value, range);
                return normalized;
            }

            return 0;
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

            const model = this.viewer.model;
            for (let i = 0; i < sensors.length; i++) {
                const sensor = sensors[i];
                const assetExtId = sensor.externalId;

                const assetDbId = await this.getAssetViewerId(assetExtId, model);
                if (!assetDbId) {
                    console.error(`No viewer object found for Asset External Id \`${assetExtId}\`!`);
                    continue;
                }

                const assetBox = await this.getNodeBoxAsync(assetDbId, model);
                const position = assetBox.center();
                sensor.position = position;

                const sensorType = sensor.name.toLowerCase();
                sensor.type = sensorType;
            }

            this.dataHelper = new SensorDataHelper(this.dataProvider);

            const timeRange = await this.dataHelper.getTimeRange();
            await this.dataHelper.fetchData(timeRange.min, timeRange.max);

            this.currentTime = new Date(~~(timeRange.min + 1 * 60 * 60 * 1000 * 24));

            this.dataHelper.addEventListener(
                SENSOR_DATA_CHANGED_EVENT,
                this.onSensorDataUpdated
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

            const viewableData = new DataVizCore.ViewableData();
            viewableData.spriteSize = 24; // Sprites as points of size 24 x 24 pixels

            for (let i = 0; i < sensors.length; i++) {
                const sensor = sensors[i];
                const assetExtId = sensor.externalId;

                const sensorDbId = this.sensorDbId;
                if (!sensor.position) {
                    continue;
                }

                const sensorType = sensor.type;
                const style = this.styleMap[sensorType] || this.styleMap['default'];
                const viewable = new DataVizCore.SpriteViewable(sensor.position, style, sensorDbId);
                viewable.externalId = sensor.id;
                this.dbId2DeviceIdMap[sensorDbId] = assetExtId;

                if (!this.deviceId2DbIdMap.hasOwnProperty(assetExtId)) {
                    this.deviceId2DbIdMap[assetExtId] = [sensorDbId];
                } else {
                    this.deviceId2DbIdMap[assetExtId].push(sensorDbId);
                }

                this.sensorDbId++;
                viewableData.addViewable(viewable);
            }

            await viewableData.finish();
            this.dataVizTool.addViewables(viewableData);
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

            this.dataVizTool.renderSurfaceShading(floor.name, this.currentHeatmapSensorType, this.getSensorValue);
        }

        async unload() {
            return true;
        }
    }

    Autodesk.Viewing.theExtensionManager.registerExtension('BIM360IotConnectedExtension', BIM360IotConnectedExtension);
})();