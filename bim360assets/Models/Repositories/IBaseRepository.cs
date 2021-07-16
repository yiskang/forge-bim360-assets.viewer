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
using System.Collections.Generic;
using System.Linq.Expressions;
using System.Threading.Tasks;

namespace bim360assets.Models.Repositories
{
    /// <summary>
    /// ref: https://github.com/JacekKosciesza/StarWars/tree/master/StarWars.Data/EntityFramework/Repositories
    /// </summary>
    public interface IBaseRepository<TEntity, in TKey>
        where TEntity : class
    {
        Task<List<TEntity>> GetAll(Expression<Func<TEntity, bool>> predicate = null);
        Task<List<TEntity>> GetAll(string include, Expression<Func<TEntity, bool>> predicate = null);
        Task<List<TEntity>> GetAll(IEnumerable<string> includes, Expression<Func<TEntity, bool>> predicate = null);

        Task<TEntity> Get(Expression<Func<TEntity, bool>> predicate);
        Task<TEntity> Get(string include, Expression<Func<TEntity, bool>> predicate);
        Task<TEntity> Get(IEnumerable<string> includes, Expression<Func<TEntity, bool>> predicate);
        Task<TEntity> Get(TKey id);
        Task<TEntity> Get(TKey id, string include);
        Task<TEntity> Get(TKey id, IEnumerable<string> includes);

        TEntity Add(TEntity entity);
        void AddRange(IEnumerable<TEntity> entities);
        void Delete(TKey id);
        void Update(TEntity entity);
        Task<bool> SaveChangesAsync();
    }
}