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

var viewer = null;

function launchViewer(models) {
  if (viewer != null) {
    viewer.tearDown()
    viewer.finish()
    viewer = null
    $("#forgeViewer").empty();
  }

  if (!models || models.length <= 0)
    return alert('Empty `models` input');

  var options = {
    env: 'AutodeskProduction',
    api: 'derivativeV2',
    getAccessToken: getForgeToken
  };

  Autodesk.Viewing.Initializer(options, () => {
    const config3d = {
      extensions: ['BIM360IotConnectedExtension', 'BIM360AssetExtension'],
      //enableLocationsAPI: true !<<< Uncomment to use BIM360 Locations API
      // getAssetModels: (viewer) => { //!<<< Uncomment to specify the models where your assets are located.
      //   const models = viewer.impl.modelQueue().getModels().concat();
      //   return models.splice(1, 1); //!<<< e.g. The assets models are within the 2nd model
      // }
    };
    viewer = new Autodesk.Viewing.GuiViewer3D(document.getElementById('forgeViewer'), config3d);

    //load model one by one in sequence
    const util = new MultipleModelUtil(viewer);
    util.processModels(models);
  });
}

function getForgeToken(callback) {
  jQuery.ajax({
    url: '/api/forge/oauth/token',
    success: function (res) {
      callback(res.access_token, res.expires_in)
    }
  });
}
