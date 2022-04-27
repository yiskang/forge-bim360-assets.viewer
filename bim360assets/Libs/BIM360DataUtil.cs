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
using System.Text;
using Microsoft.AspNetCore.Mvc;
using bim360assets.Models.Iot;
using bim360assets.Models.Repositories;
using bim360assets.Models;
using RestSharp;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Autodesk.Forge;
using Autodesk.Forge.Model;
using System.IO;
using System.Text.RegularExpressions;

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

            var attrDefsResponse = await client.ExecuteAsync(request);
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

            IRestResponse assetsResponse = await client.ExecuteAsync(request);
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

        public static async Task<dynamic> BuildPropertyIndexesAsync(string accessToken, string projectId, List<string> versionIds)
        {
            RestClient client = new RestClient(BASE_URL);
            RestRequest request = new RestRequest("/construction/index/v2/projects/{project_id}/indexes:batchStatus", RestSharp.Method.POST);
            request.AddParameter("project_id", projectId.Replace("b.", string.Empty), ParameterType.UrlSegment);
            request.AddHeader("Authorization", "Bearer " + accessToken);

            var data = versionIds.Select(versionId => new
            {
                versionUrn = versionId
            });

            request.AddJsonBody(new
            {
                versions = data
            });

            IRestResponse indexingResponse = await client.ExecuteAsync(request);
            var result = JsonConvert.DeserializeObject<dynamic>(indexingResponse.Content);
            return result;
        }

        public static async Task<dynamic> GetPropertyIndexesStatusAsync(string accessToken, string projectId, string indexId)
        {
            RestClient client = new RestClient(BASE_URL);
            RestRequest request = new RestRequest("/construction/index/v2/projects/{project_id}/indexes/{index_id}", RestSharp.Method.GET);
            request.AddParameter("project_id", projectId.Replace("b.", string.Empty), ParameterType.UrlSegment);
            request.AddParameter("index_id", indexId, ParameterType.UrlSegment);
            request.AddHeader("Authorization", "Bearer " + accessToken);

            IRestResponse response = await client.ExecuteAsync(request);
            var result = JsonConvert.DeserializeObject<dynamic>(response.Content);
            return result;
        }

        public static async Task<dynamic> GetPropertyIndexesManifestAsync(string accessToken, string projectId, string indexId)
        {
            RestClient client = new RestClient(BASE_URL);
            RestRequest request = new RestRequest("/construction/index/v2/projects/{project_id}/indexes/{index_id}/manifest", RestSharp.Method.GET);
            request.AddParameter("project_id", projectId.Replace("b.", string.Empty), ParameterType.UrlSegment);
            request.AddParameter("index_id", indexId, ParameterType.UrlSegment);
            request.AddHeader("Authorization", "Bearer " + accessToken);

            IRestResponse response = await client.ExecuteAsync(request);
            var result = JsonConvert.DeserializeObject<dynamic>(response.Content);
            return result;
        }

        public static async Task<dynamic> BuildPropertyQueryAsync(string accessToken, string projectId, string indexId, JObject data)
        {
            RestClient client = new RestClient(BASE_URL);
            RestRequest request = new RestRequest("/construction/index/v2/projects/{project_id}/indexes/{index_id}/queries", RestSharp.Method.POST);
            request.AddParameter("project_id", projectId.Replace("b.", string.Empty), ParameterType.UrlSegment);
            request.AddParameter("index_id", indexId, ParameterType.UrlSegment);
            request.AddHeader("Authorization", "Bearer " + accessToken);
            //request.AddJsonBody(data);

            var body = JsonConvert.SerializeObject(data);
            request.AddParameter("application/json", body, ParameterType.RequestBody);

            IRestResponse response = await client.ExecuteAsync(request);
            var result = JsonConvert.DeserializeObject<dynamic>(response.Content);
            return result;
        }

        public static async Task<dynamic> GetPropertyQueryStatusAsync(string accessToken, string projectId, string indexId, string queryId)
        {
            RestClient client = new RestClient(BASE_URL);
            RestRequest request = new RestRequest("/construction/index/v2/projects/{project_id}/indexes/{index_id}/queries/{query_id}", RestSharp.Method.GET);
            request.AddParameter("project_id", projectId.Replace("b.", string.Empty), ParameterType.UrlSegment);
            request.AddParameter("index_id", indexId, ParameterType.UrlSegment);
            request.AddParameter("query_id", queryId, ParameterType.UrlSegment);
            request.AddHeader("Authorization", "Bearer " + accessToken);

            IRestResponse response = await client.ExecuteAsync(request);
            var result = JsonConvert.DeserializeObject<dynamic>(response.Content);
            return result;
        }

        public static List<JObject> ParseLineDelimitedJson(string content)
        {
            var data = new List<JObject>();
            using (var jsonTextReader = new JsonTextReader(new StringReader(content)))
            {
                jsonTextReader.SupportMultipleContent = true;
                var jsonSerializer = new JsonSerializer();
                while (jsonTextReader.Read())
                {
                    var item = jsonSerializer.Deserialize<JObject>(jsonTextReader);
                    data.Add(item);
                }
            }
            return data;
        }

        public static async Task<dynamic> GetPropertyFieldsAsync(string accessToken, string projectId, string indexId)
        {
            RestClient client = new RestClient(BASE_URL);
            RestRequest request = new RestRequest("/construction/index/v2/projects/{project_id}/indexes/{index_id}/fields", RestSharp.Method.GET);
            request.AddParameter("project_id", projectId.Replace("b.", string.Empty), ParameterType.UrlSegment);
            request.AddParameter("index_id", indexId, ParameterType.UrlSegment);
            request.AddHeader("Authorization", "Bearer " + accessToken);

            IRestResponse response = await client.ExecuteAsync(request);
            var data = ParseLineDelimitedJson(response.Content);
            return data;
        }

        public static async Task<List<JObject>> GetPropertyQueryResultsAsync(string accessToken, string projectId, string indexId, string queryId)
        {
            RestClient client = new RestClient(BASE_URL);
            RestRequest request = new RestRequest("/construction/index/v2/projects/{project_id}/indexes/{index_id}/queries/{query_id}/properties", RestSharp.Method.GET);
            request.AddParameter("project_id", projectId.Replace("b.", string.Empty), ParameterType.UrlSegment);
            request.AddParameter("index_id", indexId, ParameterType.UrlSegment);
            request.AddParameter("query_id", queryId, ParameterType.UrlSegment);
            request.AddHeader("Authorization", "Bearer " + accessToken);

            IRestResponse response = await client.ExecuteAsync(request);
            var data = ParseLineDelimitedJson(response.Content);
            return data;
        }

        public static async Task<List<Level>> GetLevelsFromAecModelData(string accessToken, string urn)
        {
            var derivativeApi = new DerivativesApi();
            string aecModelDataUrn = string.Empty;
            var data = await derivativeApi.GetManifestAsync(urn);
            var result = Newtonsoft.Json.JsonConvert.DeserializeObject<Newtonsoft.Json.Linq.JObject>(data.ToString());

            foreach (var derivative in result.derivatives)
            {
                if ((((dynamic)derivative).outputType != "svf") && (((dynamic)derivative).outputType != "svf2")) continue;

                foreach (var derivativeChild in ((dynamic)derivative).children)
                {
                    if (((dynamic)derivativeChild).role != "Autodesk.AEC.ModelData") continue;

                    aecModelDataUrn = ((dynamic)derivativeChild).urn;
                    break;
                }

                if (!string.IsNullOrWhiteSpace(aecModelDataUrn))
                    break;
            }

            System.IO.MemoryStream stream = await derivativeApi.GetDerivativeManifestAsync(urn, aecModelDataUrn);
            if (stream == null)
                throw new InvalidOperationException("Failed to download AecModelData");

            stream.Seek(0, SeekOrigin.Begin);

            JObject aecdata;
            var serializer = new JsonSerializer();
            using (var sr = new StreamReader(stream))
            using (var jsonTextReader = new JsonTextReader(sr))
            {
                aecdata = serializer.Deserialize<JObject>(jsonTextReader);
            }

            if (aecdata == null)
                throw new InvalidOperationException("Failed to proccess AecModelData");

            var levelJsonToken = aecdata.GetValue("levels");
            var levelData = levelJsonToken.ToObject<List<AecLevel>>();

            var filteredLevels = levelData.Where(lvl => lvl.Extension != null)
                    .Where(lvl => lvl.Extension.BuildingStory == true)
                    .ToList();

            Func<AecLevel, double> getProjectElevation = default(Func<AecLevel, double>);
            getProjectElevation = level =>
            {
                return level.Extension.ProjectElevation.HasValue ? level.Extension.ProjectElevation.Value : level.Elevation;
            };

            var levels = new List<Level>();
            double zOffsetHack = 1.0 / 12.0;
            for (var i = 0; i < filteredLevels.Count; i++)
            {
                var level = filteredLevels[i];
                double nextElevation;
                if (i + 1 < filteredLevels.Count)
                {
                    var nextLevel = filteredLevels[i + 1];
                    nextElevation = getProjectElevation(nextLevel);
                }
                else
                {
                    var topLevel = filteredLevels[filteredLevels.Count - 1];
                    var topElevation = getProjectElevation(topLevel);
                    nextElevation = topElevation + topLevel.Height;
                }

                levels.Add(new Level
                {
                    Index = i + 1,
                    Guid = level.Guid,
                    Name = level.Name,
                    ZMin = getProjectElevation(level) - zOffsetHack,
                    ZMax = nextElevation,
                });
            }

            return levels;
        }

        public static async Task<dynamic> QueryRoomsPropertiesAsync(string accessToken, string projectId, string indexId, string roomCategoryName = "'Revit Rooms'")
        {
            var data = new JObject(
                new JProperty("query",
                    new JObject(
                        new JProperty("$and",
                            new JArray {
                                new JObject(
                                    new JProperty("$eq",
                                        new JArray
                                        {
                                            new JValue("s.props.p5eddc473"),
                                            new JValue(roomCategoryName)
                                        }
                                    )
                                ),
                                // new JObject(
                                //     new JProperty("$eq",
                                //         new JArray
                                //         {
                                //             new JValue("s.props.p6ab86626"),
                                //             new JValue("'Level 2'")
                                //         }
                                //     )
                                // ),
                                new JObject(
                                    new JProperty("$gt",
                                        new JArray
                                        {
                                            new JObject(
                                                new JProperty("$count",
                                                    new JValue("s.views")
                                                )
                                            ),
                                            new JValue(0)
                                        }
                                    )
                                )
                            }
                        )
                    )
                ),
                new JProperty("columns",
                    new JObject(
                        new JProperty("s.svf2Id",
                            new JValue(true)
                        ),
                        new JProperty("s.externalId",
                            new JValue(true)
                        ),
                        new JProperty("svfId",
                            new JValue("s.lmvId")
                        ),
                        new JProperty("level",
                            new JValue("s.props.p01bbdcf2") //!<<< Might need to be changed by models
                        ),
                        new JProperty("name",
                            new JValue("s.props.p153cb174")
                        ),
                        new JProperty("category",
                            new JValue("s.props.p5eddc473")
                        ),
                        new JProperty("revitCategory",
                            new JValue("s.props.p20d8441e")
                        ),
                        new JProperty("s.views",
                            new JValue(true)
                        )
                    )
                )
            );

            return await BuildPropertyQueryAsync(accessToken, projectId, indexId, data);
        }

        public static async Task<dynamic> BuildSpaceDataAsync(string accessToken, string projectId, List<string> versionIds, bool buildTree = false)
        {
            dynamic indexingRes = await BuildPropertyIndexesAsync(accessToken, projectId, versionIds);
            string indexId = indexingRes.indexes[0].indexId;
            string state = indexingRes.indexes[0].state;
            while (state != "FINISHED")
            {
                //keep polling
                dynamic result = await GetPropertyIndexesStatusAsync(accessToken, projectId, indexId);
                state = result.state;
            }

            dynamic queryRes = await QueryRoomsPropertiesAsync(accessToken, projectId, indexId);
            string queryId = queryRes.queryId;
            state = queryRes.state;

            while (state != "FINISHED")
            {
                //keep polling
                dynamic result = await GetPropertyQueryStatusAsync(accessToken, projectId, indexId, queryId);
                state = result.state;
            }

            List<JObject> queryResultRes = await GetPropertyQueryResultsAsync(accessToken, projectId, indexId, queryId);
            dynamic manifestRes = await GetPropertyIndexesManifestAsync(accessToken, projectId, indexId);
            //dynamic fieldRes = await GetPropertyFieldsAsync(accessToken, projectId, indexId);

            var views = manifestRes.seedFiles[0].views as JArray;
            // Assume that rooms extracted in one phase/master view only.
            dynamic view = views.Where(view => ((string)((dynamic)view).id) == (string)((dynamic)queryResultRes[0]).views[0]).FirstOrDefault();

            int levelIndex = 0;
            var spaces = new List<Space>();
            var svfIds = new List<int>();
            var svf2Ids = new List<int>();

            var groupResult = queryResultRes.GroupBy(item =>
            {
                dynamic room = item as dynamic;
                return room.level;
            });

            if (buildTree)
            {
                foreach (var group in groupResult)
                {
                    var level = new Space
                    {
                        Name = group.Key,
                        Type = "Levels",
                        Order = ++levelIndex
                    };

                    int roomIndex = 0;
                    level.Children = group.Select(item =>
                    {
                        dynamic room = item as dynamic;
                        int svf2Id = room.svf2Id;
                        int svfId = room.svfId;

                        svfIds.Add(svfId);
                        svf2Ids.Add(svf2Id);

                        return new AecRoom
                        {
                            Id = room.externalId,
                            Name = Regex.Replace(room.name.ToString(), @"\[[^]]*\]", string.Empty).Trim(),
                            // category = room.category,
                            // revitCategory = room.revitCategory
                            Type = room.revitCategory,
                            ParentId = level.Id,
                            Order = ++roomIndex,
                            Svf2Id = svf2Id,
                            SvfId = svfId,
                        };
                    }).ToList<Space>();

                    spaces.Add(level);
                }
            } else {
                foreach (var group in groupResult) {
                    var level = new Space
                    {
                        Name = group.Key,
                        Type = "Levels",
                        Order = ++levelIndex
                    };

                    int roomIndex = 0;

                    var rooms = group.Select(item =>
                    {
                        dynamic room = item as dynamic;
                        int svf2Id = room.svf2Id;
                        int svfId = room.svfId;

                        svfIds.Add(svfId);
                        svf2Ids.Add(svf2Id);

                        return new AecRoom
                        {
                            Id = room.externalId,
                            Name = Regex.Replace(room.name.ToString(), @"\[[^]]*\]", string.Empty).Trim(),
                            // category = room.category,
                            // revitCategory = room.revitCategory
                            Type = room.revitCategory,
                            ParentId = level.Id,
                            Order = ++roomIndex,
                            Svf2Id = svf2Id,
                            SvfId = svfId,
                        };
                    });

                    spaces.Add(level);
                    spaces.AddRange(rooms);
                }
            }

            dynamic data = new System.Dynamic.ExpandoObject();
            data.view = view;
            data.spaces = spaces;
            data.svfIds = svfIds;
            data.svf2Ids = svf2Ids;

            return data;
        }
    }
}