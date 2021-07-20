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
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
/////////////////////////////////////////////////////////////////////

using System;
using System.Threading.Tasks;
using System.Linq;
using System.Collections.Generic;
using Microsoft.AspNetCore.Mvc;
using bim360assets.Models.Iot;
using Microsoft.EntityFrameworkCore;
using bim360assets.Models.Repositories;
using bim360assets.Services;

namespace bim360assets.Controllers
{
    public class IotConnectedSensorsController : ControllerBase
    {
        private static string[] supportedSensorTypes = new string[] { "Temperature", "Humidity" };
        private readonly IProjectRepository projectRepository;
        private readonly ISensorRepository sensorRepository;
        private readonly IRecordRepository recordRepository;
        private readonly IOpenWeatherMapService weatherDataService;

        public IotConnectedSensorsController(IProjectRepository projectRepository, ISensorRepository sensorRepository, IRecordRepository recordRepository, IOpenWeatherMapService weatherDataService)
        {
            this.projectRepository = projectRepository;
            this.sensorRepository = sensorRepository;
            this.recordRepository = recordRepository;
            this.weatherDataService = weatherDataService;
        }

        [HttpGet]
        [Route("api/iot/projects/{projectId}/sensors")]
        public async Task<IActionResult> GetSensors(string projectId)
        {
            try
            {
                var sensors = await this.sensorRepository.GetAll("Project", s => s.Project.ExternalId == projectId);

                return Ok(sensors);
            }
            catch (Exception)
            {
                return BadRequest();
            }
        }

        [HttpPost]
        [Route("api/iot/projects/{projectId}/sensors")]
        public async Task<IActionResult> CreateSensor([FromRoute] string projectId, [FromBody] Sensor sensor)
        {
            try
            {
                if (ModelState.IsValid)
                {
                    var project = await this.projectRepository.Get(p => p.ExternalId == projectId);

                    if (project == null)
                        return NotFound($"Project not found with external id = {projectId}");

                    if (sensor.Id != 0)
                        sensor.Id = 0;

                    sensor.ProjectId = project.Id;

                    this.sensorRepository.Add(sensor);

                    await this.sensorRepository.SaveChangesAsync();
                }

                return Ok(sensor);
            }
            catch (Exception)
            {
                return BadRequest("Failed to save sensor to the database");
            }
        }

        [HttpPatch]
        [Route("api/iot/projects/{projectId}/sensors/{sensorId}")]
        public async Task<IActionResult> EditSensorById([FromRoute] string projectId, [FromRoute] string sensorId, [FromBody] Sensor data)
        {
            try
            {
                if (ModelState.IsValid)
                {
                    var sensor = await this.sensorRepository.Get("Project", s => s.ExternalId == sensorId && s.Project.ExternalId == projectId);

                    if (sensor == null)
                        return NotFound();

                    sensor.Name = data.Name;
                    sensor.ExternalId = data.ExternalId;

                    this.sensorRepository.Update(sensor);

                    await this.sensorRepository.SaveChangesAsync();

                    return Ok(sensor);
                }

                throw new Exception();
            }
            catch (Exception)
            {
                return BadRequest("Failed to save sensor to the database");
            }
        }

        [HttpGet]
        [Route("api/iot/projects/{projectId}/sensors/{sensorId}")]
        public async Task<IActionResult> GetSensorById([FromRoute] string projectId, string sensorId)
        {
            try
            {
                var sensor = await this.sensorRepository.Get("Project", s => s.ExternalId == sensorId && s.Project.ExternalId == projectId);

                if (sensor == null)
                    return NotFound();

                return Ok(sensor);
            }
            catch (Exception)
            {
                return BadRequest();
            }
        }

        [HttpDelete]
        [Route("api/iot/projects/{projectId}/sensors/{sensorId}")]
        public async Task<IActionResult> DeleteSensorById([FromRoute] string projectId, string sensorId)
        {
            try
            {
                var sensor = await this.sensorRepository.Get("Project", s => s.ExternalId == sensorId && s.Project.ExternalId == projectId);

                if (sensor == null)
                    return NotFound();

                this.sensorRepository.Delete(sensor.Id);

                await this.sensorRepository.SaveChangesAsync();

                return Ok(sensor);
            }
            catch (Exception)
            {
                return BadRequest("Failed to remove sensor from the database");
            }
        }

        [HttpPost]
        [Route("api/iot/projects/{projectId}/sensors/{sensorId}/records")]
        public async Task<IActionResult> InsertSensorValueById([FromRoute] string projectId, [FromRoute] string sensorId, [FromBody] Record data)
        {
            try
            {
                if (ModelState.IsValid)
                {
                    var sensor = await this.sensorRepository.Get("Project", s => s.ExternalId == sensorId && s.Project.ExternalId == projectId);

                    if (sensor == null)
                        return NotFound();

                    data.SensorId = sensor.Id;
                    this.recordRepository.Add(data);

                    await this.recordRepository.SaveChangesAsync();

                    return Ok();
                }

                throw new Exception();
            }
            catch (Exception)
            {
                return BadRequest("Failed to save sensor value to the database");
            }
        }

