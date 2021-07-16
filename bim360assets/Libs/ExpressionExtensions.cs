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

using System.Collections.Generic;

namespace System.Linq.Expressions
{
    /// <summary>
    /// ref: https://stackoverflow.com/a/53677138
    /// </summary>
    public static class ExpressionExtensions
    {
        private class ParameterlessExpressionSearcher : ExpressionVisitor
        {
            public HashSet<Expression> ParameterlessExpressions { get; } = new HashSet<Expression>();
            private bool containsParameter = false;

            public override Expression Visit(Expression node)
            {
                bool originalContainsParameter = containsParameter;
                containsParameter = false;
                base.Visit(node);
                if (!containsParameter)
                {
                    if (node?.NodeType == ExpressionType.Parameter)
                        containsParameter = true;
                    else
                        ParameterlessExpressions.Add(node);
                }
                containsParameter |= originalContainsParameter;

                return node;
            }
        }

        private class ParameterlessExpressionEvaluator : ExpressionVisitor
        {
            private HashSet<Expression> parameterlessExpressions;
            public ParameterlessExpressionEvaluator(HashSet<Expression> parameterlessExpressions)
            {
                this.parameterlessExpressions = parameterlessExpressions;
            }
            public override Expression Visit(Expression node)
            {
                if (parameterlessExpressions.Contains(node))
                    return Evaluate(node);
                else
                    return base.Visit(node);
            }

            private Expression Evaluate(Expression node)
            {
                if (node.NodeType == ExpressionType.Constant)
                {
                    return node;
                }
                object value = Expression.Lambda(node).Compile().DynamicInvoke();
                return Expression.Constant(value, node.Type);
            }
        }

        public static Expression Simplify(this Expression expression)
        {
            var searcher = new ParameterlessExpressionSearcher();
            searcher.Visit(expression);
            return new ParameterlessExpressionEvaluator(searcher.ParameterlessExpressions).Visit(expression);
        }

        public static Expression<T> Simplify<T>(this Expression<T> expression)
        {
            return (Expression<T>)Simplify((Expression)expression);
        }
    }
}