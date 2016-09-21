"use strict";

var async = require.main.require('async');
var db = require.main.require('./src/database');
var settings = require.main.require('./src/settings');
var meta = require.main.require('./src/meta');
var Server = require("mongo-sync").Server;
var server = new Server('127.0.0.1');
var Fiber = require('fibers');
var _ = require('lodash');

var controllers = require('./lib/controllers'),

plugin = {};

plugin.init = function(params, callback) {
	var router = params.router;
	var	hostMiddleware = params.middleware;
	var	hostControllers = params.controllers;

	router.get('/admin/plugins/odh', hostMiddleware.admin.buildHeader, controllers.renderAdminPage);
	router.get('/api/admin/plugins/odh', controllers.renderAdminPage);

	callback();
};

plugin.addAdminNavigation = function(header, callback) {
	header.plugins.push({
		route: '/plugins/odh',
		icon: 'fa-tint',
		name: 'Odh'
	});

	callback(null, header);
};

plugin.nestingLevel = function (tags, callback) {
	async.waterfall([
		function (next) {
			var regex = '/topic/' + tags.topic.tid + '/';
			db.client.collection('objects').find({
				_key: /^post:\d+$/,
				content: { $regex: regex, $options: "gi" }
			}, {tid: true, _id: false}, next);
		},
		function(docs, next) {
			docs.toArray(function(err, items) {
				var tids = items.map(function(item) {
				  return item.tid;
				});
				next(null, tids);
			});
		},
		function (tids, next) {
			meta.settings.get('odh', function(err, settings) {
				next(err, settings, tids);
			});
		},
		function(settings, tids, next) {
			var nestingLevel = settings.nestingLevel || 2;
			nestingLevel--;

			Fiber(function () {
				while (nestingLevel > 0) {
					var orCondition = [];
					_.each(tids, function(item) {
						orCondition.push({_key: new RegExp("^post:" + item + "$")});
					});

					tids = [];
					if (orCondition.length > 0) {
						var regex = new RegExp("/topic/(\\d+)/");
						var result = server.db("nodebb").getCollection('objects').find({
							$or: orCondition,
							content: { $regex: regex, $options: "gi" }
						}, {content: true, _id: false}).toArray();
					}

					if (result) {
						_.map(result, function(item) {
							var matches = item.content.match(regex);
							if (matches[1]) {
								tids.push(parseInt(matches[1]));
							}
						});
					}

					if (tids.length > 0 && nestingLevel) {
						nestingLevel--;
					} else {
						if (tids.length > 0) {
							tags.topic['allowReplyAsTopic'] = false;
						} else {
							tags.topic['allowReplyAsTopic'] = true;
						}

						nestingLevel = 0;
					}
				}

				next(null, tags);
			}).run();
		}
	], function(err, result) {
		callback(err, result)
	});
};

module.exports = plugin;
