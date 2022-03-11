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
    public static class BIM360SensorInfoUtil
    {
        private static string[] supportedSensorNames = new string[] { "Temperature", "Humidity" };
        private static string[] supportedSensorCustomAttributes = new string[]
        {
            "External Id",
            "Sensor.[0].Id", "Sensor.[0].Name", "Sensor.[0].DataType",
            "Sensor.[0].DataUnit", "Sensor.[0].RangeMin", "Sensor.[0].RangeMax"
        };
        public static string sensorIdCustomAttr
        {
            get
            {
                return supportedSensorCustomAttributes[1];
            }
        }

        public static string sensorNameCustomAttr
        {
            get
            {
                return supportedSensorCustomAttributes[2];
            }
        }

        public static async Task<List<Dictionary<string, object>>> GetSensorInfoSet(string accessToken, string projectId)
        {
            var assets = await GetAssetsBySensorNamesAsync(accessToken, projectId);
            var result = assets.Select(a => a.CustomAttributes).ToList();

            return result;
        }

        public static async Task<List<AssetCustomAttribute>> GetSensorAttributes(string accessToken, string projectId)
        {
            var attrDefs = await BIM360DataUtil.GetCustomAttributeDefsAsync(accessToken, projectId.Replace("b.", string.Empty), null);
            var results = attrDefs.Results.Where(attr => supportedSensorCustomAttributes.Contains(attr.DisplayName)).ToList();

            return results;
        }

        public static async Task<List<Asset>> GetAssetsBySensorNamesAsync(string accessToken, string projectId)
        {
            var sensorNameAttr = await BIM360DataUtil.GetCustomAttributeByNameAsync(accessToken, projectId, sensorNameCustomAttr);
            var paginatedAssets = supportedSensorNames
                .Select(name => BIM360DataUtil.GetAssetsByCustomAttributeAsync(accessToken, projectId, sensorNameAttr.Name, name, null, 100))
                .ToList();

            var results = await Task.WhenAll(paginatedAssets);
            var query = results.AsQueryable().Where(a => a != null);

            if (query == null || query.Count() <= 0)
                return new List<Asset>();

            return query.SelectMany(a => a.Results)
                    .ToList();
        }
    }
}