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
    function readCoordinate(element) {
		//console.log(element);
        var baseHeight = 0;
        
        var digits = element.trim().split(/[\s,\n]+/g);
        scratchCartographic = Cartographic.fromDegrees(digits[0], digits[1], 3, scratchCartographic);
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
   
    function processTrack(dataSource,node) {
		var firstCoor;
		var firstTime;
		var secondCoor;
		var secondTime;
		var index = 0;
		
        var coordNodes = node.coord;
        var timeNodes = node.when;
		
        var coordinates = new Array()
        var times = new Array();
        for (var i = 0; i < timeNodes.length; i++) {
            var coor1 = readCoordinate(coordNodes[i]);
            var time1 = JulianDate.fromIso8601(timeNodes[i]);
			if(JulianDate.lessThan(time1,dataSource._startTime)){
				dataSource._startTime = time1;
			}
			if(JulianDate.greaterThan(time1,dataSource._endTime)){
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
        property.addSamples(times, coordinates);
		if (property._property._times.length < 2){
			console.log("Placemark id:"+node.id+"  is not dynamic - has less than 2 <when> tags");
			return;
		}
		dataSource._positions.push(property);
		return property;
    }

	
	var supportedTypes = {
		LookAt : processLookAt,
		Style : processStyle,
		Placemark : processPlacemark,
	};
	
	function processPlacemark(dataSource) {
		dataSource._totalPlacemarks++;
		var placemark = nodes.pop();
		dataSource._stylesArray.push(placemark.styleUrl);
		dataSource._descriptions.push(placemark.description);
		processTrack(dataSource,placemark);
		if (dataSource._totalPlacemarks % 1000 == 0) {
			showLoading=dataSource._totalPlacemarks;
			document.getElementsByClassName('cesium-loadingKML')[0].childNodes[0].childNodes[0].textContent 
			= "Loading: "+showLoading+" placemarks";
		}
	}
	function processStyle(dataSource) {
		var node = nodes.pop();
		dataSource._styles['#'+node.id] = node.href;
	}

	function processLookAt(dataSource){
		var node = nodes.pop();
		dataSource._lookAt[0] = parseFloat(node.longitude);
		dataSource._lookAt[1] = parseFloat(node.latitude);
		dataSource._lookAt[2] = parseFloat(node.altitude);
	}
   

    function processUnsupported(dataSource, parent, node, entityCollection, styleCollection, sourceUri, uriResolver) {
        window.console.log('Unsupported feature: ' + node.nodeName);
    }
	function setActualElement(dataSource,element,id) {
		dataSource._actualElement = element;
		if (defined(supportedTypes[element])) {
			var node = {
				name : element};
			if (id != null) {
				node["id"] = id;
			}
			nodes.push(node);
		}
	}
	
	function handleEndElement(dataSource,element) {
		if (element == "kml"){
			dataSource._isEnd = true;
			return;
		}
		if(nodes.length >0 && nodes[nodes.length-1].name == element){
			var elementProcessor = supportedTypes[element];
			if (defined(elementProcessor)) {
				elementProcessor(dataSource);
				return;
			}
		}
	}
	
	function setCharacters(dataSource,ch){
		if (nodes.length > 0) {
			var parent = nodes[nodes.length-1];
			if (dataSource._actualElement == "when" || dataSource._actualElement == "coord"){
				if (parent[dataSource._actualElement] == undefined){
					parent[dataSource._actualElement] = [];
				}
				parent[dataSource._actualElement].push(ch);
				return;
			}
			parent[dataSource._actualElement] = ch;
		}
	}
	
	var nodes = [];
   
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
		this._actualElement;
		this._totalPlacemarks = 0;
		
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
		},
		actualElement : {
			get : function() {
				return this._actualElement;
			}
		},
		totalPlacemarks: {
			get : function() {
				return this._totalPlacemarks;
			}
		}
    });

	
	KmlDataSource.prototype.startElement = function(element,id){
		setActualElement(this,element,id);
	};
	
	KmlDataSource.prototype.setCharacters = function(ch){
		setCharacters(this,ch);
	};
   
	KmlDataSource.prototype.endElement = function(element){
		handleEndElement(this,element);
	};

    return KmlDataSource;
});