        [HttpGet]
        [Route("api/iot/projects/{projectId}/sensors/{sensorId}/records")]
        public async Task<IActionResult> GetSensorValuesById([FromRoute] string projectId, [FromRoute] string sensorId)
        {
            try
            {
                if (ModelState.IsValid)
                {
                    var includes = new string[] { "Sensor", "Sensor.Project" };
                    var records = await this.recordRepository.GetAll(includes, r => r.Sensor.ExternalId == sensorId && r.Sensor.Project.ExternalId == projectId);

                    return Ok(records);
                }

                throw new Exception();
            }
            catch (Exception)
            {
                return BadRequest();
            }
        }

        private async Task<List<Record>> MockRecordsBySensor(Sensor sensor)
        {
            if (sensor == null)
                throw new InvalidOperationException();

            var weatherData = await this.weatherDataService.GetWeatherDataForPastDays();

            var result = new List<Record>();

            foreach (var data in weatherData)
            {
                var dt = (new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Local)).AddSeconds(data.Timestamp).ToUniversalTime();
                Record record = null;
                if (sensor.Name == "Temperature")
                {
                    record = new Record
                    {
                        CreatedAt = dt,
                        Value = data.Temperature,
                        SensorId = sensor.Id
                    };

                    this.recordRepository.Add(record);

                    var isSaved = await this.recordRepository.SaveChangesAsync();
                    if (isSaved)
                        result.Add(record);
                }
                else if (sensor.Name == "Humidity")
                {
                    record = new Record
                    {
                        CreatedAt = dt,
                        Value = data.Humidity,
                        SensorId = sensor.Id
                    };

                    this.recordRepository.Add(record);

                    var isSaved = await this.recordRepository.SaveChangesAsync();
                    if (isSaved)
                        result.Add(record);
                }
            }

            return result;
        }

        [HttpPost]
        [Route("api/iot/projects/{projectId}/records:batch-mock")]
        public async Task<IActionResult> MockRecordsForAllSensors([FromRoute] string projectId)
        {
            try
            {
                var sensors = await this.sensorRepository.GetAll("Project", s => s.Project.ExternalId == projectId);
                var result = new Dictionary<string, List<Record>>();

                foreach (var sensor in sensors)
                {
                    try
                    {
                        var records = await this.MockRecordsBySensor(sensor);
                        result.Add(sensor.ExternalId, records);
                    }
                    catch (Exception ex)
                    {
                        result.Add(sensor.ExternalId, null);
                    }
                }

                return Ok(result);
            }
            catch (Exception)
            {
                return BadRequest();
            }
        }

        [HttpPost]
        [Route("api/iot/projects/{projectId}/sensors/{sensorId}/records:mock")]
        public async Task<IActionResult> MockSensorValuesById([FromRoute] string projectId, [FromRoute] string sensorId)
        {
            try
            {
                var sensor = await this.sensorRepository.Get("Project", s => s.ExternalId == sensorId && s.Project.ExternalId == projectId);

                if (sensor == null)
                    return NotFound();

                var result = this.MockRecordsBySensor(sensor);

                return Ok(result);
            }
            catch (Exception)
            {
                return BadRequest();
            }
        }

        private class AggregateResult
        {
            public double Sum { get; set; }
            public int Count { get; set; }
        }

        private class AggregateRecordResult
        {
            public string SensorId { get; set; }
            public string Name { get; set; }
            public List<int> Timestamps { get; set; }
            public List<double> Min { get; set; }
            public List<double> Max { get; set; }
            public List<int> Count { get; set; }
            public List<double> Sum { get; set; }
            public List<double> Avg { get; set; }
        }

        private TimeSpan ConvertDurationToSeconds(string resolution)
        {
            var duration = Iso8601DurationHelper.Duration.Parse(resolution);
            DateTime now = DateTime.Now;

            var date = now.AddYears(Convert.ToInt32(duration.Years))
                        .AddMonths(Convert.ToInt32(duration.Months))
                        .AddDays(Convert.ToInt32(duration.Days + duration.Weeks * 7))
                        .AddHours(Convert.ToInt32(duration.Hours))
                        .AddMinutes(Convert.ToInt32(duration.Minutes))
                        .AddSeconds(Convert.ToInt32(duration.Seconds));

            return date - now;
        }

