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
using System.Linq;
using Microsoft.Extensions.Logging;
using bim360assets.Models.Iot;
using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;

namespace bim360assets.Models.Repositories
{
     public class RecordRepository : BaseRepository<Record, int>, IRecordRepository
    {
        public RecordRepository() { }

        public RecordRepository(DataBaseContext db, ILogger<RecordRepository> logger)
            : base(db, logger)
        {
        }

        public virtual int GetTimeMin(string include, Expression<Func<Record, bool>> predicate = null)
        {
            var query = _db.Set<Record>().Include(include);

            if (predicate != null)
                query = query.Where(predicate);

            var time = query.Select(r => r.CreatedAt).Min();

            return (int)time.ToUniversalTime().Subtract(new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Local)).TotalSeconds;
        }

        public virtual int GetTimeMax(string include, Expression<Func<Record, bool>> predicate = null)
        {
            var query = _db.Set<Record>().Include(include);

            if (predicate != null)
                query = query.Where(predicate);

            var time = query.Select(r => r.CreatedAt).Max();

            return (int)time.ToUniversalTime().Subtract(new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Local)).TotalSeconds;
        }

        public virtual int GetTimeMin(IEnumerable<string> includes, Expression<Func<Record, bool>> predicate = null)
        {
            var query = _db.Set<Record>().AsQueryable();
            query = includes.Aggregate(query, (current, include) => current.Include(include));

            if (predicate != null)
                query = query.Where(predicate);

            var time = query.Select(r => r.CreatedAt).Min();

            return (int)time.ToUniversalTime().Subtract(new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Local)).TotalSeconds;
        }

        public virtual int GetTimeMax(IEnumerable<string> includes, Expression<Func<Record, bool>> predicate = null)
        {
            var query = _db.Set<Record>().AsQueryable();
            query = includes.Aggregate(query, (current, include) => current.Include(include));

            if (predicate != null)
                query = query.Where(predicate);

            var time = query.Select(r => r.CreatedAt).Max();

            return (int)time.ToUniversalTime().Subtract(new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Local)).TotalSeconds;
        }

        public virtual int GetTimeMin(Expression<Func<Record, bool>> predicate = null)
        {
            var query = _db.Set<Record>().AsQueryable();

            if (predicate != null)
                query = query.Where(predicate);

            var time = query.Select(r => r.CreatedAt).Min();

            return (int)time.ToUniversalTime().Subtract(new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Local)).TotalSeconds;
        }

        public virtual int GetTimeMax(Expression<Func<Record, bool>> predicate = null)
        {
            var query = _db.Set<Record>().AsQueryable();

            if (predicate != null)
                query = query.Where(predicate);

            var time = query.Select(r => r.CreatedAt).Max();

            return (int)time.ToUniversalTime().Subtract(new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Local)).TotalSeconds;
        }
    }
}