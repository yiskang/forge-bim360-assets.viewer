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
using System.Globalization;
using System.Text;

namespace bim360assets.Libs
{
    public static class StringExtensions
    {
        /// <summary>
        /// Converts the given string value into camelCase.
        /// </summary>
        /// <param name="value">The value.</param>
        /// <param name="changeWordCaps">If set to <c>true</c> letters in a word (apart from the first) will be lowercased.</param>
        /// <param name="culture">The culture to use to change the case of the characters.</param>
        /// <returns>
        /// The camel case value.
        /// </returns>
        /// <link>https://stackoverflow.com/a/7119707</link>
        public static string ToCamelCase(this string value, bool changeWordCaps = true)
        {
            if (string.IsNullOrEmpty(value))
                return value;

            var culture = CultureInfo.CurrentCulture;
            var result = new StringBuilder(value.Length);
            var lastWasBreak = true;
            for (var i = 0; i < value.Length; i++)
            {
                var c = value[i];
                if (char.IsWhiteSpace(c) || char.IsPunctuation(c) || char.IsSeparator(c))
                {
                    lastWasBreak = true;
                }
                else if (char.IsNumber(c))
                {
                    result.Append(c);
                    lastWasBreak = true;
                }
                else
                {
                    if (result.Length == 0)
                    {
                        result.Append(char.ToLower(c, culture));
                    }
                    else if (lastWasBreak)
                    {
                        result.Append(char.ToUpper(c, culture));
                    }
                    else if (changeWordCaps)
                    {
                        result.Append(char.ToLower(c, culture));
                    }
                    else
                    {
                        result.Append(c);
                    }

                    lastWasBreak = false;
                }
            }

            return result.ToString();
        }
    }
}