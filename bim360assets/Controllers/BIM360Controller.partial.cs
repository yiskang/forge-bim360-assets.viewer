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
using System.Text;
using System.Net;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Linq;
using Microsoft.AspNetCore.Mvc;
using Autodesk.Forge;
using RestSharp;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using bim360assets.Models;
using System.Web;
using Microsoft.AspNetCore.Http.Extensions;
using Microsoft.AspNetCore.WebUtilities;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;

namespace bim360assets.Controllers
{
    public partial class BIM360Controller : ControllerBase
    {
        private static string[] supportedSensorNames = new string[] { "Temperature", "Humidity" };
        private static string[] supportedSensorCustomAttributes = new string[]
        {
            "External Id",
            "Sensor.[0].Id", "Sensor.[0].Name", "Sensor.[0].DataType",
            "Sensor.[0].DataUnit", "Sensor.[0].RangeMin", "Sensor.[0].RangeMax"
        };

        private string sensorNameCustomAttr
        {
            get
            {
                return supportedSensorCustomAttributes[2];
            }
        }

        [HttpGet]
        [Route("api/forge/bim360/account/{accountId}/project/{projectId}/sensors-attrs")]
        public async Task<IActionResult> GetSensorAttributes(string accountId, string projectId)
        {
            var attrDefsResponse = await GetCustomAttributeDefsAsync(projectId.Replace("b.", string.Empty), null);
            var attrDefs = JsonConvert.DeserializeObject<PaginatedAssetCustomAttributes>(attrDefsResponse.Content);

            var results = attrDefs.Results.Where(attr => supportedSensorCustomAttributes.Contains(attr.DisplayName));

            return Ok(results);
        }

        [HttpGet]
        [Route("api/forge/bim360/account/{accountId}/project/{projectId}/sensors")]
        public async Task<IActionResult> GetSensors(string accountId, string projectId)
        {
            var assets = await this.GetAssetsBySensorNamesAsync(projectId);

            return Ok(assets.Select(a => a.CustomAttributes));
        }

        private async Task<List<Asset>> GetAssetsBySensorNamesAsync(string projectId)
        {
            var sensorNameAttr = await this.GetCustomAttributeByNameAsync(projectId, this.sensorNameCustomAttr);
            var paginatedAssets = supportedSensorNames
                .Select(name => this.GetAssetsByCustomAttributeAsync(projectId, sensorNameAttr.Name, name, null, 100))
                .ToList();

            var results = await Task.WhenAll(paginatedAssets);
            var query = results.AsQueryable().Where(a => a != null);

            if (query == null || query.Count() <= 0)
                return new List<Asset>();

            return query.SelectMany(a => a.Results)
                    .ToList();
        }

        private async Task<AssetCustomAttribute> GetCustomAttributeByNameAsync(string projectId, string name)
        {
            var attrDefsResponse = await GetCustomAttributeDefsAsync(projectId.Replace("b.", string.Empty), null, 100);
            var attrDefs = JsonConvert.DeserializeObject<PaginatedAssetCustomAttributes>(attrDefsResponse.Content);
            var attr = attrDefs.Results.First(attr => attr.DisplayName.Contains(name));

            if (attr == null)
            {
                throw new InvalidOperationException($"Failed to get CustomAttribute called `{name}`");
            }

            return attr;
        }

        private async Task<PaginatedAssets> GetAssetsByCustomAttributeAsync(string projectId, string name, string value, string cursorState, Nullable<int> pageLimit = null)
        {
            Credentials credentials = await Credentials.FromSessionAsync(base.Request.Cookies, Response.Cookies);
            if (credentials == null)
            {
                throw new InvalidOperationException("Failed to refresh access token");
            }

            var attrFilter = $"filter[customAttributes][{name}]";

            RestClient client = new RestClient(BASE_URL);
            RestRequest request = new RestRequest("/bim360/assets/v2/projects/{project_id}/assets", RestSharp.Method.GET);
            request.AddParameter("project_id", projectId.Replace("b.", string.Empty), ParameterType.UrlSegment);
            request.AddParameter("includeCustomAttributes", true, ParameterType.QueryString);
            request.AddParameter(attrFilter, value, ParameterType.QueryString);
            request.AddHeader("Authorization", "Bearer " + credentials.TokenInternal);

            if (!string.IsNullOrWhiteSpace(cursorState))
            {
                request.AddParameter("cursorState", cursorState, ParameterType.QueryString);
            }

            if (pageLimit != null && pageLimit.HasValue)
            {
                request.AddParameter("limit", pageLimit.Value, ParameterType.QueryString);
            }

            IRestResponse assetsResponse = await client.ExecuteTaskAsync(request);
            var assets = JsonConvert.DeserializeObject<PaginatedAssets>(assetsResponse.Content);

            if (assets.Results == null || assets.Results.Count <= 0)
                return null;

            if (assets.Pagination.CursorState == null)
                return assets;

            var nextCursorState = new
            {
                offset = assets.Pagination.Offset + assets.Pagination.Limit,
                limit = assets.Pagination.Limit
            };
            var nextCursorStateStr = JsonConvert.SerializeObject(nextCursorState);
            var encodedNextCursorStateStr = Convert.ToBase64String(Encoding.UTF8.GetBytes(nextCursorStateStr));

            return await GetAssetsByCustomAttributeAsync(projectId, name, value, encodedNextCursorStateStr, assets.Pagination.Limit);
        }
    }
}