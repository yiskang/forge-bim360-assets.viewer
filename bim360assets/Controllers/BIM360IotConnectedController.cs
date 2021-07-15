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
        private readonly DataBaseContext dbContext;

        public BIM360IotConnectedController(DataBaseContext context)
        {
            this.dbContext = context;
        }

        [HttpGet]
        [Route("api/iot/projects")]
        public async Task<IActionResult> GetProjects()
        {
            try
            {
                var projects = await this.dbContext.Projects
                                    .AsNoTracking()
                                    .ToListAsync();

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

                    this.dbContext.Projects.Add(project);

                    await this.dbContext.SaveChangesAsync();
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
        public async Task<IActionResult> EditProjectById([FromRoute] string projectId, [FromBody] Project project)
        {
            try
            {
                if (ModelState.IsValid)
                {
                    var projectInDb = await this.dbContext.Projects
                                            .Where(p => p.ExternalId == projectId)
                                            .AsNoTracking()
                                            .SingleOrDefaultAsync();

                if (projectInDb == null)
                    return NotFound();

                    projectInDb.Name = project.Name;
                    projectInDb.ExternalId = project.ExternalId;

                    await this.dbContext.SaveChangesAsync();

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
                var project = await this.dbContext.Projects
                                    .Where(p => p.ExternalId == projectId)
                                    .AsNoTracking()
                                    .SingleOrDefaultAsync();

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
                var project = await this.dbContext.Projects
                                    .Where(p => p.ExternalId == projectId)
                                    .SingleOrDefaultAsync();

                if (project == null)
                    return NotFound();

                this.dbContext.Remove(project);

                await this.dbContext.SaveChangesAsync();

                return Ok(project);
            }
            catch (Exception)
            {
                return BadRequest("Failed to remove project from the database");
            }
        }
    }
}