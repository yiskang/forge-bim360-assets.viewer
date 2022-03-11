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
using bim360assets.Models;
using RestSharp;
using Newtonsoft.Json;
using System.Collections.Generic;
using System.Text;

namespace bim360assets.Libs
{
    public class BIM360DataUtil
    {
        private const string BASE_URL = "https://developer.api.autodesk.com";

        public static async Task<PaginatedAssetCustomAttributes> GetCustomAttributeDefsAsync(string accessToken, string projectId, string cursorState, Nullable<int> pageLimit = null)
        {
            RestClient client = new RestClient(BASE_URL);
            RestRequest request = new RestRequest("/bim360/assets/v1/projects/{project_id}/custom-attributes", RestSharp.Method.GET);
            request.AddParameter("project_id", projectId.Replace("b.", string.Empty), ParameterType.UrlSegment);
            request.AddHeader("Authorization", "Bearer " + accessToken);

            if (!string.IsNullOrWhiteSpace(cursorState))
            {
                request.AddParameter("cursorState", cursorState, ParameterType.QueryString);
            }

            if (pageLimit != null && pageLimit.HasValue)
            {
                request.AddParameter("limit", pageLimit.Value, ParameterType.QueryString);
            }

            var attrDefsResponse = await client.ExecuteTaskAsync(request);
            var attrDefs = JsonConvert.DeserializeObject<PaginatedAssetCustomAttributes>(attrDefsResponse.Content);
            return attrDefs;
        }

        public static async Task<AssetCustomAttribute> GetCustomAttributeByNameAsync(string accessToken, string projectId, string name)
        {
            var attrDefs = await GetCustomAttributeDefsAsync(accessToken, projectId.Replace("b.", string.Empty), null, 100);
            var attr = attrDefs.Results.First(attr => attr.DisplayName.Contains(name));

            if (attr == null)
            {
                throw new InvalidOperationException($"Failed to get CustomAttribute called `{name}`");
            }

            return attr;
        }

        public static async Task<PaginatedAssets> GetAssetsByCustomAttributeAsync(string accessToken, string projectId, string name, string value, string cursorState, Nullable<int> pageLimit = null)
        {
            var attrFilter = $"filter[customAttributes][{name}]";

            RestClient client = new RestClient(BASE_URL);
            RestRequest request = new RestRequest("/bim360/assets/v2/projects/{project_id}/assets", RestSharp.Method.GET);
            request.AddParameter("project_id", projectId.Replace("b.", string.Empty), ParameterType.UrlSegment);
            request.AddParameter("includeCustomAttributes", true, ParameterType.QueryString);
            request.AddParameter(attrFilter, value, ParameterType.QueryString);
            request.AddHeader("Authorization", "Bearer " + accessToken);

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

            return await GetAssetsByCustomAttributeAsync(accessToken, projectId, name, value, encodedNextCursorStateStr, assets.Pagination.Limit);
        }
    }
}