        private async Task<AggregateRecordResult> GetAggregateRecordsByType(string projectId, string sensorId, string type, int startTimestamp, int endTimestamp, string resolution = "PT1H")
        {
            try
            {
                int rez = (int)this.ConvertDurationToSeconds(resolution).TotalSeconds;
                int startSec = (int)Math.Round(startTimestamp - (double)rez / 2);
                int endSec = (int)Math.Round(endTimestamp + (double)rez / 2);

                var includes = new string[] { "Sensor", "Sensor.Project" };
                var records = await this.recordRepository.GetAll(includes, r => r.Sensor.Name == type && r.Sensor.ExternalId == sensorId && r.Sensor.Project.ExternalId == projectId);

                var results = new Dictionary<int, AggregateResult>();
                var min = new Dictionary<int, double>();
                var max = new Dictionary<int, double>();
                var counts = new Dictionary<int, int>();

                foreach (Record record in records)
                {
                    // https://github.com/Autodesk-Forge/forge-dataviz-iot-data-modules/blob/main/server/gateways/Hyperion.Server.CsvGateway.js#L67
                    // https://github.com/Autodesk-Forge/forge-dataviz-iot-reference-app/blob/main/server/router/DataAPI.js#L115
                    // https://github.com/Autodesk-Forge/forge-dataviz-iot-data-modules/search?q=resolution

                    var utcDate = record.CreatedAt.ToUniversalTime();
                    var timestamp = (int)utcDate.Subtract(new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Local)).TotalSeconds;

                    if (timestamp >= startSec && timestamp <= endSec)
                    {
                        int index = (int)Math.Round((timestamp - startSec) / (double)rez);
                        //System.Diagnostics.Trace.WriteLine(index);
                        double value = record.Value;

                        if (results.ContainsKey(index))
                        {
                            var sum = results[index].Sum;
                            var count = results[index].Count;
                            results[index].Sum = sum + value;
                            results[index].Count = count + 1;

                            min[index] = Math.Min(min[index], value);
                            max[index] = Math.Max(max[index], value);
                            counts[index] = count;
                        }
                        else
                        {
                            results[index] = new AggregateResult
                            {
                                Sum = value,
                                Count = 1
                            };

                            min[index] = value;
                            max[index] = value;
                            counts[index] = 1;
                        }
                    }
                }

                var timestamps = new Dictionary<int, int>();
                var aggregate = new Dictionary<int, double>();
                var sums = new Dictionary<int, double>();

                foreach (var item in results)
                {
                    var index = item.Key;
                    var value = item.Value;
                    timestamps.Add(index, (int)(startSec + rez * index));
                    var sum = value.Sum;
                    var count = value.Count;
                    aggregate.Add(index, sum / count);
                    sums.Add(index, sum);
                }

                return new AggregateRecordResult
                {
                    SensorId = sensorId,
                    Name = type,
                    Timestamps = timestamps.Select(d => d.Value).ToList(),
                    Min = min.Select(d => d.Value).ToList(),
                    Max = max.Select(d => d.Value).ToList(),
                    Count = counts.Select(d => d.Value).ToList(),
                    Sum = sums.Select(d => d.Value).ToList(),
                    Avg = aggregate.Select(d => d.Value).ToList()
                };
            }
            catch (Exception ex)
            {
                return null;
            }
        }

        [HttpGet]
        [Route("api/iot/projects/{projectId}/sensors/{sensorId}/records:aggregate")]
        public async Task<IActionResult> GetAggregateSensorValuesByType([FromRoute] string projectId, [FromRoute] string sensorId, [FromQuery] string type, [FromQuery] int startTimestamp, [FromQuery] int endTimestamp, [FromQuery] string resolution = "PT1H")
        {
            try
            {
                var result = await this.GetAggregateRecordsByType(projectId, sensorId, type, startTimestamp, endTimestamp, resolution);

                if (result == null)
                    throw new Exception();

                return Ok(new
                {
                    SensorId = result.SensorId,
                    Name = result.Name,
                    Time = result.Timestamps.Select(dt => (new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Local)).AddSeconds(dt).ToUniversalTime()).ToList(),
                    Min = result.Min,
                    Max = result.Max,
                    Count = result.Count,
                    Sum = result.Sum,
                    Avg = result.Avg
                });
            }
            catch (Exception ex)
            {
                return BadRequest();
            }
        }

        [HttpGet]
        [Route("api/iot/projects/{projectId}/records:time-range")]
        public IActionResult GetTimeRange([FromRoute] string projectId)
        {
            try
            {
                var includes = new string[] { "Sensor", "Sensor.Project" };

                return Ok(new
                {
                    min = this.recordRepository.GetTimeMin(includes, r => r.Sensor.Project.ExternalId == projectId),
                    max = this.recordRepository.GetTimeMax(includes, r => r.Sensor.Project.ExternalId == projectId)
                });
            }
            catch (Exception ex)
            {
                return BadRequest();
            }
        }
    }
}