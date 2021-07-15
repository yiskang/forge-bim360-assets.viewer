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
using Microsoft.AspNetCore.Mvc;
using bim360assets.Models.Iot;
using Microsoft.EntityFrameworkCore;

namespace bim360assets.Controllers
{
    public partial class BIM360IotConnectedController : ControllerBase
    {
        [HttpGet]
        [Route("api/iot/projects/{projectId}/sensors")]
        public async Task<IActionResult> GetSensors(string projectId)
        {
            try
            {
                var sensors = await this.dbContext.Sensors
                                    .Include(s => s.Project)
                                    .Where(s => s.Project.ExternalId == projectId)
                                    .AsNoTracking()
                                    .ToListAsync();

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
                    var projectInDb = await this.dbContext.Projects
                                            .Where(p => p.ExternalId == projectId)
                                            .SingleOrDefaultAsync();

                    if (projectInDb == null)
                        return NotFound("Project not found");

                    if (sensor.Id != 0)
                        sensor.Id = 0;

                    sensor.ProjectId = projectInDb.Id;

                    this.dbContext.Sensors.Add(sensor);

                    await this.dbContext.SaveChangesAsync();
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
        public async Task<IActionResult> EditSensorById([FromRoute] string projectId, [FromRoute] string sensorId, [FromBody] Sensor sensor)
        {
            try
            {
                if (ModelState.IsValid)
                {
                    var sensorInDb = await this.dbContext.Sensors
                                            .Include(s => s.Project)
                                            .Where(s => s.ExternalId == sensorId && s.Project.ExternalId == projectId)
                                            .SingleOrDefaultAsync();

                    if (sensorInDb == null)
                        return NotFound();

                    sensorInDb.Name = sensor.Name;
                    sensorInDb.ExternalId = sensor.ExternalId;

                    await this.dbContext.SaveChangesAsync();

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
                var sensor = await this.dbContext.Sensors
                                    .Include(s => s.Project)
                                    .Where(s => s.ExternalId == sensorId && s.Project.ExternalId == projectId)
                                    .AsNoTracking()
                                    .SingleOrDefaultAsync();

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
                var sensor = await this.dbContext.Sensors
                                    .Include(s => s.Project)
                                    .Where(s => s.ExternalId == sensorId && s.Project.ExternalId == projectId)
                                    .AsNoTracking()
                                    .SingleOrDefaultAsync();

                if (sensor == null)
                    return NotFound();

                this.dbContext.Remove(sensor);

                await this.dbContext.SaveChangesAsync();

                return Ok(sensor);
            }
            catch (Exception)
            {
                return BadRequest("Failed to remove sensor from the database");
            }
        }

        [HttpPost]
        [Route("api/iot/projects/{projectId}/sensors/{sensorId}/records")]
        public async Task<IActionResult> InsertSensorValueById([FromRoute] string projectId, [FromRoute] string sensorId, [FromBody] Record record)
        {
            try
            {
                if (ModelState.IsValid)
                {
                   var sensorInDb = await this.dbContext.Sensors
                                    .Include(s => s.Project)
                                    .Where(s => s.ExternalId == sensorId && s.Project.ExternalId == projectId)
                                    .AsNoTracking()
                                    .SingleOrDefaultAsync();

                    if (sensorInDb == null)
                        return NotFound();

                    record.SensorId = sensorInDb.Id;
                    this.dbContext.Records.Add(record);

                    await this.dbContext.SaveChangesAsync();

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
        // [Route("api/iot/projects/{projectId}/sensors/{sensorId}/records:aggregate")]
        // [Route("api/iot/projects/{projectId}/sensors/{sensorId}/records:mock")]
        public async Task<IActionResult> GetSensorValuesById([FromRoute] string projectId, [FromRoute] string sensorId)
        {
            try
            {
                if (ModelState.IsValid)
                {
                   var records = await this.dbContext.Records
                                        .Include(r => r.Sensor)
                                            .ThenInclude(s => s.Project)
                                        .Where(r => r.Sensor.ExternalId == sensorId && r.Sensor.Project.ExternalId == projectId)
                                        .AsNoTracking()
                                        .ToListAsync();

                    return Ok(records);
                }

                throw new Exception();
            }
            catch (Exception)
            {
                return BadRequest();
            }
        }
    }
}