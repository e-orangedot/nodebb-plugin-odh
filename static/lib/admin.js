'use strict';
/* globals $, app, socket */

define('admin/plugins/odh', ['settings'], function(Settings) {

	var ACP = {};

	ACP.init = function() {
		Settings.load('odh', $('.odh-settings'));

		$('#save').on('click', function() {
			Settings.save('odh', $('.odh-settings'), function() {
				app.alert({
					type: 'success',
					alert_id: 'odh-saved',
					title: 'Settings Saved',
					message: 'Please reload your NodeBB to apply these settings',
					clickfn: function() {
						socket.emit('admin.reload');
					}
				});
			});
		});
	};

	return ACP;
});