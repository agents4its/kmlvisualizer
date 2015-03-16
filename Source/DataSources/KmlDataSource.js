/*global define*/
define([
        '../Core/Cartesian2',
        '../Core/Cartesian3',
        '../Core/Cartographic',
        '../Core/ClockRange',
        '../Core/ClockStep',
        '../Core/Color',
        '../Core/createGuid',
        '../Core/defaultValue',
        '../Core/defined',
        '../Core/defineProperties',
        '../Core/DeveloperError',
        '../Core/Ellipsoid',
        '../Core/Event',
        '../Core/getFilenameFromUri',
        '../Core/Iso8601',
        '../Core/JulianDate',
        '../Core/loadBlob',
        '../Core/loadXML',
        '../Core/Math',
        '../Core/NearFarScalar',
        '../Core/PinBuilder',
        '../Core/PolygonPipeline',
        '../Core/Rectangle',
        '../Core/RuntimeError',
        '../Core/TimeInterval',
        '../Core/TimeIntervalCollection',
        '../Scene/LabelStyle',
        '../Scene/VerticalOrigin',
        '../ThirdParty/Uri',
        '../ThirdParty/when',
        '../ThirdParty/zip',
        './BillboardGraphics',
        './ColorMaterialProperty',
        './ConstantPositionProperty',
        './ConstantProperty',
        './DataSource',
        './DataSourceClock',
        './Entity',
        './EntityCollection',
        './ImageMaterialProperty',
        './LabelGraphics',
        './PolygonGraphics',
        './PolylineGraphics',
        './PolylineOutlineMaterialProperty',
        './RectangleGraphics',
        './SampledPositionProperty'
    ], function(
        Cartesian2,
        Cartesian3,
        Cartographic,
        ClockRange,
        ClockStep,
        Color,
        createGuid,
        defaultValue,
        defined,
        defineProperties,
        DeveloperError,
        Ellipsoid,
        Event,
        getFilenameFromUri,
        Iso8601,
        JulianDate,
        loadBlob,
        loadXML,
        CesiumMath,
        NearFarScalar,
        PinBuilder,
        PolygonPipeline,
        Rectangle,
        RuntimeError,
        TimeInterval,
        TimeIntervalCollection,
        LabelStyle,
        VerticalOrigin,
        Uri,
        when,
        zip,
        BillboardGraphics,
        ColorMaterialProperty,
        ConstantPositionProperty,
        ConstantProperty,
        DataSource,
        DataSourceClock,
        Entity,
        EntityCollection,
        ImageMaterialProperty,
        LabelGraphics,
        PolygonGraphics,
        PolylineGraphics,
        PolylineOutlineMaterialProperty,
        RectangleGraphics,
        SampledPositionProperty) {
    "use strict";

    var parser = new DOMParser();
    var scratchCartographic = new Cartographic();
    var scratchCartesian = new Cartesian3();
	var indexFirst =0;
	var indexSecond = 0;
	var totalPlacemarks=1;
	var showLoading = 0;

    

    function loadXmlFromZip(reader, entry, uriResolver, deferred) {
        entry.getData(new zip.TextWriter(), function(text) {
            uriResolver.kml = parser.parseFromString(text, 'application/xml');
            deferred.resolve();
        }, function(current, total) {
            // onprogress callback
        });
    }

    function proxyUrl(url, proxy) {
        if (defined(proxy)) {
            url = proxy.getURL(url);
        }
        return url;
    }

    function createId(node) {
        return defined(node) && defined(node.id) && node.id.length !== 0 ? node.id : createGuid();
    }

    //Helper functions
    function readCoordinate(element, altitudeMode) {
		//console.log(element);
        var baseHeight = 0;
        switch (altitudeMode) {
        case 'absolute':
            //TODO MSL + height
            break;
        case 'relativeToGround':
            //TODO Terrain + height
            break;
        case 'clampToGround ':
            //TODO on terrain, ignore altitude
            break;
        default:
            //TODO Same as clampToGround
            break;
        }
        var digits = element.textContent.trim().split(/[\s,\n]+/g);
        scratchCartographic = Cartographic.fromDegrees(digits[0], digits[1], 1, scratchCartographic);
		//console.log(scratchCartographic +" " +digits[0] + " " +digits[1]);
		var result = Ellipsoid.WGS84.cartographicToCartesian(scratchCartographic);
		
        return result;
    }

    function readCoordinates(element) {
        //TODO: height is referenced to altitude mode
        var tuples = element.textContent.trim().split(/[\s\n]+/g);
        var numberOfCoordinates = tuples.length;
        var result = new Array(numberOfCoordinates);
        var resultIndex = 0;

        for (var i = 0; i < tuples.length; i++) {
            var coordinates = tuples[i].split(/[\s,\n]+/g);
            scratchCartographic = Cartographic.fromDegrees(parseFloat(coordinates[0]), parseFloat(coordinates[1]), defined(coordinates[2]) ? parseFloat(coordinates[2]) : 0, scratchCartographic);
            result[resultIndex++] = Ellipsoid.WGS84.cartographicToCartesian(scratchCartographic);
        }
        return result;
    }

    var namespaces = {
        kml : [null, undefined, 'http://www.opengis.net/kml/2.2', 'http://earth.google.com/kml/2.2', 'http://earth.google.com/kml/2.1', 'http://earth.google.com/kml/2.0'],
        gx : ['http://www.google.com/kml/ext/2.2'],
        atom : ['http://www.w3.org/2005/Atom']
    };

    function queryFirstNode(node, tagName, namespace) {
		//console.log(node);
        var childNodes = node.childNodes;
        var length = childNodes.length;
        for (var q = 0; q < length; q++) {
            var child = childNodes[q];
            if (child.localName === tagName && namespace.indexOf(child.namespaceURI) !== -1) {
                return child;
            }
        }
        return undefined;
    }

    function queryNodes(node, tagName, namespace) {
        var result = [];
        var childNodes = node.getElementsByTagName(tagName);
        var length = childNodes.length;
        for (var q = 0; q < length; q++) {
            var child = childNodes[q];
            if (child.localName === tagName && namespace.indexOf(child.namespaceURI) !== -1) {
                result.push(child);
            }
        }
        return result;
    }

    function queryChildNodes(node, tagName, namespace) {
        var result = [];
        var childNodes = node.childNodes;
        var length = childNodes.length;
        for (var q = 0; q < length; q++) {
            var child = childNodes[q];
            if (child.localName === tagName && namespace.indexOf(child.namespaceURI) !== -1) {
                result.push(child);
            }
        }
        return result;
    }

    function queryNumericValue(node, tagName, namespace) {
        var resultNode = queryFirstNode(node, tagName, namespace);
        if (defined(resultNode)) {
            var result = parseFloat(resultNode.textContent);
            return !isNaN(result) ? result : undefined;
        }
        return undefined;
    }

    function queryStringValue(node, tagName, namespace) {
        var result = queryFirstNode(node, tagName, namespace);
        if (defined(result)) {
            return result.textContent;
        }
        return undefined;
    }
	function queryLookAt(node, tagName, namespace) {
		//console.log(node);
        var result = queryFirstNode(node, tagName, namespace);
        if (defined(result)) {
            return result;
        }
        return undefined;
    }

    function queryBooleanValue(node, tagName, namespace) {
        var result = queryFirstNode(node, tagName, namespace);
        if (defined(result)) {
            return result.textContent === '1';
        }
        return undefined;
    }


   
    function processTrack(dataSource, geometryNode) {
		//console.log("track");
		var firstCoor;
		var firstTime;
		var secondCoor;
		var secondTime;
		var index = 0;
		
        var altitudeMode = queryStringValue(geometryNode, 'altitudeMode', namespaces.kml);
        var coordNodes = queryChildNodes(geometryNode, 'coord', namespaces.gx);
        var timeNodes = queryChildNodes(geometryNode, 'when', namespaces.kml);
		
        var coordinates = new Array()
        var times = new Array();
        for (var i = 0; i < timeNodes.length; i++) {
            var coor1 = readCoordinate(coordNodes[i], altitudeMode);
			//console.log(coor1);
            var time1 = JulianDate.fromIso8601(timeNodes[i].textContent);
			//console.log(time1);
			if(JulianDate.lessThan(time1,dataSource._startTime)){
				dataSource._startTime = time1;
			}
			if(JulianDate.greaterThan(time1,dataSource._endTime)){
				//console.log(JulianDate.toIso8601(time1));
				dataSource._endTime = time1;
			}
			if (!coor1.equals(firstCoor)){
				if(firstCoor != undefined){
					coordinates[index]= firstCoor;
					times[index] = firstTime;
					if(secondCoor != undefined){
						index++;
						coordinates[index] = secondCoor;
						times[index] = secondTime;
					}
					index++;
				}
				firstCoor = coor1;
				firstTime = time1;
			} 
			secondCoor = coor1;
			secondTime = time1;
        }
		
		coordinates[index] = firstCoor;
		times[index] = firstTime;
		coordinates[index+1] = secondCoor;
		times[index+1] = secondTime;
		
        var property = new SampledPositionProperty();
		//console.log(times + " casy");
		//console.log(coordinates);
        property.addSamples(times, coordinates);
		dataSource._positions.push(property);
		return property;
    }


    var geometryTypes = {
        Track : processTrack,
    };

    function processDocument(dataSource, parent, node) {
		dataSource._isEnd = true;
        var featureTypeNames = Object.keys(featureTypes);
        var featureTypeNamesLength = featureTypeNames.length;

        for (var i = indexFirst; i < featureTypeNamesLength; i++) {
            var featureName = featureTypeNames[i];
            var processFeatureNode = featureTypes[featureName];

            var childNodes = node.childNodes;
			//console.log(childNodes.length + " childNodes"  +" "+node.localName);
            var length = childNodes.length;
            for (var q = indexSecond; q < length; q++) {
				if(totalPlacemarks % 1000 == 0){
					showLoading+=totalPlacemarks;
					totalPlacemarks = 1;
					indexFirst = i;
					indexSecond = q;
					dataSource._isEnd = false;
					document.getElementsByClassName('cesium-performanceDisplay')[1].childNodes[0].childNodes[0].textContent = "Loading: "+showLoading+" placemarks";
					setTimeout( function() {
					//console.log(totalPlacemarks+ " b "+q+" "+i);
						processDocument(dataSource,parent,node);
						},0);
						return;	
				}
                var child = childNodes[q];
                if (child.localName === featureName && namespaces.kml.indexOf(child.namespaceURI) !== -1) {
                   var pom =  processFeatureNode(dataSource, parent, child);
                }
            }
        }
    }

    function processFolder(dataSource, parent, node) {
        parent = new Entity({id:createId(node)});
        parent.name = queryStringValue(node, 'name', namespaces.kml);
		var cameraStart = queryLookAt(node, 'LookAt', namespaces.kml);
		var style = queryNodes(node, 'Style', namespaces.kml);
		var child = queryNodes(style[0],'href',namespaces.kml);
		for (var i = 0; i < style.length;i++){
			var icon = queryNodes(style[i],'href',namespaces.kml);
			var href = icon[0].textContent;
			dataSource._styles['#'+style[i].attributes.id.value] = href;
		}
		if (defined(cameraStart)) {
			dataSource._lookAt[0] = queryNumericValue(cameraStart,'longitude',namespaces.kml);
			dataSource._lookAt[1] = queryNumericValue(cameraStart,'latitude',namespaces.kml);
			dataSource._lookAt[2] = queryNumericValue(cameraStart,'altitude',namespaces.kml);
		}
        processDocument(dataSource, parent, node);
    }

    function processPlacemark(dataSource, parent, placemark) {
		totalPlacemarks++;

        var id = createId(placemark.id);
        var name = queryStringValue(placemark, 'name', namespaces.kml);
        var description = queryStringValue(placemark, 'description', namespaces.kml);
		var styleID = queryStringValue(placemark, 'styleUrl', namespaces.kml);
		dataSource._stylesArray.push(styleID);
		dataSource._descriptions.push(description);
        var visibility = queryBooleanValue(placemark, 'visibility', namespaces.kml);
        var timeSpanNode = queryFirstNode(placemark, 'TimeSpan', namespaces.kml);

        var hasGeometry = false;
        var childNodes = placemark.childNodes;
        for (var i = 0, len = childNodes.length; i < len && !hasGeometry; i++) {
            var childNode = childNodes.item(i);
            var geometryProcessor = geometryTypes[childNode.localName];
            if (defined(geometryProcessor)) {
                var pom = geometryProcessor(dataSource, childNode);
                hasGeometry = true;
            }
        }
        if (!hasGeometry) {
            entity.merge(styleEntity);
        }
		return pom;
    }

   

    function processUnsupported(dataSource, parent, node, entityCollection, styleCollection, sourceUri, uriResolver) {
        window.console.log('Unsupported feature: ' + node.nodeName);
    }

    var featureTypes = {
        Document : processDocument,
        Folder : processFolder,
        Placemark : processPlacemark
    };

    function processFeatureNode(dataSource, node, parent) {
        var featureProocessor = featureTypes[node.nodeName];
        if (!defined(featureProocessor)) {
            featureProocessor = featureTypes[node.nodeName];
        }
        if (defined(featureProocessor)) {
           var pom = featureProocessor(dataSource, parent, node);
        } else {
            window.console.log('Unsupported feature node: ' + node.nodeName);
        }
		return pom;
    }

    function loadKml(dataSource, kml, sourceUri, uriResolver) {
        var docElement = queryFirstNode(kml.documentElement, 'Document', namespaces.kml);
        var name = docElement ? queryStringValue(docElement, 'name', namespaces.kml) : undefined;
        if (!defined(name) && defined(sourceUri)) {
            name = getFilenameFromUri(sourceUri);
        }

        if (dataSource._name !== name) {
            dataSource._name = name;
            dataSource._changed.raiseEvent(dataSource);
        }
        var styleCollection = new EntityCollection();
        
            var entityCollection = dataSource._entityCollection;
            processFeatureNode(dataSource, kml.documentElement.firstElementChild, undefined);

            var availability = entityCollection.computeAvailability();
            if (availability.equals(Iso8601.MAXIMUM_INTERVAL)) {
                if (defined(dataSource._clock)) {
                    dataSource._clock = undefined;
                    dataSource._changed.raiseEvent(dataSource);
                }
            } else {
                var clock = new DataSourceClock();
                clock.startTime = availability.start;
                clock.stopTime = availability.stop;
                clock.currentTime = availability.start;
                clock.clockRange = ClockRange.LOOP_STOP;
                clock.clockStep = ClockStep.SYSTEM_CLOCK_MULTIPLIER;
                clock.multiplier = Math.min(Math.max(JulianDate.secondsDifference(availability.stop, availability.start) / 60, 60), 50000000);
                if (!defined(dataSource._clock) || !(dataSource._clock.equals(clock))) {
                    dataSource._clock = clock;
                    dataSource._changed.raiseEvent(dataSource);
                }
            }

            DataSource.setLoading(dataSource, false);
            return dataSource;   
    }
   
    /**
     * A {@link DataSource} which processes Keyhole Markup Language (KML).
     * @alias KmlDataSource
     * @constructor
     *
     * @see https://developers.google.com/kml/
     * @see http://www.opengeospatial.org/standards/kml/
     */
    var KmlDataSource = function(proxy) {
        this._changed = new Event();
        this._error = new Event();
        this._loading = new Event();
        this._clock = undefined;
		this._positions = [];
		this._descriptions = [];
		this._lookAt = [];
		this._stylesArray = [];
		this._startTime = new JulianDate.fromIso8601("2020-09-01T00:00:00Z");
		this._endTime = new JulianDate.fromIso8601("2010-09-01T00:00:00Z");
		this._viewer;
		this._styles = new Array();
        this._entityCollection = new EntityCollection();
        this._name = undefined;
        this._isLoading = false;
        this._proxy = proxy;
		this._isEnd = false;
        this._pinBuilder = new PinBuilder();
    };

    /**
     * Creates a new instance and asynchronously loads the KML or KMZ file at the provided url.
     *
     * @param {string} url The url to be processed.
     *
     * @returns {KmlDataSource} A new instance set to load the specified url.
     */
    KmlDataSource.fromUrl = function(url) {
        var result = new KmlDataSource();
        result.loadUrl(url);
        return result;
    };

    defineProperties(KmlDataSource.prototype, {
        /**
         * Gets a human-readable name for this instance.
         * @memberof KmlDataSource.prototype
         * @type {String}
         */
        name : {
            get : function() {
                return this._name;
            }
        },
        /**
         * Gets the clock settings defined by the loaded CZML.  If no clock is explicitly
         * defined in the CZML, the combined availability of all entities is returned.  If
         * only static data exists, this value is undefined.
         * @memberof KmlDataSource.prototype
         * @type {DataSourceClock}
         */
        clock : {
            get : function() {
                return this._clock;
            }
        },
        /**
         * Gets the collection of {@link Entity} instances.
         * @memberof KmlDataSource.prototype
         * @type {EntityCollection}
         */
        entities : {
            get : function() {
                return this._entityCollection;
            }
        },
        /**
         * Gets a value indicating if the data source is currently loading data.
         * @memberof KmlDataSource.prototype
         * @type {Boolean}
         */
        isLoading : {
            get : function() {
                return this._isLoading;
            }
        },
        /**
         * Gets an event that will be raised when the underlying data changes.
         * @memberof KmlDataSource.prototype
         * @type {Event}
         */
        changedEvent : {
            get : function() {
                return this._changed;
            }
        },
        /**
         * Gets an event that will be raised if an error is encountered during processing.
         * @memberof KmlDataSource.prototype
         * @type {Event}
         */
        errorEvent : {
            get : function() {
                return this._error;
            }
        },
        /**
         * Gets an event that will be raised when the data source either starts or stops loading.
         * @memberof KmlDataSource.prototype
         * @type {Event}
         */
        loadingEvent : {
            get : function() {
                return this._loading;
            }
        },
		 positions : {
            get : function() {
                return this._positions;
            }
        },
		descriptions : {
			get : function() {
				return this._descriptions;
			}
		},
		styles : {
			get : function() {
				return this._styles;
			}
		},
		lookAt : {
			get : function() {
				return this._lookAt;
			}
		},
		isEnd : {
			get : function() {
				return this._isEnd;
			}
		},
		stylesArray : {
			get : function() {
				return this._stylesArray;
			}
		},
		startTime : {
			get : function() {
				return this._startTime;
			}
		},
		endTime : {
			get : function() {
				return this._endTime;
			}
		},
		viewer : {
			get : function() {
				return this._viewer;
			}
		}
    });

    /**
     * Asynchronously loads the provided KML document, replacing any existing data.
     *
     * @param {Document} kml The parsed KML document to be processed.
     * @param {string} sourceUri The url of the document which is used for resolving relative links and other KML features.
     *
     * @returns {Promise} a promise that will resolve when the KML is processed.
     */
    KmlDataSource.prototype.load = function(kml, sourceUri,viewer) {
	indexFirst = 0;
	indexSecond = 0;
	totalPlacemarks = 1;
        if (!defined(kml)) {
            throw new DeveloperError('kml is required.');
        }

		this._viewer = viewer;
		//console.log(this._viewer);
        DataSource.setLoading(this, true);
        var that = this;
        return when(loadKml(this, kml, sourceUri, undefined)).otherwise(function(error) {
            DataSource.setLoading(that, false);
            that._error.raiseEvent(that, error);
            return when.reject(error);
        });
    };
	

    /**
     * Asynchronously loads the provided KMZ Blob, replacing any existing data.
     *
     * @param {Blob} kmz The KMZ document to be processed.
     * @param {string} sourceUri The url of the document which is used for resolving relative links and other KML features.
     *
     * @returns {Promise} a promise that will resolve when the KMZ is processed.
     */
    KmlDataSource.prototype.loadKmz = function(kmz, sourceUri) {
        if (!defined(kmz)) {
            throw new DeveloperError('kmz is required.');
        }

        DataSource.setLoading(this, true);
        var that = this;
        return when(loadKmz(this, kmz, sourceUri)).otherwise(function(error) {
            DataSource.setLoading(that, false);
            that._error.raiseEvent(that, error);
            return when.reject(error);
        });
    };

    /**
     * Asynchronously loads the KML or KMZ file at the provided url, replacing any existing data.
     *
     * @param {String} url The url to be processed.
     *
     * @returns {Promise} a promise that will resolve when the KMZ is processed.
     */
    KmlDataSource.prototype.loadUrl = function(url) {
        if (!defined(url)) {
            throw new DeveloperError('url is required.');
        }

        DataSource.setLoading(this, true);
        var that = this;
        return when(loadBlob(proxyUrl(url, this._proxy))).then(function(blob) {
            return isZipFile(blob).then(function(isZip) {
                if (isZip) {
                    return loadKmz(that, blob, url);
                }
                return when(readBlob.asText(blob)).then(function(text) {
                    var kml = parser.parseFromString(text, 'application/xml');
                    //There's no official way to validate if the parse was successful.
                    //The following if check seems to detect the error on all supported browsers.
                    if ((defined(kml.body) && kml.body !== null) || kml.documentElement.tagName === 'parsererror') {
                        throw new RuntimeError(kml.body.innerText);
                    }
                    return loadKml(that, kml, url, undefined);
                });
            });
        }).otherwise(function(error) {
            DataSource.setLoading(that, false);
            that._error.raiseEvent(that, error);
            return when.reject(error);
        });
    };

    return KmlDataSource;
});