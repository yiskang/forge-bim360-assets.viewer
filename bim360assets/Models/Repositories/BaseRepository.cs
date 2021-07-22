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

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;

namespace bim360assets.Models.Repositories
{
    /// <summary>
    /// ref: https://github.com/JacekKosciesza/StarWars/tree/master/StarWars.Data/EntityFramework/Repositories
    /// </summary>
    public abstract class BaseRepository<TEntity, TKey> : IBaseRepository<TEntity, TKey>
        where TEntity : class, IEntity<TKey>, new()
    {
        protected DbContext _db;
        protected readonly ILogger _logger;

        protected BaseRepository() { }

        protected BaseRepository(DbContext db, ILogger logger)
        {
            _db = db;
            _logger = logger;
        }

        public virtual Task<List<TEntity>> GetAll(Expression<Func<TEntity, bool>> predicate = null)
        {
            if (predicate == null)
                _logger.LogInformation("Get all {type}s", typeof(TEntity).Name);
            else
                _logger.LogInformation("Get all {type}s  with predicate [{predicate}]", typeof(TEntity).Name, predicate.Simplify());

            var query = _db.Set<TEntity>().AsQueryable();

            if (predicate != null)
                query = query.Where(predicate);

            return query.ToListAsync();
        }

        public Task<List<TEntity>> GetAll(string include, Expression<Func<TEntity, bool>> predicate = null)
        {
            if (predicate == null)
                _logger.LogInformation("Get all {type}s (including {include})", typeof(TEntity).Name, include);
            else
                _logger.LogInformation("Get all {type}s (including {include}) with predicate [{predicate}]", typeof(TEntity).Name, include, predicate.Simplify());

            var query = _db.Set<TEntity>().Include(include);

            if (predicate != null)
                query = query.Where(predicate);

            return query.ToListAsync();
        }

        public Task<List<TEntity>> GetAll(IEnumerable<string> includes, Expression<Func<TEntity, bool>> predicate = null)
        {
            if (predicate == null)
                _logger.LogInformation("Get all {type}s (including [{includes}])", typeof(TEntity).Name, string.Join(",", includes));
            else
                _logger.LogInformation("Get all {type}s (including [{includes}]) with predicate [{predicate}]", typeof(TEntity).Name, string.Join(",", includes), predicate.Simplify());

            var query = _db.Set<TEntity>().AsQueryable();
            query = includes.Aggregate(query, (current, include) => current.Include(include));

            if (predicate != null)
                query = query.Where(predicate);

            return query.ToListAsync();
        }

        public virtual Task<TEntity> Get(Expression<Func<TEntity, bool>> predicate)
        {
            _logger.LogInformation("Get {type} with predicate [{predicate}]", typeof(TEntity).Name, predicate.Simplify());
            return _db.Set<TEntity>().SingleOrDefaultAsync(predicate);
        }

        public virtual Task<TEntity> Get(string include, Expression<Func<TEntity, bool>> predicate)
        {
            _logger.LogInformation("Get {type} (including {include}) with predicate [{predicate}]", typeof(TEntity).Name, include, predicate.Simplify());
            return _db.Set<TEntity>().Include(include).SingleOrDefaultAsync(predicate);
        }

        public virtual Task<TEntity> Get(IEnumerable<string> includes, Expression<Func<TEntity, bool>> predicate)
        {
            _logger.LogInformation("Get {type} (including [{includes}]) with predicate [{predicate}]", typeof(TEntity).Name, string.Join(",", includes), predicate.Simplify());
            var query = _db.Set<TEntity>().AsQueryable();
            query = includes.Aggregate(query, (current, include) => current.Include(include));
            return query.SingleOrDefaultAsync(predicate);
        }

        public virtual Task<TEntity> Get(TKey id)
        {
            _logger.LogInformation("Get {type} with id = {id}", typeof(TEntity).Name, id);
            return _db.Set<TEntity>().SingleOrDefaultAsync(c => c.Id.Equals(id));
        }

        public Task<TEntity> Get(TKey id, string include)
        {
            _logger.LogInformation("Get {type} with id = {id} (including {include})", typeof(TEntity).Name, id, include);
            return _db.Set<TEntity>().Include(include).SingleOrDefaultAsync(c => c.Id.Equals(id));
        }

        public Task<TEntity> Get(TKey id, IEnumerable<string> includes)
        {
            _logger.LogInformation("Get {type} with id = {id} (including [{includes}])", typeof(TEntity).Name, id, string.Join(",", includes));
            var query = _db.Set<TEntity>().AsQueryable();
            query = includes.Aggregate(query, (current, include) => current.Include(include));
            return query.SingleOrDefaultAsync(c => c.Id.Equals(id));
        }

        public virtual TEntity Add(TEntity entity)
        {
            _db.Set<TEntity>().Add(entity);
            return entity;
        }

        public void AddRange(IEnumerable<TEntity> entities)
        {
            _db.Set<TEntity>().AddRange(entities);
        }

        public virtual void Delete(TKey id)
        {
            var entity = new TEntity { Id = id };
            _db.Set<TEntity>().Attach(entity);
            _db.Set<TEntity>().Remove(entity);
        }
        public virtual async Task<bool> Delete(Expression<Func<TEntity, bool>> predicate)
        {
            var dbSet = _db.Set<TEntity>();
            var query = dbSet.Where(predicate);
            dbSet.RemoveRange(query);

            return await Task.FromResult(true);
        }

        public virtual async Task<bool> SaveChangesAsync()
        {
            return (await _db.SaveChangesAsync()) > 0;
        }

        public virtual void Update(TEntity entity)
        {
            _db.Set<TEntity>().Attach(entity);
            _db.Entry(entity).State = EntityState.Modified;
        }

        public virtual async Task<bool> Clear()
        {
            var dbSet = _db.Set<TEntity>();
            dbSet.RemoveRange(dbSet);

            return await Task.FromResult(true);
        }

        public virtual async Task<bool> Exists(Expression<Func<TEntity, bool>> predicate)
        {
            return await _db.Set<TEntity>().AnyAsync(predicate);
        }
    }
}