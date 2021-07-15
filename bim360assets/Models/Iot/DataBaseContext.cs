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
using Microsoft.EntityFrameworkCore;

namespace bim360assets.Models.Iot
{
    public partial class DataBaseContext : DbContext
    {
         public DataBaseContext(DbContextOptions<DataBaseContext> options)
            : base(options) { }

        public virtual DbSet<Project> Projects { get; set; }
        public virtual DbSet<Sensor> Sensors { get; set; }
        public virtual DbSet<Record> Records { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Project>(entity =>
            {
                entity.HasIndex(e => e.ExternalId)
                    .IsUnique();
            });

            modelBuilder.Entity<Sensor>(entity =>
            {
                entity.HasIndex(e => e.ExternalId)
                    .IsUnique();

                entity.HasOne(e => e.Project)
                    .WithMany(p => p.Sensors)
                    .HasForeignKey(e => e.ProjectId)
                    .OnDelete(DeleteBehavior.Cascade)
                    .HasConstraintName("FK_Sensors_Projects");
            });

            modelBuilder.Entity<Record>(entity =>
            {
                entity.Property(e => e.CreatedAt)
                    .HasConversion(v => v, v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

                entity.HasOne(e => e.Sensor)
                    .WithMany(s => s.Records)
                    .HasForeignKey(e => e.SensorId)
                    .OnDelete(DeleteBehavior.Cascade)
                    .HasConstraintName("FK_Records_Sensors");
            });
        }
    }
}