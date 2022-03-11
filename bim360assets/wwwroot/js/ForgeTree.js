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

$(document).ready(function () {
  // first, check if current visitor is signed in
  jQuery.ajax({
    url: '/api/forge/oauth/token',
    success: function (res) {
      // yes, it is signed in...
      $('#signOut').show();
      $('#refreshHubs').show();

      // prepare sign out
      $('#signOut').click(function () {
        $('#hiddenFrame').on('load', function (event) {
          location.href = '/api/forge/oauth/signout';
        });
        $('#hiddenFrame').attr('src', 'https://accounts.autodesk.com/Authentication/LogOut');
        // learn more about this signout iframe at
        // https://forge.autodesk.com/blog/log-out-forge
      })

      // and refresh button
      $('#refreshHubs').click(function () {
        $('#userHubs').jstree(true).refresh();
      });

      // finally:
      prepareUserHubsTree();
      showUser();
    }
  });

  $('#autodeskSigninButton').click(function () {
    jQuery.ajax({
      url: '/api/forge/oauth/url',
      success: function (url) {
        location.href = url;
      }
    });
  })
  $('#mockIotSensorRecordsButton').click(function () {
    $('#mockIotSensorRecordsProgressBar .progress-bar').css('width', '0%').attr('aria-valuenow', 0);
    $('#mockIotSensorRecordsProgressBar p').text('Mocking sensor records from weather data ...');

    $('#mockIotSensorRecordsButton').addClass('hidden');
    $('#mockIotSensorRecordsButton').removeClass('show');

    $('#mockIotSensorRecordsProgressBar').removeClass('hidden');
    $('#mockIotSensorRecordsProgressBar').addClass('show');

    let autodeskNode = $('#userHubs').jstree(true).get_selected(true)[0];
    let idParams = autodeskNode.id.split('/');
    let hubId = idParams[idParams.length - 3].replace('b.', '');
    let projectId = idParams[idParams.length - 1].replace('b.', '');

    jQuery.ajax({
      url: `/api/iot/projects/${projectId}/records:batch-mock`,
      type: 'post',
      headers: {
        'Content-Type': 'application/json',
        'x-ads-force': true
      },
      success: function (data) {
        console.log(`Completed! Successfully mocked sensor data for Project \`${projectId}\`.`, data);

        $('#mockIotSensorRecordsProgressBar .progress-bar').css('width', '100%').attr('aria-valuenow', 100);
        $('#mockIotSensorRecordsProgressBar p').text(`Successfully mocked sensor data for Project \`${projectId}\`.`);

        setTimeout(
          () => $('#mockIotSensorRecordsModal').modal('hide'),
          3000
        );
      }
    });
  });

  $('#initializeIotProjectButton').click(function () {
    $('#initializeIotProjectProgressBar .progress-bar').css('width', '0%').attr('aria-valuenow', 0);
    $('#initializeIotProjectProgressBar p').text('0/2 Initializing ...');

    $('#initializeIotProjectButton').addClass('hidden');
    $('#initializeIotProjectButton').removeClass('show');

    $('#initializeIotProjectProgressBar').removeClass('hidden');
    $('#initializeIotProjectProgressBar').addClass('show');

    let autodeskNode = $('#userHubs').jstree(true).get_selected(true)[0];
    let idParams = autodeskNode.id.split('/');
    let hubId = idParams[idParams.length - 3].replace('b.', '');
    let projectId = idParams[idParams.length - 1].replace('b.', '');

    jQuery.post({
      url: '/api/iot/projects',
      contentType: 'application/json',
      data: JSON.stringify({
        name: autodeskNode.text,
        externalId: projectId
      }),
      success: function (data) {
        console.log(`Iot Project \`${projectId}\` created.`, data);

        $('#initializeIotProjectProgressBar .progress-bar').css('width', '50%').attr('aria-valuenow', 50);
        $('#initializeIotProjectProgressBar p').text('1/2 Fetching sensor info data from BIM360 Assets ...');

        jQuery.post({
          url: `/api/iot/projects/${projectId}/sensors:init`,
          contentType: 'application/json',
          success: function (data) {
            console.log(`Completed! Successfully saved Iot sensor info data of Project \`${projectId}\` into database.`, data);

            $('#initializeIotProjectProgressBar .progress-bar').css('width', '100%').attr('aria-valuenow', 100);
            $('#initializeIotProjectProgressBar p').text('2/2 Saved sensor info data into database ...');

            setTimeout(
              () => $('#initializeIotProjectModal').modal('hide'),
              3000
            );
          }
        });
      }
    });
  });

  $.getJSON("/api/forge/clientid", function (res) {
    $("#ClientID").val(res.id);
    $("#provisionAccountSave").click(function () {
      $('#provisionAccountModal').modal('toggle');
      $('#userHubs').jstree(true).refresh();
    });
  });
});

