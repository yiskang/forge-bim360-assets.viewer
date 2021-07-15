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
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Newtonsoft.Json;


namespace bim360assets.Models.Iot
{
    public class Record
    {
        /// <summary>
        /// Record Id (Primary key).
        /// </summary>
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
         public int Id { get; set; }

         /// <summary>
         /// Sensor Value.
         /// </summary>
         public double Value { get; set; }
         
         /// <summary>
         /// Data create time.
         /// </summary>
         public DateTime CreatedAt { get; set; }

        /// <summary>
        /// Id of the sensor where this sensor belongs to.
        /// </summary>
         public int SensorId { get; set; }

        [JsonIgnore]
         public virtual Sensor Sensor { get; set; }
    }
}