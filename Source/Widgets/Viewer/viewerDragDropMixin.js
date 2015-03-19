/*global define*/
define([
        '../../Core/defaultValue',
		'../../Core/Color',
        '../../Core/defined',
        '../../Core/defineProperties',
        '../../Core/DeveloperError',
        '../../Core/Event',
        '../../Core/wrapFunction',
        '../../DataSources/CzmlDataSource',
        '../../DataSources/GeoJsonDataSource',
        '../../DataSources/KmlDataSource',
		'../../DataSources/KmlDataSource2',
        '../getElement',
		'../../../spin',
		'../../Scene/PerformanceDisplay',
		'../../../jssaxparser/DefaultHandlers',
		'../../../jssaxparser/sax'
    ], function(
        defaultValue,
		Color,
        defined,
        defineProperties,
        DeveloperError,
        Event,
        wrapFunction,
        CzmlDataSource,
        GeoJsonDataSource,
        KmlDataSource,
		KmlDataSource2,
        getElement,
		Spinner
		,PerformanceDisplay,
		DefaultHandlers,
		sax) {
    "use strict";

	var opts = {
		lines: 10, // The number of lines to draw
		length: 7, // The length of each line
		width: 4, // The line thickness
		radius: 10, // The radius of the inner circle
		corners: 1, // Corner roundness (0..1)
		rotate: 0, // The rotation offset
		color: '#FFFFE0', // #rgb or #rrggbb
		speed: 1, // Rounds per second
		trail: 60, // Afterglow percentage
		shadow: false, // Whether to render a shadow
		hwaccel: true, // Whether to use hardware acceleration
		className: 'spinner', // The CSS class to assign to the spinner
		zIndex: 2e9, // The z-index (defaults to 2000000000)
		top: '50%', // Top position relative to parent in px
		left: '50%' // Left position relative to parent in px
	};
	var interval;
	var spinner;
	var performanceContainer;
    /**
     * A mixin which adds default drag and drop support for CZML files to the Viewer widget.
     * Rather than being called directly, this function is normally passed as
     * a parameter to {@link Viewer#extend}, as shown in the example below.
     * @exports viewerDragDropMixin
     *
     * @param {Viewer} viewer The viewer instance.
     * @param {Object} [options] Object with the following properties:
     * @param {Element|String} [options.dropTarget=viewer.container] The DOM element which will serve as the drop target.
     * @param {Boolean} [options.clearOnDrop=true] When true, dropping files will clear all existing data sources first, when false, new data sources will be loaded after the existing ones.
     * @param {DefaultProxy} [options.proxy] The proxy to be used for KML network links.
     *
     * @exception {DeveloperError} Element with id <options.dropTarget> does not exist in the document.
     * @exception {DeveloperError} dropTarget is already defined by another mixin.
     * @exception {DeveloperError} dropEnabled is already defined by another mixin.
     * @exception {DeveloperError} dropError is already defined by another mixin.
     * @exception {DeveloperError} clearOnDrop is already defined by another mixin.
     *
     * @example
     * // Add basic drag and drop support and pop up an alert window on error.
     * var viewer = new Cesium.Viewer('cesiumContainer');
     * viewer.extend(Cesium.viewerDragDropMixin);
     * viewer.dropError.addEventListener(function(viewerArg, source, error) {
     *     window.alert('Error processing ' + source + ':' + error);
     * });
     */
    var viewerDragDropMixin = function(viewer, options) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(viewer)) {
            throw new DeveloperError('viewer is required.');
        }
        if (viewer.hasOwnProperty('dropTarget')) {
            throw new DeveloperError('dropTarget is already defined by another mixin.');
        }
        if (viewer.hasOwnProperty('dropEnabled')) {
            throw new DeveloperError('dropEnabled is already defined by another mixin.');
        }
        if (viewer.hasOwnProperty('dropError')) {
            throw new DeveloperError('dropError is already defined by another mixin.');
        }
        if (viewer.hasOwnProperty('clearOnDrop')) {
            throw new DeveloperError('clearOnDrop is already defined by another mixin.');
        }
        //>>includeEnd('debug');

        options = defaultValue(options, defaultValue.EMPTY_OBJECT);

        //Local variables to be closed over by defineProperties.
        var dropEnabled = true;
        var dropError = new Event();
        var clearOnDrop = defaultValue(options.clearOnDrop, true);
        var dropTarget = defaultValue(options.dropTarget, viewer.container);
        var proxy = options.proxy;

        dropTarget = getElement(dropTarget);

        defineProperties(viewer, {
            /**
             * Gets or sets the element to serve as the drop target.
             * @memberof viewerDragDropMixin.prototype
             * @type {Element}
             */
            dropTarget : {
                //TODO See https://github.com/AnalyticalGraphicsInc/cesium/issues/832
                get : function() {
                    return dropTarget;
                },
                set : function(value) {
                    //>>includeStart('debug', pragmas.debug);
                    if (!defined(value)) {
                        throw new DeveloperError('value is required.');
                    }
                    //>>includeEnd('debug');

                    unsubscribe(dropTarget, handleDrop);
                    dropTarget = value;
                    subscribe(dropTarget, handleDrop);
                }
            },

            /**
             * Gets or sets a value indicating if drag and drop support is enabled.
             * @memberof viewerDragDropMixin.prototype
             * @type {Element}
             */
            dropEnabled : {
                get : function() {
                    return dropEnabled;
                },
                set : function(value) {
                    if (value !== dropEnabled) {
                        if (value) {
                            subscribe(dropTarget, handleDrop);
                        } else {
                            unsubscribe(dropTarget, handleDrop);
                        }
                        dropEnabled = value;
                    }
                }
            },

            /**
             * Gets the event that will be raised when an error is encountered during drop processing.
             * @memberof viewerDragDropMixin.prototype
             * @type {Event}
             */
            dropError : {
                get : function() {
                    return dropError;
                }
            },

            /**
             * Gets or sets a value indicating if existing data sources should be cleared before adding the newly dropped sources.
             * @memberof viewerDragDropMixin.prototype
             * @type {Boolean}
             */
            clearOnDrop : {
                get : function() {
                    return clearOnDrop;
                },
                set : function(value) {
                    clearOnDrop = value;
                }
            },

            /**
             * Gets or sets the proxy to be used for KML.
             * @memberof viewerDragDropMixin.prototype
             * @type {DefaultProxy}
             */
            proxy : {
                get : function() {
                    return proxy;
                },
                set : function(value) {
                    proxy = value;
                }
            }
        });

        function handleDrop(event) {
            stop(event);

            if (clearOnDrop) {
                viewer.entities.removeAll();
                viewer.dataSources.removeAll();
            }

            var files = event.dataTransfer.files;
            var length = files.length;
            for (var i = 0; i < length; i++) {
                var file = files[i];
                var reader = new FileReader();
                reader.onload = createOnLoadCallback(viewer, file, proxy);
                reader.onerror = createDropErrorCallback(viewer, file);
                reader.readAsText(file);
            }
        }

        //Enable drop by default;
        subscribe(dropTarget, handleDrop);

        //Wrap the destroy function to make sure all events are unsubscribed from
        viewer.destroy = wrapFunction(viewer, viewer.destroy, function() {
            viewer.dropEnabled = false;
        });

        //Specs need access to handleDrop
        viewer._handleDrop = handleDrop;
    };

    function stop(event) {
        event.stopPropagation();
        event.preventDefault();
    }

    function unsubscribe(dropTarget, handleDrop) {
        var currentTarget = dropTarget;
        if (defined(currentTarget)) {
            currentTarget.removeEventListener('drop', handleDrop, false);
            currentTarget.removeEventListener('dragenter', stop, false);
            currentTarget.removeEventListener('dragover', stop, false);
            currentTarget.removeEventListener('dragexit', stop, false);
        }
    }

    function subscribe(dropTarget, handleDrop) {
        dropTarget.addEventListener('drop', handleDrop, false);
        dropTarget.addEventListener('dragenter', stop, false);
        dropTarget.addEventListener('dragover', stop, false);
        dropTarget.addEventListener('dragexit', stop, false);
    }

    function createOnLoadCallback(viewer, file, proxy) {
        return function(evt) {
            var fileName = file.name;
            try {
                var loadPromise;
				var dataSource;

                if (/\.czml$/i.test(fileName)) {
                    loadPromise = CzmlDataSource.load(JSON.parse(evt.target.result), {
                        sourceUri : fileName
                    });
                } else if (/\.geojson$/i.test(fileName) || /\.json$/i.test(fileName) || /\.topojson$/i.test(fileName)) {
                    loadPromise = GeoJsonDataSource.load(JSON.parse(evt.target.result), {
                        sourceUri : fileName
                    });
                } else if (/\.(kml|kmz)$/i.test(fileName)) {
                   dataSource = new KmlDataSource();
                    var parser = new DOMParser();
					var target = document.getElementById('cesiumContainer');
					spinner = new Spinner().spin(target);
					
					performanceContainer = document.createElement('div');
					performanceContainer.className = 'cesium-loadingKML';
					performanceContainer.style.position = 'absolute';
					performanceContainer.style.top = '0';
					performanceContainer.style.left = '0';
					performanceContainer.style.right = '0';
					performanceContainer.style.bottom = '0';
					var container = document.body;
					container.appendChild(performanceContainer);
					performanceContainer.style.backgroundColor = 'rgba(40, 40, 40, 0.7)';
					
					var display = document.createElement('div');
					var fpsElement = document.createElement('div');
					var fpsText = document.createTextNode("Loading...");
					fpsElement.appendChild(fpsText);
					fpsElement.style.color = "#FFFF00";
					display.appendChild(fpsElement);
					display.style['z-index'] = 1;
					display.style.top ='48%';
					display.style.left = '52%';
					display.style.position = 'absolute';
					display.style.font = this._font;
					display.style.padding = '7px';
					display.style['border-radius'] = '5px';
					display.style.border = '1px solid #444';
					performanceContainer.appendChild(display);
					fpsText.nodeValue = 'Loading...';
					
					var contentHandler = new DefaultHandler2();
					var dataSource2 = new KmlDataSource2();
					contentHandler.setDataSource(dataSource2);

					var saxParser = XMLReaderFactory.createXMLReader();

					saxParser.setHandler(contentHandler);
					setTimeout( function() {
						saxParser.parseString(evt.target.result);
					},0);
				
					//console.log("Start");
				//	setTimeout( function() {
				//		loadPromise = dataSource.load(parser.parseFromString(evt.target.result, "text/xml"), fileName,viewer);
				//	},0);
                } else if (/\.kmz$/i.test(fileName)) {
                    dataSource = new KmlDataSource();
                    loadPromise = dataSource.loadKmz(file, fileName);
                } else {
                    viewer.dropError.raiseEvent(viewer, fileName, 'Unrecognized file: ' + fileName);
                    return;
                }
				
				interval = setInterval( function () {showMessage(dataSource2,viewer)},10);
				//if(dataSource2.isEnd){
				//	viewer.dataSources.add(dataSource2);
				//}

                if (defined(loadPromise)) {
                    loadPromise.otherwise(function(error) {
                        viewer.dropError.raiseEvent(viewer, fileName, error);
                    });
                }
            } catch (error) {
                viewer.dropError.raiseEvent(viewer, fileName, error);
            }
        };
    }
	function showMessage(dataSource,viewer){
		//console.log(dataSource.totalPlacemarks);
		if(dataSource.isEnd){
			viewer.dataSources.add(dataSource);
			clearInterval(interval);
			clearInterval(interval-1);
			spinner.stop();
			document.body.removeChild(performanceContainer);
		}
	}

    function createDropErrorCallback(viewer, file) {
        return function(evt) {
            viewer.dropError.raiseEvent(viewer, file.name, evt.target.error);
        };
    }

    return viewerDragDropMixin;
});