function prepareUserHubsTree() {
  var haveBIM360Hub = false;
  $('#userHubs').jstree({
    'core': {
      'themes': { "icons": true },
      'multiple': false,
      'data': {
        "url": '/api/forge/datamanagement',
        "dataType": "json",
        'cache': false,
        'data': function (node) {
          $('#userHubs').jstree(true).toggle_node(node);
          return { "id": node.id };
        },
        "success": function (nodes) {
          nodes.forEach(function (n) {
            if (n.type === 'bim360Hubs' && n.id.indexOf('b.') > 0)
              haveBIM360Hub = true;
          });

          if (!haveBIM360Hub) {
            $("#provisionAccountModal").modal();
            haveBIM360Hub = true;
          }
        }
      }
    },
    'types': {
      'default': {
        'icon': 'glyphicon glyphicon-question-sign'
      },
      '#': {
        'icon': 'glyphicon glyphicon-user'
      },
      'hubs': {
        'icon': 'https://github.com/Autodesk-Forge/learn.forge.viewhubmodels/raw/master/img/a360hub.png'
      },
      'personalHub': {
        'icon': 'https://github.com/Autodesk-Forge/learn.forge.viewhubmodels/raw/master/img/a360hub.png'
      },
      'bim360Hubs': {
        'icon': 'https://github.com/Autodesk-Forge/learn.forge.viewhubmodels/raw/master/img/bim360hub.png'
      },
      'bim360projects': {
        'icon': 'https://github.com/Autodesk-Forge/learn.forge.viewhubmodels/raw/master/img/bim360project.png'
      },
      'a360projects': {
        'icon': 'https://github.com/Autodesk-Forge/learn.forge.viewhubmodels/raw/master/img/a360project.png'
      },
      'items': {
        'icon': 'glyphicon glyphicon-file'
      },
      'bim360documents': {
        'icon': 'glyphicon glyphicon-file'
      },
      'folders': {
        'icon': 'glyphicon glyphicon-folder-open'
      },
      'versions': {
        'icon': 'glyphicon glyphicon-time'
      },
      'unsupported': {
        'icon': 'glyphicon glyphicon-ban-circle'
      }
    },
    "sort": function (a, b) {
      var a1 = this.get_node(a);
      var b1 = this.get_node(b);
      var parent = this.get_node(a1.parent);
      if (parent.type === 'items') {
        var id1 = Number.parseInt(a1.text.substring(a1.text.indexOf('v') + 1, a1.text.indexOf(':')))
        var id2 = Number.parseInt(b1.text.substring(b1.text.indexOf('v') + 1, b1.text.indexOf(':')));
        return id1 > id2 ? 1 : -1;
      }
      else if (parent.type === 'bim360Hubs') {
        return (a1.text > b1.text) ? 1 : -1;
      }
      else return a1.type < b1.type ? -1 : (a1.text > b1.text) ? 1 : 0;
    },
    "plugins": ["types", "state", "sort", "contextmenu"],
    contextmenu: { items: autodeskCustomMenu },
    "state": { "key": "autodeskHubs" }// key restore tree state
  }).bind("activate_node.jstree", function (evt, data) {
    if (data != null && data.node != null && (data.node.type == 'versions' || data.node.type == 'bim360documents')) {
      var urn;
      var viewableId
      if (data.node.id.indexOf('|') > -1) {
        urn = data.node.id.split('|')[1];
        viewableId = data.node.id.split('|')[2];
        launchViewer(urn, viewableId);
      }
      else {
        launchViewer(data.node.id);
      }
    }
  });
}

async function autodeskCustomMenu(autodeskNode, buildContextMenu) {
  var items;

  switch (autodeskNode.type) {
    case "bim360projects":
      let idParams = autodeskNode.id.split('/');
      let hubId = idParams[idParams.length - 3].replace('b.', '');
      let projectId = idParams[idParams.length - 1].replace('b.', '');

      let isExisted = await isIotConnectedProjectExisted(projectId);

      if (isExisted) {
        items = {
          mockIotSensors: {
            label: 'Mock Iot Sensors',
            action: function () {
              $('#mockIotSensorRecordsModal').modal('show');
            },
            icon: 'glyphicon glyphicon-dashboard'
          }
        };
      } else {
        items = {
          initIotProject: {
            label: 'Initialize Iot Project',
            action: function () {
              // $('#initializeIotProjectButton').addClass('hidden');
              // $('#initializeIotProjectButton').removeClass('show');

              // $('#initializeIotProjectProgressBar').removeClass('hidden');
              // $('#initializeIotProjectProgressBar').addClass('show');

              $('#initializeIotProjectModal').modal('show');
            },
            icon: 'https://github.com/Autodesk-Forge/learn.forge.viewhubmodels/raw/master/img/bim360project.png'
          }
        };
      }
      break;
  }

  buildContextMenu(items);
}

async function isIotConnectedProjectExisted(projectId) {
  function getIotProject(projectId) {
    return jQuery.ajax({
      url: '/api/iot/projects/' + projectId
    });
  }

  try {
    await getIotProject(projectId);
    return true;
  } catch {
    console.warn(`Iot Project \`${projectId}\` not found`);
    return false;
  }
}

function showUser() {
  jQuery.ajax({
    url: '/api/forge/user/profile',
    success: function (profile) {
      var img = '<img src="' + profile.picture + '" height="30px">';
      $('#userInfo').html(img + profile.name);
    }
  });
}