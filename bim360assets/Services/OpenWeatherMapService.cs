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
using Newtonsoft.Json;
using Microsoft.Extensions.Options;
using RestSharp;
using Newtonsoft.Json.Linq;

namespace bim360assets.Services
{
    public class OpenWeatherMapOptions
    {
        public string ApiKey;
        public string Latitude;
        public string Longitude;
        public string Units;
    }

    public class WeatherData
    {
        [JsonProperty("dt")]
        public int Timestamp;
        [JsonProperty("temp")]
        public double Temperature;
        [JsonProperty("humidity")]
        public double Humidity;
    }

    public interface IOpenWeatherMapService
    {
        Task<List<WeatherData>> GetWeatherDataForPastDays(int days = 5);
    }

    public class OpenWeatherMapService : IOpenWeatherMapService
    {
        private const string BASE_URL = "https://api.openweathermap.org";
        private readonly OpenWeatherMapOptions options;

        public OpenWeatherMapService(OpenWeatherMapOptions options)
        {
            this.options = options;
        }

        private async Task<JObject> GetWeatherDataForPastTime(int timestamp)
        {
            try
            {
                RestClient client = new RestClient(BASE_URL);
                RestRequest request = new RestRequest("/data/2.5/onecall/timemachine", RestSharp.Method.GET);
                request.AddParameter("appid", this.options.ApiKey, ParameterType.QueryString);
                request.AddParameter("lat", this.options.Latitude, ParameterType.QueryString);
                request.AddParameter("lon", this.options.Longitude, ParameterType.QueryString);
                request.AddParameter("dt", timestamp, ParameterType.QueryString);
                request.AddParameter("units", this.options.Units, ParameterType.QueryString);

                var res = await client.ExecuteTaskAsync(request);
                return JsonConvert.DeserializeObject<JObject>(res.Content);
            }
            catch (Exception ex) { }

            return null;
        }

        public async Task<List<WeatherData>> GetWeatherDataForPastDays(int days = 5)
        {
            if (days > 5)
                throw new InvalidOperationException("Input days cannot be greater than 5 due to OpenWeatherMap Free API limit");

            int count = 0;
            var date = DateTime.Now.Date;

            var weatherData = new List<WeatherData>();

            while (count < days)
            {
                var utcDate = date.ToUniversalTime();
                var timestamp = (int)utcDate.Subtract(new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Local)).TotalSeconds;
                dynamic result = await this.GetWeatherDataForPastTime(timestamp);

                foreach (JObject rawData in result.hourly)
                {
                    var data = rawData.ToObject<WeatherData>();
                    weatherData.Add(data);
                }

                date = date.AddDays(-1).Date;

                count++;
            }

            return weatherData.OrderBy(d => d.Timestamp).ToList();
        }
    }
}