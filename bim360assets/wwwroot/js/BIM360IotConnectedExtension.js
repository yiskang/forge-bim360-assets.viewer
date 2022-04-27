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
        },
        /**
         * Rest an object
         * @param {Object} obj An object to be reset.
         * ref: https://stackoverflow.com/a/24090180
         */
        resetObject: function (obj) {
            for (let key in Object.getOwnPropertyNames(obj)) {
                if (!obj.hasOwnProperty(key)) continue;

                let val = obj[key];
                switch (typeof val) {
                    case 'string':
                        obj[key] = ''; break;
                    case 'number':
                        obj[key] = 0; break;
                    case 'boolean':
                        obj[key] = false; break;
                    case 'object':
                        if (val === null) break;
                        if (val instanceof Array) {
                            while (obj[key].length > 0) {
                                obj[key].pop();
                            }
                            break;
                        }
                        val = {};
                        //Or recursively clear the sub-object
                        //resetObject(val);
                        break;
                }
            }
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

        getDataRangeOfCache(sensorType) {
            const data = Object.values(this.data).flat().filter(d => d.name.toLowerCase() == sensorType.toLowerCase());
            if (!data || data.length <= 0) {
                console.warn(
                    `Data range for \`${sensorType}\` not specified. Please make sure the database having sensors named with \`${sensorType}\`.`
                );

                return {
                    dataUnit: '%',
                    min: 0,
                    max: 100
                }
            }

            const max = Math.max(...data.map(d => d.avgMax));
            const min = Math.min(...data.map(d => d.avgMin));

            const { sensors } = this.dataProvider;
            if (!sensors || sensors.length <= 0)
                return null;

            let firstData = data[0];
            const sensor = sensors.find(s => s.id == firstData.sensorId);

            if (!sensor)
                return null;

            let dataUnit = sensor.dataUnit;
            dataUnit = dataUnit.toLowerCase() === "celsius" ? "°C" : dataUnit;
            dataUnit = dataUnit.toLowerCase() === "fahrenheit" ? "°F" : dataUnit;

            return {
                dataUnit,
                max,
                min
            };
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

        dispose() {
            Utility.resetObject(this.data);
            delete this.data;
            this.data = null;

            delete this.dataProvider;
            this.dataProvider = null;
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

    const HeatmapGradientMap = {
        temperature: [0x0000ff, 0x00ff00, 0xffff00, 0xff0000],
        humidity: [0x00f260, 0x0575e6],
        co2: [0x1e9600, 0xfff200, 0xff0000],
    };

    class BIM360SensorTooltip extends THREE.EventDispatcher {
        constructor(parent) {
            super();

            this.parent = parent;
            this.init();
        }

        get viewer() {
            return this.parent.viewer;
        }

        get dataVizTool() {
            return this.parent.dataVizTool;
        }

        init() {
            const container = document.createElement('div');
            container.classList.add('bim360-sensor-tooltip');
            this.container = container;

            const bodyContainer = document.createElement('div');
            bodyContainer.classList.add('bim360-sensor-tooltip-body');
            container.appendChild(bodyContainer);
            this.bodyContainer = bodyContainer;

            bodyContainer.innerHTML = 'No Data';

            this.viewer.container.appendChild(container);
        }

        setVisible(visible) {
            if (visible) {
                this.bodyContainer.classList.add('visible');
            } else {
                this.bodyContainer.classList.remove('visible');
            }
        }

        setPosition(point) {
            const contentRect = this.bodyContainer.getBoundingClientRect();
            const offsetX = contentRect.width / 2;
            const spriteSize = this.dataVizTool.viewableData.spriteSize;
            const offsetY = contentRect.height + 0.7 * spriteSize / this.parent.viewer.getWindow().devicePixelRatio;

            const pos = new THREE.Vector3(
                point.x - offsetX,
                point.y - offsetY,
                0
            );

            this.container.style.transform = `translate3d(${pos.x}px, ${pos.y}px, ${pos.z}px)`;
        }

        setPositionByWordPoint(point) {
            this.setPosition(this.viewer.worldToClient(point));
        }

        async show(sensor) {
            if (!sensor) return;

            this.bodyContainer.innerHTML = '';

            const nameSpan = document.createElement('span');
            nameSpan.classList.add('bim360-sensor-tooltip-name');
            this.bodyContainer.appendChild(nameSpan);

            const assetInfo = this.parent.dataProvider.assetInfoCache[sensor.externalId];
            let nameString = 'Unknown asset';
            if (assetInfo) {
                nameString = `Asset [${assetInfo.assetId}]`;
            }
            nameSpan.innerHTML = `${nameString} ${sensor.name}`;

            const valueSpan = document.createElement('span');
            valueSpan.classList.add('bim360-sensor-tooltip-value');
            this.bodyContainer.appendChild(valueSpan);

            let cachedData = this.parent.dataHelper.getDataFromCache(sensor.id, sensor.name);
            if (cachedData) {
                let value = Utility.getClosestValue(cachedData, Utility.getTimeInEpochSeconds(this.parent.currentTime));
                let valueString = `${value.toFixed(2)}`;
                if (sensor.dataUnit)
                    valueString += ` ${sensor.dataUnit}`;

                valueSpan.innerHTML = valueString;
            }

            this.setVisible(true);
            this.setPosition(this.viewer.worldToClient(sensor.position));
        }

        hide() {
            this.bodyContainer.innerHTML = 'No Data';
            this.setVisible(false);
        }
    }

    const UI_CONTROL_VISIBILITY_CHANGED_EVENT = 'uiControlVisibilityChangedEvent';
    class BIM360UiControl extends THREE.EventDispatcher {
        constructor(container) {
            super();

            this.parentContainer = container;
            this.initialize();
        }

        get visible() {
            return (this.container.style.visibility == 'visible');
        }

        set visible(visible) {
            if (visible) {
                this.container.style.visibility = 'visible';
            } else {
                this.container.style.visibility = 'hidden';
            }

            this.dispatchEvent({
                type: UI_CONTROL_VISIBILITY_CHANGED_EVENT,
                visible
            });
        }

        initialize() {
            const container = document.createElement('div');
            container.classList.add('bim360-ui-control');
            this.container = container;
            this.parentContainer.appendChild(container);
        }

        uninitialize() {
            if (!this.container) return;

            Utility.resetObject(this._listeners);
            delete this._listeners;

            this.parentContainer.removeChild(this.container);
        }
    }
    BIM360UiControl.UI_CONTROL_VISIBILITY_CHANGED_EVENT = UI_CONTROL_VISIBILITY_CHANGED_EVENT;

    const DROPDOWN_CONTROL_CURRENT_INDEX_CHANGED_EVENT = 'dropdownControlCurrentIndexChangedEvent';
    class BIM360DropdownMenuControl extends BIM360UiControl {
        constructor(container, options) {
            super(container);

            this.options = [].concat(options);
            this.onBlur = this.onBlur.bind(this);
            this.init();
        }

        get selectedIndex() {
            const options = this.container.querySelectorAll('.bim360-dropdown-menu-option');
            return Array.prototype.findIndex.call(options, opt => opt.classList.contains('selected'));
        }

        set selectedIndex(index) {
            if (index == this.selectedIndex) return;

            const option = this.options[index];
            if (!option)
                throw new Error(`Invalid select option index: \`${index}\``);

            this.container.querySelector('.bim360-dropdown-menu-option.selected')?.classList.remove('selected');

            const options = this.container.querySelectorAll('.bim360-dropdown-menu-option');
            const targetDom = Array.prototype.find.call(options, opt => opt.getAttribute('data-value') == option.value);

            targetDom.classList.add('selected');
            targetDom.closest('.bim360-dropdown-menu').querySelector('.bim360-dropdown-menu-trigger span').textContent = targetDom.textContent;

            this.dispatchEvent({
                type: DROPDOWN_CONTROL_CURRENT_INDEX_CHANGED_EVENT,
                index: index,
                menuOption: option
            });
        }

        onBlur(event) {
            const menu = this.container.querySelector('.bim360-dropdown-menu');
            if (!menu.contains(event.target)) {
                menu.classList.remove('open');
            }
        }

        init() {
            const container = this.container;
            container.classList.add('bim360-dropdown-menu-control');

            container.addEventListener('click', function () {
                this.querySelector('.bim360-dropdown-menu').classList.toggle('open');
            });

            const menuContainer = document.createElement('div');
            menuContainer.classList.add('bim360-dropdown-menu');
            container.appendChild(menuContainer);

            const menuTriggerContainer = document.createElement('div');
            const menuTriggerTextContainer = document.createElement('span');
            const menuTriggerArrowContainer = document.createElement('div');
            menuTriggerContainer.classList.add('bim360-dropdown-menu-trigger');
            menuTriggerArrowContainer.classList.add('arrow');

            menuTriggerContainer.appendChild(menuTriggerTextContainer);
            menuTriggerContainer.appendChild(menuTriggerArrowContainer);
            menuContainer.appendChild(menuTriggerContainer);

            const menuOptionsContainer = document.createElement('div');
            menuOptionsContainer.classList.add('bim360-dropdown-menu-options');
            menuContainer.appendChild(menuOptionsContainer);

            for (let i = 0; i < this.options.length; i++) {
                let option = this.options[i];
                let menuOptionContainer = document.createElement('span');
                menuOptionContainer.classList.add('bim360-dropdown-menu-option');
                menuOptionContainer.textContent = option.text;
                menuOptionContainer.setAttribute('data-value', option.value);
                menuOptionsContainer.appendChild(menuOptionContainer);

                menuOptionContainer.addEventListener('click', () => {
                    this.selectedIndex = i;
                });
            }

            window.addEventListener(
                'click',
                this.onBlur
            );

            // Set default selected option
            this.selectedIndex = 0;
        }

        destroy() {
            if (!this.container) return;

            window.removeEventListener(
                'click',
                this.onBlur
            );

            while (this.options.length > 0) {
                this.options.pop();
            }

            delete this.options;
            this.options = null;

            this.uninitialize();
        }

        selectByValue(value) {
            const idx = this.options.findIndex(op => op.value == value);
            if (idx === -1) return;

            this.selectedIndex = idx;
        }
    }

    BIM360DropdownMenuControl.DROPDOWN_CONTROL_CURRENT_INDEX_CHANGED_EVENT = DROPDOWN_CONTROL_CURRENT_INDEX_CHANGED_EVENT;

    class BIM360HeatmapOptionsControl extends BIM360DropdownMenuControl {
        constructor(container) {
            const heatmapOptions = Object.keys(HeatmapGradientMap).map(item => {
                return {
                    value: item,
                    text: item.charAt(0).toUpperCase() + item.slice(1)
                }
            });

            super(container, heatmapOptions);
        }
    }

    const HEATMAP_VISIBILITY_CONTROL_CLICKED_EVENT = 'heatmapVisibilityControlClickedEvent';
    class BIM360HeatmapVisibilityControl extends BIM360UiControl {
        constructor(container) {
            super(container);

            this.onClicked = this.onClicked.bind(this);

            this.init();
        }

        get active() {
            return this.container.querySelector('i.glyphicon')?.classList.contains('glyphicon-eye-open');
        }

        set active(state) {
            const iconContainer = this.container.querySelector('i.glyphicon');

            if (state) {
                iconContainer?.classList.remove('glyphicon-eye-close');
                iconContainer?.classList.add('glyphicon-eye-open');
            } else {
                iconContainer?.classList.remove('glyphicon-eye-open');
                iconContainer?.classList.add('glyphicon-eye-close');
            }
        }

        onClicked(event) {
            this.active = !this.active;

            this.dispatchEvent({
                type: HEATMAP_VISIBILITY_CONTROL_CLICKED_EVENT,
                active: this.active
            });

            event.preventDefault();
            event.stopPropagation();
        }

        init() {
            const container = this.container;
            container.classList.add('bim360-heatmap-visibility-control');

            container.addEventListener(
                'click',
                this.onClicked
            );

            const bodyContainer = document.createElement('div');
            bodyContainer.classList.add('bim360-heatmap-visibility-control-body');
            container.appendChild(bodyContainer);

            const iconContainer = document.createElement('i');
            iconContainer.classList.add('glyphicon');
            iconContainer.classList.add('glyphicon-eye-open');
            bodyContainer.appendChild(iconContainer);
        }

        destroy() {
            if (!this.container) return;

            this.container.removeEventListener(
                'click',
                this.onClicked
            );

            super.uninitialize();
        }
    }

    BIM360HeatmapVisibilityControl.HEATMAP_VISIBILITY_CONTROL_CLICKED_EVENT = HEATMAP_VISIBILITY_CONTROL_CLICKED_EVENT;

    class BIM360HeatmapColorGradientBar extends BIM360UiControl {
        constructor(parent) {
            super(parent.viewer.container);

            this.parent = parent;
            this.init();
        }

        get viewer() {
            return this.parent.viewer;
        }

        get dataHelper() {
            return this.parent.dataHelper;
        }

        get currentType() {
            return this.parent.currentHeatmapSensorType;
        }

        init() {
            const container = this.container;
            container.classList.add('bim360-heatmap-color-gradient-bar');

            const rootSpan = document.createElement('span');
            rootSpan.classList.add('bim360-heatmap-color-gradient-bar-root');
            container.appendChild(rootSpan);
            this.rootSpan = rootSpan;

            const heatmapOptionsContainer = document.createElement('div');
            heatmapOptionsContainer.classList.add('bim360-heatmap-options-select');
            container.appendChild(heatmapOptionsContainer);

            const heatmapOptionsSelect = new BIM360HeatmapOptionsControl(heatmapOptionsContainer);
            heatmapOptionsSelect.visible = false;
            this.heatmapOptionsSelect = heatmapOptionsSelect;

            const heatmapVisibilityControl = new BIM360HeatmapVisibilityControl(heatmapOptionsContainer);
            heatmapVisibilityControl.visible = false;
            this.heatmapVisibilityControl = heatmapVisibilityControl;
        }

        generateGradientStyle(gradientMap, type) {
            let colorStops = gradientMap[type];
            colorStops = colorStops ? colorStops : [0xf9d423, 0xff4e50]; // Default colors.

            const colorStopsHex = colorStops.map((c) => `#${c.toString(16).padStart(6, "0")}`);
            return `linear-gradient(.25turn, ${colorStopsHex.join(", ")})`;
        }

        generateMarks(type, totalMarkers) {
            let localMarks = [];
            totalMarkers = totalMarkers || 4; // Generate [1, 2, 3, ..., totalMarkers ]
            const seeds = Array.from({ length: totalMarkers }, (_, x) => x + 1);
            const valueOffset = 100.0 / (totalMarkers + 1.0);

            // Get the selected property's range min, max and dataUnit value from Ref App
            let dataRange = this.dataHelper.getDataRangeOfCache(type);

            const delta = (dataRange.max - dataRange.min) / (totalMarkers + 1.0);
            localMarks = seeds.map((i) => {
                return {
                    value: i * valueOffset,
                    label: `${(dataRange.min + i * delta).toFixed()}${dataRange.dataUnit}`,
                };
            });
            return localMarks;
        }

        destroy() {
            if (!this.container) return;

            this.heatmapOptionsSelect.destroy();
            this.heatmapVisibilityControl.destroy();

            delete this.heatmapOptionsSelect;
            delete this.heatmapVisibilityControl;

            this.viewer.container.removeChild(this.container);
        }

        show() {
            this.visible = true;

            const rootSpan = this.rootSpan;
            const gradientStyle = this.generateGradientStyle(HeatmapGradientMap, this.currentType);
            const labelData = this.generateMarks(this.currentType);

            const railSpan = document.createElement('span');
            railSpan.classList.add('bim360-heatmap-color-gradient-bar-rail');
            railSpan.style.backgroundImage = gradientStyle;
            rootSpan.appendChild(railSpan);

            for (let i = 0; i < labelData.length; i++) {
                let ld = labelData[i];
                let markSpan = document.createElement('span');
                markSpan.classList.add('bim360-heatmap-color-gradient-bar-mark');
                markSpan.style.left = `${ld.value}%`;
                rootSpan.appendChild(markSpan);

                let markLabelSpan = document.createElement('span');
                markLabelSpan.classList.add('bim360-heatmap-color-gradient-bar-mark-label');
                markLabelSpan.style.left = `${ld.value}%`;
                markLabelSpan.innerHTML = ld.label;
                rootSpan.appendChild(markLabelSpan);
            }

            this.heatmapOptionsSelect.visible = true;
            this.heatmapVisibilityControl.visible = true;

            this.heatmapOptionsSelect.selectByValue(this.currentType);
            this.heatmapVisibilityControl.active = true;
        }

        hide() {
            if (!this.rootSpan) return;

            this.heatmapOptionsSelect.visible = false;
            this.heatmapVisibilityControl.visible = false;

            while (this.rootSpan.firstChild) {
                this.rootSpan.removeChild(this.rootSpan.lastChild);
            }

            this.visible = false;
        }
    }

    class BIM360SensorDataGraphPanel extends Autodesk.Viewing.UI.DockingPanel {
        constructor(viewer, dataHelper) {
            const options = {};

            //  Height adjustment for scroll container, offset to height of the title bar and footer by default.
            if (!options.heightAdjustment)
                options.heightAdjustment = 70;

            if (!options.marginTop)
                options.marginTop = 0;

            //options.addFooter = false;

            super(viewer.container, viewer.container.id + 'BIM360SensorDataGraphPanel', 'Sensor Data History (Unknown asset)', options);

            this.container.classList.add('bim360-docking-panel');
            this.container.classList.add('bim360-sensor-data-graph-panel');
            this.createScrollContainer(options);

            this.viewer = viewer;
            this.options = options;
            this.uiCreated = false;
            this.dataHelper = dataHelper;
            this.chart = null;

            viewer.addPanel(this);

            this.addVisibilityListener(async (show) => {
                if (!show) return;

                if (!this.uiCreated)
                    await this.createUI();
            });
        }

        createUI() {
            this.uiCreated = true;

            const chartContainer = document.createElement('div');
            chartContainer.classList.add('chart-container');
            this.chartContainer = chartContainer;
            this.scrollContainer.appendChild(chartContainer);

            this.buildChart();
        }

        generateChartOptions(dates, values) {
            const chartOpts = {
                tooltip: {
                    //trigger: 'axis',
                    axisPointer: {
                        animation: false,
                        type: 'cross',
                        lineStyle: {
                            color: '#376df4',
                            width: 2,
                            opacity: 1
                        }
                    }
                },
                xAxis: {
                    type: 'category',
                    data: dates,
                    axisLine: { lineStyle: { color: '#8392A5' } },
                    axisLabel: {
                        formatter: (function (value) {
                            return new Date(value).toLocaleString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
                        })
                    }
                },
                yAxis: {
                    scale: true,
                    axisLine: { lineStyle: { color: '#8392A5' } },
                    splitLine: { show: false }
                },
                grid: {
                    left: '9%',
                    right: '6%',
                    height: '49%',
                    bottom: 80
                },
                dataZoom: [{
                    textStyle: {
                        color: '#8392A5'
                    },
                    dataBackground: {
                        areaStyle: {
                            color: '#8392A5'
                        },
                        lineStyle: {
                            opacity: 0.8,
                            color: '#8392A5'
                        }
                    },
                    brushSelect: true
                }, {
                    type: 'inside'
                }],
                series: [
                    {
                        //name: 'Record',
                        type: 'line',
                        data: values,
                        smooth: true,
                        showSymbol: false,
                        lineStyle: {
                            width: 1
                        }
                    }
                ]
            };

            return chartOpts;
        }

        buildChart() {
            const chart = echarts.init(this.chartContainer);
            this.chart = chart;

            const values = [];
            const dates = [
                new Date(this.dataHelper.timeRange.min * 1000).toLocaleString('en-US', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
                new Date(this.dataHelper.timeRange.max * 1000).toLocaleString('en-US', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
            ];

            const chartOpts = this.generateChartOptions(dates, values);
            chart.setOption(chartOpts);

            if (this.options.addFooter) {
                this.footerInstance.resizeCallback = () => {
                    chart.resize();
                };
            }
        }

        updateChart(sensor) {
            if (!sensor || !this.chart) return;

            let cachedData = this.dataHelper.getDataFromCache(sensor.id, sensor.type);
            if (!cachedData) return;

            const assetInfo = this.dataHelper.dataProvider.assetInfoCache[sensor.externalId];
            let nameString = 'Unknown asset';
            if (assetInfo) {
                nameString = `Asset [${assetInfo.assetId}]`;
            }

            this.setTitle(`${nameString} ${sensor.name}`);

            const dates = cachedData.tsValues.map(ts => new Date(ts * 1000).toLocaleString('en-US', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }));
            const values = cachedData.avg;

            const chartOpts = this.generateChartOptions(dates, values);
            this.chart.setOption(chartOpts);
        }

        uninitialize() {
            this.uiCreated = false;
            if (this.chart) {
                this.chart.dispose();
                delete this.chart;
                this.chart = null;
            }

            this.viewer.removePanel(this);
            super.uninitialize();
        }
    }

    class BIM360TimelinerControl extends BIM360UiControl {
        constructor(parent) {
            super(parent.viewer.container.parentNode);

            this.parent = parent;
            this.instance = null;

            this.init();

            this.onTimeSliderControlInitialized = this.onTimeSliderControlInitialized.bind(this);
            this.onTimeSliderControlTimeRangeUpdated = this.onTimeSliderControlTimeRangeUpdated.bind(this);
            this.onTimeSliderControlCurrentTimeUpdated = this.onTimeSliderControlCurrentTimeUpdated.bind(this);
        }

        get viewer() {
            return this.parent.viewer;
        }

        onTimeSliderControlInitialized(event) {
            console.log(event);
        }

        onTimeSliderControlTimeRangeUpdated(event) {
            console.log(event);
        }

        onTimeSliderControlCurrentTimeUpdated(event) {
            console.log(event);
            if (!this.parent.isHeatMapVisible) return;

            this.parent.currentTime = new Date(event.currentTime.getTime());
            console.log('Current time: ', this.currentTime);

            this.parent.onSensorDataUpdated();
            this.parent.updateHeatmap(false, false);
        }

        init() {
            const container = this.container;
            container.classList.add('bim360-timeline-control');

            const instanceContainer = document.createElement('div');
            instanceContainer.classList.add('bim360-timeline');
            container.appendChild(instanceContainer);
            this.instanceContainer = instanceContainer;

            this.viewer.container.classList.add('with-timeline');
            this.viewer.resize();
        }

        build() {
            if (!this.instanceContainer) return;

            const timeRange = this.parent.dataHelper.timeRange;
            let dataStart = new Date(timeRange.min * 1000);
            let dataEnd = new Date(timeRange.max * 1000)
            let currentTime = new Date(this.parent.currentTime.getTime());

            const timeOptions = new Autodesk.DataVisualization.UI.TimeOptions(dataStart, dataEnd, currentTime);
            const timeSliderOptions = {
                dataStart,
                dataEnd,
                timeOptions,
                // handleTimeRangeUpdated: (startTime, endTime, currentTime) => console.log(startTime, endTime, currentTime),
                // handleCurrentTimeUpdated: (currentTime) => console.log(currentTime)
            };

            const timeSlider = new Autodesk.DataVisualization.UI.ChronosTimeSliderControl(this.instanceContainer, timeSliderOptions);
            this.instance = timeSlider;

            timeSlider.addEventListener(
                Autodesk.DataVisualization.UI.TIME_SLIDER_CONTROL_INITIALIZED_EVENT,
                this.onTimeSliderControlInitialized
            );

            timeSlider.addEventListener(
                Autodesk.DataVisualization.UI.TIME_SLIDER_CONTROL_TIME_RANGE_UPDATED_EVENT,
                this.onTimeSliderControlTimeRangeUpdated
            );

            timeSlider.addEventListener(
                Autodesk.DataVisualization.UI.TIME_SLIDER_CONTROL_CURRENT_TIME_UPDATED_EVENT,
                this.onTimeSliderControlCurrentTimeUpdated
            );

            timeSlider.initialize();
        }

        destroy() {
            if (!this.instance) return;

            this.instance.uninitialize();

            this.instance.removeEventListener(
                Autodesk.DataVisualization.UI.TIME_SLIDER_CONTROL_INITIALIZED_EVENT,
                this.onTimeSliderControlInitialized
            );

            this.instance.removeEventListener(
                Autodesk.DataVisualization.UI.TIME_SLIDER_CONTROL_TIME_RANGE_UPDATED_EVENT,
                this.onTimeSliderControlTimeRangeUpdated
            );

            this.instance.removeEventListener(
                Autodesk.DataVisualization.UI.TIME_SLIDER_CONTROL_CURRENT_TIME_UPDATED_EVENT,
                this.onTimeSliderControlCurrentTimeUpdated
            );

            this.viewer.container.classList.remove('with-timeline');
            this.viewer.resize();
        }
    }

    class BIM360IotConnectedExtension extends Autodesk.Viewing.Extension {
        constructor(viewer, options) {
            super(viewer, options);

            this.sensorDbId = 1;
            this.dbId2DeviceIdMap = {};
            this.deviceId2DbIdMap = {};
            this.modelExternalIdMaps = {};
            this.styleMap = {};
            this.currentHeatmapSensorType = 'temperature';
            this.dataHelper = null;
            this.currentTime = null;
            this.isHeatMapVisible = false;
            this.uiCreated = false;

            this.onSelectedFloorChanged = this.onSelectedFloorChanged.bind(this);
            this.onSensorDataUpdated = this.onSensorDataUpdated.bind(this);
            this.onSensorHovered = this.onSensorHovered.bind(this);
            this.onSensorClicked = this.onSensorClicked.bind(this);
            this.getSensorValue = this.getSensorValue.bind(this);
            this.createUI = this.createUI.bind(this);
            this.onToolbarCreated = this.onToolbarCreated.bind(this);
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

        waitForRoomModelRootAdded() {
            return new Promise((resolve, reject) => {
                if (this.spaceFilterTool?.roomModel)
                    return resolve();

                const onModelRootAdded = (event) => {
                    resolve();
                };

                this.viewer.addEventListener(
                    Autodesk.Viewing.MODEL_ROOT_LOADED_EVENT,
                    onModelRootAdded,
                    { once: true }
                );
            });
        }

        async load() {
            //await viewer.waitForLoadDone();
            await this.waitForRoomModelRootAdded();
            await this.init();

            if (this.viewer.toolbar) {
                // Toolbar is already available, create the UI
                await this.createUI();
            }

            await this.render();
            if (this.spaceFilterTool.isFilterApplied) {
                this.updateHeatmap(true, true);
            }

            let endTime = new Date().getTime();
            console.log('%cTime when IotConnected ext is ready:  ' + (endTime - window.stTime) / 1000 + '(s)', 'color: green');

            return true;
        }

        async onToolbarCreated() {
            await this.createUI();
        }

        onSelectedFloorChanged(event) {
            const { levelIndex } = event;

            this.clearHeatmap();

            if (levelIndex === undefined) {
                return;
            }

            const floor = this.levelSelector.floorData[levelIndex];
            this.renderHeatmapByFloor(floor);
        }

        onSensorDataUpdated() {
            this.dataVizTool.updateSurfaceShading(this.getSensorValue);
        }

        onSensorHovered(event) {
            if (event.hovering && this.dbId2DeviceIdMap) {
                const deviceId = this.dbId2DeviceIdMap[event.dbId];

                const { sensors } = this.dataProvider;
                if (!sensors || sensors.length <= 0) return;

                const sensor = sensors.find(s => s.externalId == deviceId);
                if (!sensor) return;

                this.tooltip.show(sensor);
            } else {
                this.tooltip.hide();
            }
        }

        onSensorClicked(event) {
            if (event.clickInfo && this.dbId2DeviceIdMap) {
                const deviceId = this.dbId2DeviceIdMap[event.dbId];

                const { sensors } = this.dataProvider;
                if (!sensors || sensors.length <= 0) return;

                const sensor = sensors.find(s => s.externalId == deviceId);

                if (!sensor) return;

                this.recordHistoryPanel.updateChart(sensor);
            }
        }

        async createUI() {
            if (this.uiCreated) return;

            this.uiCreated = true;

            const recordHistoryPanel = new BIM360SensorDataGraphPanel(this.viewer, this.dataHelper);
            this.recordHistoryPanel = recordHistoryPanel;

            const tooltip = new BIM360SensorTooltip(this);
            this.tooltip = tooltip;

            const heatmapColorGradientBar = new BIM360HeatmapColorGradientBar(this);
            this.heatmapColorGradientBar = heatmapColorGradientBar;

            const timeSliderControl = new BIM360TimelinerControl(this);
            this.timeSliderControl = timeSliderControl;
            timeSliderControl.build();

            const recordHistoryToolButton = new Autodesk.Viewing.UI.Button('toolbar-dataVizRecordHistoryToolButton');
            recordHistoryToolButton.setToolTip('Show Sensor Record History');
            recordHistoryToolButton.icon.classList.add('glyphicon');
            recordHistoryToolButton.icon.classList.add('glyphicon-bim360-icon');
            recordHistoryToolButton.setIcon('glyphicon-dashboard');
            recordHistoryToolButton.onClick = () => {
                recordHistoryPanel.setVisible(!recordHistoryPanel.isVisible());
            };

            recordHistoryPanel.addVisibilityListener(function (visible) {
                if (visible)
                    viewer.onPanelVisible(recordHistoryPanel, viewer);

                recordHistoryToolButton.setState(visible ? Autodesk.Viewing.UI.Button.State.ACTIVE : Autodesk.Viewing.UI.Button.State.INACTIVE);
            });

            // const heatmapTimeBackwardToolButton = new Autodesk.Viewing.UI.Button('toolbar-dataVizHeatmapTimeBackwardTool');
            // heatmapTimeBackwardToolButton.setToolTip('Backward Heatmap Time');
            // heatmapTimeBackwardToolButton.icon.classList.add('glyphicon');
            // heatmapTimeBackwardToolButton.icon.classList.add('glyphicon-bim360-icon');
            // heatmapTimeBackwardToolButton.setIcon('glyphicon-backward');
            // heatmapTimeBackwardToolButton.setVisible(false);
            // heatmapTimeBackwardToolButton.onClick = () => {
            //     if (!this.isHeatMapVisible) return;

            //     this.currentTime = new Date(this.currentTime.getTime() - (1 * 60 * 60 * 1000));
            //     console.log('Move backward 1hr', this.currentTime);

            //     if (Utility.getTimeInEpochSeconds(this.currentTime) < this.dataHelper.timeRange.min) {
            //         let date = new Date(this.dataHelper.timeRange.min * 1000);
            //         console.warn(`Current time \`${this.currentTime}\` is smaller than time range minimum, so reset it to \`${date}\``);

            //         this.currentTime = date;
            //         return;
            //     }

            //     this.onSensorDataUpdated();
            //     this.updateHeatmap(false, false);
            // };

            // const heatmapTimeForwardToolButton = new Autodesk.Viewing.UI.Button('toolbar-dataVizHeatmapTimeForwardTool');
            // heatmapTimeForwardToolButton.setToolTip('Forward Heatmap Time');
            // heatmapTimeForwardToolButton.icon.classList.add('glyphicon');
            // heatmapTimeForwardToolButton.icon.classList.add('glyphicon-bim360-icon');
            // heatmapTimeForwardToolButton.setIcon('glyphicon-forward');
            // heatmapTimeForwardToolButton.setVisible(false);
            // heatmapTimeForwardToolButton.onClick = () => {
            //     if (!this.isHeatMapVisible) return;

            //     this.currentTime = new Date(this.currentTime.getTime() + (1 * 60 * 60 * 1000));
            //     console.log('Move forward 1hr', this.currentTime);

            //     if (Utility.getTimeInEpochSeconds(this.currentTime) > this.dataHelper.timeRange.max) {
            //         let date = new Date(this.dataHelper.timeRange.max * 1000);
            //         console.warn(`Current time \`${this.currentTime}\` is greater than time range maximum, so reset it to \`${date}\``);

            //         this.currentTime = date;
            //         return;
            //     }

            //     this.onSensorDataUpdated();
            //     this.updateHeatmap(false, false);
            // };

            heatmapColorGradientBar.heatmapOptionsSelect.addEventListener(
                BIM360DropdownMenuControl.DROPDOWN_CONTROL_CURRENT_INDEX_CHANGED_EVENT,
                (event) => {
                    if (!event.menuOption) return;

                    this.changeHeatmapByType(event.menuOption.value);
                });

            heatmapColorGradientBar.heatmapVisibilityControl.addEventListener(
                BIM360HeatmapVisibilityControl.HEATMAP_VISIBILITY_CONTROL_CLICKED_EVENT,
                (event) => {
                    if (event.active) {
                        this.updateHeatmap(false, true);
                    } else {
                        this.clearHeatmap(false, true);
                    }

                    // heatmapTimeBackwardToolButton.setVisible(event.active);
                    // heatmapTimeForwardToolButton.setVisible(event.active);
                });

            heatmapColorGradientBar.addEventListener(
                BIM360UiControl.UI_CONTROL_VISIBILITY_CHANGED_EVENT,
                (event) => {
                    // heatmapTimeBackwardToolButton.setVisible(event.visible);
                    // heatmapTimeForwardToolButton.setVisible(event.visible);
                });

            const addButtons = (subToolbar) => {
                subToolbar.addControl(recordHistoryToolButton);
                // subToolbar.addControl(heatmapTimeBackwardToolButton);
                // subToolbar.addControl(heatmapTimeForwardToolButton);
                subToolbar.recordHistoryToolButton = recordHistoryToolButton;
                // subToolbar.heatmapTimeBackwardToolButton = heatmapTimeBackwardToolButton;
                // subToolbar.heatmapTimeForwardToolButton = heatmapTimeForwardToolButton;
            }

            const onSubToolbarCreated = (event) => {
                if (event.control._id != 'toolbar-bim360-tools') return;

                this.viewer.toolbar.removeEventListener(
                    Autodesk.Viewing.UI.ControlGroup.Event.CONTROL_ADDED,
                    onSubToolbarCreated
                );

                addButtons(event.control);
            };

            let subToolbar = this.assetTool.subToolbar;
            if (!subToolbar) {
                this.viewer.toolbar.addEventListener(
                    Autodesk.Viewing.UI.ControlGroup.Event.CONTROL_ADDED,
                    onSubToolbarCreated
                );
            } else {
                addButtons(subToolbar);
            }
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
                const value = Utility.getClosestValue(cachedData, Utility.getTimeInEpochSeconds(this.currentTime));
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

            this.currentTime = new Date((new Date(timeRange.min * 1000).getTime() + (1 * 60 * 60 * 1000 * 24)));

            this.dataHelper.addEventListener(
                SENSOR_DATA_CHANGED_EVENT,
                this.onSensorDataUpdated
            );

            this.viewer.addEventListener(
                Autodesk.DataVisualization.Core.MOUSE_HOVERING,
                this.onSensorHovered
            );

            this.viewer.addEventListener(
                Autodesk.DataVisualization.Core.MOUSE_CLICK,
                this.onSensorClicked
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

        updateHeatmap(includeUI, isLevelDirty = true) {
            this.clearHeatmap(includeUI);

            const { currentFloor } = this.levelSelector;
            if (currentFloor === undefined || currentFloor === null) {
                return;
            }

            const floor = this.levelSelector.floorData[currentFloor];
            this.renderHeatmapByFloor(floor, isLevelDirty);
        }

        changeHeatmapByType(sensorType) {
            this.currentHeatmapSensorType = sensorType;
            this.updateHeatmap(true, true);
        }

        clearHeatmap(includeUI = true) {
            this.isHeatMapVisible = false;
            this.dataVizTool?.removeSurfaceShading();

            if (includeUI)
                this.heatmapColorGradientBar.hide();
        }

        async renderHeatmapByFloor(floor, isLevelDirty = true) {
            const { sensors } = this.dataProvider;
            if (!sensors || sensors.length <= 0) return;

            this.isHeatMapVisible = true;

            if (isLevelDirty) {
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
                supportedTypes.forEach(type => this.dataVizTool.registerSurfaceShadingColors(type, HeatmapGradientMap[type]));
            }

            this.dataVizTool.renderSurfaceShading(floor.name, this.currentHeatmapSensorType, this.getSensorValue);

            if (!this.heatmapColorGradientBar.visible)
                this.heatmapColorGradientBar.show();
        }

        async unload() {
            this.clearHeatmap();
            this.heatmapColorGradientBar.destroy();
            this.dataVizTool?.removeAllViewables();

            if (this.timeSliderControl) {
                this.timeSliderControl.destroy();
            }

            if (this.levelSelector) {
                this.levelSelector.removeEventListener(
                    Autodesk.AEC.FloorSelector.SELECTED_FLOOR_CHANGED,
                    this.onSelectedFloorChanged
                );
            }

            if (this.recordHistoryPanel) {
                this.recordHistoryPanel.uninitialize();
                delete this.recordHistoryPanel;
                this.recordHistoryPanel = null;
            }

            if (this.assetTool && this.assetTool.subToolbar) {
                let { subToolbar } = this.assetTool;
                subToolbar.removeControl(subToolbar.recordHistoryToolButton);
                subToolbar.removeControl(subToolbar.heatmapTimeBackwardToolButton);
                subToolbar.removeControl(subToolbar.heatmapTimeForwardToolButton);

                delete subToolbar.recordHistoryToolButton;
                delete subToolbar.heatmapTimeBackwardToolButton;
                delete subToolbar.heatmapTimeForwardToolButton;
            }

            if (this.dataHelper) {
                this.dataHelper.dispose();
                delete this.dataHelper;
                this.dataHelper = null;
            }

            Utility.resetObject(this.dbId2DeviceIdMap);
            Utility.resetObject(this.deviceId2DbIdMap);
            Utility.resetObject(this.modelExternalIdMaps);
            Utility.resetObject(this.styleMap);
            this.dbId2DeviceIdMap = {};
            this.deviceId2DbIdMap = {};
            this.modelExternalIdMaps = {};
            this.styleMap = {};

            this.sensorDbId = 1;
            this.currentHeatmapSensorType = 'temperature';
            this.currentTime = null;
            this.isHeatMapVisible = false;
            this.uiCreated = false;

            return true;
        }
    }
    BIM360IotConnectedExtension.SENSOR_DATA_CHANGED_EVENT = SENSOR_DATA_CHANGED_EVENT;
    Autodesk.Viewing.theExtensionManager.registerExtension('BIM360IotConnectedExtension', BIM360IotConnectedExtension);
})();