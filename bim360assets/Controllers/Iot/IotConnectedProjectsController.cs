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
using bim360assets.Models.Repositories;

namespace bim360assets.Controllers.Iot
{
    public partial class IotConnectedProjectsController : ControllerBase
    {
        private readonly IProjectRepository repository;

        public IotConnectedProjectsController(IProjectRepository repository)
        {
            this.repository = repository;
        }

        [HttpGet]
        [Route("api/iot/projects")]
        public async Task<IActionResult> GetProjects()
        {
            try
            {
                var projects = await this.repository.GetAll();

                return Ok(projects);
            }
            catch (Exception)
            {
                return BadRequest();
            }
        }

        [HttpPost]
        [Route("api/iot/projects")]
        public async Task<IActionResult> CreateProject([FromBody] Project project)
        {
            try
            {
                if (ModelState.IsValid)
                {
                    if (project.Id != 0)
                        project.Id = 0;

                    this.repository.Add(project);

                    await this.repository.SaveChangesAsync();
                }

                return Ok(project);
            }
            catch (Exception)
            {
                return BadRequest("Failed to save project from the database");
            }
        }

        [HttpPatch]
        [Route("api/iot/projects/{projectId}")]
        public async Task<IActionResult> EditProjectById([FromRoute] string projectId, [FromBody] Project data)
        {
            try
            {
                if (ModelState.IsValid)
                {
                    var results = await this.repository.GetAll(p => p.ExternalId == projectId);
                    var project = results.SingleOrDefault();

                    if (project == null)
                        return NotFound();

                    project.Name = data.Name;
                    project.ExternalId = data.ExternalId;

                    this.repository.Update(project);
                    await this.repository.SaveChangesAsync();

                    return Ok(project);
                }

                throw new Exception();
            }
            catch (Exception)
            {
                return BadRequest("Failed to save project from the database");
            }
        }

        [HttpGet]
        [Route("api/iot/projects/{projectId}")]
        public async Task<IActionResult> GetProjectById(string projectId)
        {
            try
            {
                var results = await this.repository.GetAll(p => p.ExternalId == projectId);
                var project = results.SingleOrDefault();

                if (project == null)
                    return NotFound();

                return Ok(project);
            }
            catch (Exception)
            {
                return BadRequest();
            }
        }

        [HttpDelete]
        [Route("api/iot/projects/{projectId}")]
        public async Task<IActionResult> DeleteProjectById(string projectId)
        {
            try
            {
                var results = await this.repository.GetAll(p => p.ExternalId == projectId);
                var project = results.SingleOrDefault();

                if (project == null)
                    return NotFound();

                this.repository.Delete(project.Id);

                await this.repository.SaveChangesAsync();

                return Ok(project);
            }
            catch (Exception)
            {
                return BadRequest("Failed to remove project from the database");
            }
        }
    }
}