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
	
	//This is by no means an exhaustive list of MIME types.
    //The purpose of this list is to be able to accurately identify content embedded
    //in KMZ files. Eventually, we can make this configurable by the end user so they can add
    //there own content types if they have KMZ files that require it.
    var MimeTypes = {
        avi : "video/x-msvideo",
        bmp : "image/bmp",
        bz2 : "application/x-bzip2",
        chm : "application/vnd.ms-htmlhelp",
        css : "text/css",
        csv : "text/csv",
        doc : "application/msword",
        dvi : "application/x-dvi",
        eps : "application/postscript",
        flv : "video/x-flv",
        gif : "image/gif",
        gz : "application/x-gzip",
        htm : "text/html",
        html : "text/html",
        ico : "image/vnd.microsoft.icon",
        jnlp : "application/x-java-jnlp-file",
        jpeg : "image/jpeg",
        jpg : "image/jpeg",
        m3u : "audio/x-mpegurl",
        m4v : "video/mp4",
        mathml : "application/mathml+xml",
        mid : "audio/midi",
        midi : "audio/midi",
        mov : "video/quicktime",
        mp3 : "audio/mpeg",
        mp4 : "video/mp4",
        mp4v : "video/mp4",
        mpeg : "video/mpeg",
        mpg : "video/mpeg",
        odp : "application/vnd.oasis.opendocument.presentation",
        ods : "application/vnd.oasis.opendocument.spreadsheet",
        odt : "application/vnd.oasis.opendocument.text",
        ogg : "application/ogg",
        pdf : "application/pdf",
        png : "image/png",
        pps : "application/vnd.ms-powerpoint",
        ppt : "application/vnd.ms-powerpoint",
        ps : "application/postscript",
        qt : "video/quicktime",
        rdf : "application/rdf+xml",
        rss : "application/rss+xml",
        rtf : "application/rtf",
        svg : "image/svg+xml",
        swf : "application/x-shockwave-flash",
        text : "text/plain",
        tif : "image/tiff",
        tiff : "image/tiff",
        txt : "text/plain",
        wav : "audio/x-wav",
        wma : "audio/x-ms-wma",
        wmv : "video/x-ms-wmv",
        xml : "application/xml",
        zip : "application/zip",

        detectFromFilename : function(filename) {
            var ext = filename.toLowerCase();
            ext = ext.substr(ext.lastIndexOf('.') + 1);
            return MimeTypes[ext];
        }
    };

    var parser = new DOMParser();
    var scratchCartographic = new Cartographic();
    var scratchCartesian = new Cartesian3();
	var indexFirst =0;
	var indexSecond = 0;
	var showLoading = 0;

    function loadXmlFromZip(reader, entry, uriResolver) {
        entry.getData(new zip.TextWriter(), function(text) {
            uriResolver.kml = text;
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
        var baseHeight = 0;
        
        var digits = element.trim().split(/[\s,\n]+/g);
        scratchCartographic = Cartographic.fromDegrees(digits[0], digits[1], 3, scratchCartographic);
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
		
		if (!defined(coordNodes)) {
			return;
		}
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
		dataSource._coordinates.push(coordinates);
		return property;
    }

	
	var supportedTypes = {
		LookAt : processLookAt,
		Style : processStyle,
		Placemark : processPlacemark,
		Icon : processIcon,
		LineStyle : processLine,
		TimeSpan : processTimeSpan,
	};
	
	var polyline = 0;
	
	function getOrCreateEntity(node, entityCollection) {
        var id = polyline;
		polyline++;
		//console.log(node);
        id = defined(id) ? id : createGuid();
        var entity = entityCollection.getOrCreateEntity(id);
		//console.log(entity);
        
        return entity;
    }
	
	function processTimeSpan(){
		var node = nodes.pop();
		var parent = nodes.pop();
		parent.timespan = node;
		nodes.push(parent);
	}
	
	function processIcon() {
		var node = nodes.pop();
		var parent = nodes.pop();
		parent.icon = node;
		nodes.push(parent);
	}
	
	function processLine() {
		var node = nodes.pop();
		var parent = nodes.pop();
		parent.line = node;
		nodes.push(parent);
	}
	function parseColorString(value){
		if(value[0] === '#'){
            value = value.substring(1);
        }

        var alpha = parseInt(value.substring(0, 2), 16) / 255.0;
        var blue = parseInt(value.substring(2, 4), 16) / 255.0;
        var green = parseInt(value.substring(4, 6), 16) / 255.0;
        var red = parseInt(value.substring(6, 8), 16) / 255.0;

        return new Color(red, green, blue, alpha);	
	}
	
	function processPlacemark(dataSource) {
		dataSource._totalPlacemarks++;
		var placemark = nodes.pop();
		dataSource._stylesArray.push(placemark.styleUrl);
		dataSource._descriptions.push(placemark.description);
		processTrack(dataSource,placemark);
		var entity = getOrCreateEntity(placemark,dataSource.entities);
		//console.log(placemark);
		
		var style = dataSource._styles[placemark.styleUrl];
		var icon = style.icon;
		if (defined(icon)) {
			entity.billboard = {
				image : icon.href,
				scale : style.scale
			}
		}
		
		if (defined(style.line)){
		var color = parseColorString(style.line.color);
			entity.polyline = {
				positions : Cartesian3.fromDegreesArray(placemark.coordinates.trim().split(/[\s,\n]+/g)),
				width : style.line.width,
				material : color
			}
		}

		if (defined(placemark.timespan)){
			//console.log(placemark.timespan);
			var begin = JulianDate.fromIso8601(placemark.timespan.begin);
			var end = JulianDate.fromIso8601(placemark.timespan.end);
			if (defined(begin) && defined(end)) { 
			
				var result = new TimeIntervalCollection();
				result.addInterval(new TimeInterval({
					start : begin,
					stop : end
				}));
				entity.availability = result;
			}
		}
		//console.log(entity.availability);
		 var background = Color.WHITE;
        var foreground = Color.BLACK;
		placemark.description = placemark.description.allReplace({'&lt;': '<', '&gt;': '>'});
		 var tmp = '<div class="cesium-infoBox-description-lighter" style="';
        tmp += 'overflow:auto;';
        tmp += 'word-wrap:break-word;';
        tmp += 'background-color:' + background.toCssColorString() + ';';
        tmp += 'color:' + foreground.toCssColorString() + ';';
        tmp += '">';
        tmp += placemark.description + '</div>';
		entity.description = tmp;
		
		entity.dataSource = dataSource;
		//entity.position = dataSource._positions[0];
		if (dataSource._totalPlacemarks % 1000 == 0) {
			showLoading=dataSource._totalPlacemarks;
			document.getElementsByClassName('cesium-loadingKML')[0].childNodes[0].childNodes[0].textContent 
			= "Loading: "+showLoading+" placemarks";
		}
	}
	
	function processStyle(dataSource) {
		var node = nodes.pop();
		//console.log(node);
		var id ='#'+node.id;
		var style = {};
		dataSource._styles[id] = node;
		//style.href = node.icon.href;
		//console.log(dataSource._styles[id]);
		if (dataSource._isZipped){
			dataSource._styles[id] = resolveHref(node.href,dataSource._sourceUri,dataSource._uriResolver);
		}
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
		//console.log(element);
		if (defined(supportedTypes[element])) {
			var node = {
				element : element};
			if (id != null) {
				node["id"] = id;
			}
			nodes.push(node);
			//console.log(nodes);
		}
	}
	
	function handleEndElement(dataSource,element) {
		if (element == "kml"){
			dataSource._isEnd = true;
			return;
		}
		if(nodes.length >0 && nodes[nodes.length-1].element == element){
			var elementProcessor = supportedTypes[element];
			if (defined(elementProcessor)) {
				elementProcessor(dataSource);
				return;
			}
		}
	}
	
	function setCharacters(dataSource,ch){
	//console.log(ch);
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
	
	function loadDataUriFromZip(reader, entry, uriResolver) {
        var mimeType = defaultValue(MimeTypes.detectFromFilename(entry.filename), 'application/octet-stream');
        entry.getData(new zip.Data64URIWriter(mimeType), function(dataUri) {
            uriResolver[entry.filename] = dataUri;
        });
    }
	
	function resolveHref(href, sourceUri, uriResolver) {
        if (!defined(href)) {
            return undefined;
        }
        var hrefResolved = false;
        if (defined(uriResolver)) {
            var blob = uriResolver[href];
            if (defined(blob)) {
                hrefResolved = true;
                href = blob;
            }
        }
        if (!hrefResolved && defined(sourceUri)) {
            var baseUri = new Uri(document.location.href);
            sourceUri = new Uri(sourceUri);
            href = new Uri(href).resolve(sourceUri.resolve(baseUri)).toString();
          //  href = proxyUrl(href, proxy);
        }
        return href;
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
		this._isActive = true;
		this._firstIndex = 0;
		this._lastIndex = 0;
		this._isZipped = false;
		this._uriResolver;
		this._sourceUri;
		this._coordinates =[];
		
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
		},
		isActive : {
			get : function() {
				return this._isActive;
			},
			set : function (value) {
				this._isActive = value;
			}
		},
		firstIndex : {
			get : function() {
				return this._firstIndex;
			},
			set : function (value) {
				this._firstIndex = value;
			}
		},
		lastIndex : {
			get : function() {
				return this._lastIndex;
			},
			set : function (value) {
				this._lastIndex = value;
			}
		},
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
	
	KmlDataSource.prototype.loadKmz = function(dataSource, blob, sourceUri) {
        zip.createReader(new zip.BlobReader(blob), function(reader) {
			dataSource._isZipped = true;
            reader.getEntries(function(entries) {
                var foundKML = false;
                var uriResolver = {};
                for (var i = 0; i < entries.length; i++) {
                    var entry = entries[i];
                    if (!entry.directory) {
                        if (!foundKML && /\.kml$/i.test(entry.filename)) {
                            //Only the first KML file found in the zip is used.
                            //https://developers.google.com/kml/documentation/kmzarchives
                            foundKML = true;
                            loadXmlFromZip(reader, entry, uriResolver);
                        } else {
                            loadDataUriFromZip(reader, entry, uriResolver);
                        }
                    }
                }
                    reader.close();
					dataSource._uriResolver = uriResolver;
					dataSource._sourceUri = sourceUri;
            });
        });
    };

    return KmlDataSource;
});