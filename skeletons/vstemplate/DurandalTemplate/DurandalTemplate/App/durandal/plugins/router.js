﻿define(function (require) {
    var system = require('durandal/system');
    var routesByPath = {},
        allRoutes = ko.observableArray([]),
        visibleRoutes = ko.observableArray([]),
        sammy,
        router,
        previousRoute,
        cancelling = false,
        navigationActivator,
        navigationDefaultRoute;
    
    //NOTE: Sammy.js is not required by the core of Durandal. 
    //However, this plugin leverages it to enable navigation.
    
    function trySwap(item, title, activationData) {
        navigationActivator.activateItem(item, activationData).then(function (succeeded) {
            if (succeeded) {
                document.title = title;
                previousRoute = sammy.last_location[1].replace('/', '');
            } else {
                cancelling = true;
                system.log('Cancelling Navigation');
                sammy.setLocation(previousRoute);
                cancelling = false;
            }
        });
    }

    function activateRoute(route, params) {
        var routeInfo = routesByPath[route];

        if (!routeInfo) {
            if (!router.convertRouteToModuleId) {
                system.log('No Route Found', route, params);
                return;
            }

            routeInfo = {
                moduleId: router.convertRouteToModuleId(route),
                name: router.convertRouteToName(route)
            };
        }

        system.log('Activating Route', routeInfo, params);
        system.acquire(routeInfo.moduleId).then(function(module) {
            if (typeof module == 'function') {
                trySwap(new module(), routeInfo.name, params);
            } else {
                trySwap(module, routeInfo.name, params);
            }
        });
    }
    
    function handleRoute() {
        if (cancelling) {
            return;
        }

        var route = this.app.last_route.path.toString();
        var params = this.params;

        if (route == '/$/') {
            if (router.convertRouteToModuleId) {
                var fragment = this.path.split('#/');
                if (fragment.length == 2) {
                    var parts = fragment[1].split('/');
                    route = parts[0];
                    params = parts.splice(1);
                } else {
                    route = navigationDefaultRoute;
                }
            } else {
                route = navigationDefaultRoute;
            }
        }

        activateRoute(route, params);
    }

    return router = {
        ready: ko.observable(false),
        allRoutes:allRoutes,
        visibleRoutes: visibleRoutes,
        navigateBack:function () {
            window.history.back();
        },
        navigateTo:function (url) {
            sammy.setLocation(url);
        },
        convertRouteToName: function (route) {
            return route.substring(0, 1).toUpperCase() + route.substring(1);
        },
        mapAuto: function (path) {
            path = path || 'viewmodels';

            this.convertRouteToModuleId = function(url) {
                return path + '/' + url;
            };
        },
        mapNav: function (url, moduleId, name) {
            return this.mapRoute(url, moduleId, name, true);
        },
        mapRoute: function (url, moduleId, name, visible) {
            var routeInfo = {
                url: url,
                moduleId: moduleId,
                name: name,
                visible: visible
            };

            this.map(routeInfo);
            
            return routeInfo;
        },
        map: function (routeOrRouteArray) {
            if (!system.isArray(routeOrRouteArray)) {
                routeOrRouteArray = [routeOrRouteArray];
            }

            for (var i = 0; i < routeOrRouteArray.length; i++) {
                var routeInfo = routeOrRouteArray[i];

                routeInfo.name = routeInfo.name || this.convertRouteToName(routeInfo.url);
                routeInfo.hash = routeInfo.hash || '#/' + routeInfo.url;

                routesByPath[routeInfo.url] = routeInfo;
                allRoutes.push(routeInfo);

                if (routeInfo.visible) {
                    routeInfo.isActive = ko.computed(function() {
                        return router.ready()
                            && navigationActivator()
                            && navigationActivator().__moduleId__ == routeInfo.moduleId;
                    });

                    visibleRoutes.push(routeInfo);
                }
            }
        },
        enable: function (activator, defaultRoute) {
            navigationActivator = activator;
            navigationDefaultRoute = defaultRoute;

            sammy = Sammy(function (route) {
                var unwrapped = allRoutes();
                for (var i = 0; i < unwrapped.length; i++) {
                    var current = unwrapped[i];

                    if (!(current.url instanceof RegExp)) {
                        route.get(current.url, handleRoute);
                    } else {
                        route.get(current.url, handleRoute);
                    }

                    var processedRoute = this.routes.get[i];
                    routesByPath[processedRoute.path.toString()] = current;
                }

                route.get('', handleRoute);
            });

            sammy._checkFormSubmission = function () {
                return false;
            };

            sammy.log = function () {
                var args = Array.prototype.slice.call(arguments, 0);
                args.unshift('Sammy');
                system.log.apply(system, args);
            };

            this.ready(true);

            sammy.run();
        }
    };
});